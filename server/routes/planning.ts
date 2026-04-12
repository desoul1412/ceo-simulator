import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { getCompanyCwd } from '../repoManager';
import { AUTO_NAMES, ROLE_COLORS, ROLE_SPRITES, DEFAULT_SYSTEM_PROMPTS, DEFAULT_SKILLS, DESK_POSITIONS_PLAN } from '../constants';
import { initAgentBrain, parseMasterPlanPhases, persistPlanToBrain, persistDependencyGraph } from '../helpers/brain';
import { createPlanningSession, runPlanningSession, replanTab } from '../agents/ceoPlannerV2';
import { createRoleDependencies } from '../dependencyManager';
import { presetRegistry } from '../presets';

const router = Router();

// ── Create Planning Session ──────────────────────────────────────────────────

router.post('/api/companies/:id/plan-session', async (req, res) => {
  try {
    const { directive, projectSize } = req.body;
    if (!directive) return res.status(400).json({ error: 'directive is required' });

    const sessionId = await createPlanningSession(req.params.id, directive, projectSize ?? 'medium');

    const { data: tabs } = await supabase.from('planning_tabs')
      .select('*').eq('session_id', sessionId).order('sort_order');

    const companyCwd = await getCompanyCwd(req.params.id).catch(() => process.cwd());
    runPlanningSession(sessionId, req.params.id, directive, companyCwd).catch(async err => {
      console.error('[plan-session] Background planning failed:', err.message);
      await supabase.from('planning_sessions').update({
        status: 'failed',
        current_phase: -1,
      }).eq('id', sessionId).catch(() => {});
    });

    res.json({ sessionId, tabs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Poll Session ─────────────────────────────────────────────────────────────

router.get('/api/companies/:id/plan-session/:sessionId', async (req, res) => {
  const { data: session } = await supabase.from('planning_sessions')
    .select('*').eq('id', req.params.sessionId).single();
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { data: tabs } = await supabase.from('planning_tabs')
    .select('*').eq('session_id', req.params.sessionId).order('sort_order');

  res.json({ session, tabs: tabs ?? [] });
});

// ── List Sessions ────────────────────────────────────────────────────────────

router.get('/api/companies/:id/plan-sessions', async (req, res) => {
  const { data } = await supabase.from('planning_sessions')
    .select('id, directive, project_size, status, current_phase, total_phases, cost_usd, created_at, approved_at')
    .eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  res.json(data ?? []);
});

// ── Approve Session ──────────────────────────────────────────────────────────

router.post('/api/plan-session/:id/approve', async (req, res) => {
  try {
    const { editedTabs } = req.body;
    const sessionId = req.params.id;

    const { data: session } = await supabase.from('planning_sessions')
      .select('*').eq('id', sessionId).single();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const s = session as any;

    // Save edited tab content
    if (editedTabs && typeof editedTabs === 'object') {
      for (const [tabKey, content] of Object.entries(editedTabs)) {
        await supabase.from('planning_tabs')
          .update({ content: content as string, status: 'edited', updated_at: new Date().toISOString() })
          .eq('session_id', sessionId).eq('tab_key', tabKey);
      }
    }

    const { data: tabs } = await supabase.from('planning_tabs')
      .select('tab_key, content, status').eq('session_id', sessionId).order('sort_order');

    const tabMap: Record<string, string> = {};
    for (const tab of (tabs ?? []) as any[]) {
      tabMap[tab.tab_key] = tab.content;
    }

    // 1. Write tabs to project_plans
    const planTypeMap: Record<string, { type: string; title: string }> = {
      overview: { type: 'summary', title: 'Project Summary' },
      implementation_plan: { type: 'master_plan', title: 'Master Execution Plan' },
      hiring_plan: { type: 'hiring_plan', title: 'Hiring Plan' },
    };

    for (const [tabKey, planInfo] of Object.entries(planTypeMap)) {
      if (!tabMap[tabKey]) continue;
      const { data: existing } = await supabase.from('project_plans')
        .select('id').eq('company_id', s.company_id).eq('type', planInfo.type).limit(1);

      if (existing?.length) {
        await supabase.from('project_plans').update({
          content: tabMap[tabKey], updated_at: new Date().toISOString(),
          status: 'approved', author_type: 'ceo',
        } as any).eq('id', (existing[0] as any).id);
      } else {
        await supabase.from('project_plans').insert({
          company_id: s.company_id, type: planInfo.type, title: planInfo.title,
          content: tabMap[tabKey], status: 'approved', author_type: 'ceo',
        } as any);
      }
    }

    // 2. Auto-hire from hiring_plan tab
    const hiredRoles: string[] = [];
    const hiringContent = tabMap.hiring_plan ?? '';
    const hireLines = hiringContent.split('\n')
      .filter((l: string) => l.startsWith('|') && !l.includes('---') && !l.toLowerCase().includes('role'));

    for (const line of hireLines) {
      const cols = line.split('|').map((c: string) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        const deptSlugOrRole = cols[0];
        const roleName = cols[1] ?? deptSlugOrRole;
        const budget = parseFloat((cols[3] || cols[2] || '$10').replace('$', '')) || 10;

        // Try to resolve from department role preset first
        const deptRole = await presetRegistry.getDeptRole(deptSlugOrRole)
          ?? await presetRegistry.getDeptRoleForLegacy(deptSlugOrRole);

        const effectiveRole = deptRole ? deptRole.short_name : roleName;

        const { data: existing } = await supabase.from('agents')
          .select('id').eq('company_id', s.company_id).eq('role', effectiveRole);
        if (existing?.length) continue;

        // Pick name from legacy pool or generate from role
        const namePool = AUTO_NAMES[effectiveRole] ?? AUTO_NAMES[deptSlugOrRole] ?? ['Agent'];
        const { data: allAgents } = await supabase.from('agents')
          .select('id, tile_col, tile_row, role, name').eq('company_id', s.company_id);
        const usedNames = new Set((allAgents ?? []).map((a: any) => a.name));
        const agentName = namePool.find(n => !usedNames.has(n))
          ?? `${effectiveRole} ${Math.floor(Math.random() * 900 + 100)}`;

        const used = new Set((allAgents ?? []).map((a: any) => `${a.tile_col},${a.tile_row}`));
        const desk = DESK_POSITIONS_PLAN.find(d => !used.has(`${d.col},${d.row}`)) ?? { col: 5, row: 15 };
        const ceo = (allAgents as any[])?.find?.((a: any) => a.role === 'CEO');

        const { data: hiredAgent } = await supabase.from('agents').insert({
          company_id: s.company_id, name: agentName, role: effectiveRole,
          color: deptRole?.color ?? ROLE_COLORS[effectiveRole] ?? '#6a7a90',
          sprite_index: deptRole?.sprite_index ?? ROLE_SPRITES[effectiveRole] ?? 0,
          tile_col: desk.col, tile_row: desk.row,
          system_prompt: deptRole?.system_prompt ?? DEFAULT_SYSTEM_PROMPTS[effectiveRole] ?? `You are a ${effectiveRole}.`,
          skills: deptRole?.default_skills ?? DEFAULT_SKILLS[effectiveRole] ?? [],
          budget_limit: budget, reports_to: ceo?.id ?? null, memory: {},
          dept_role_id: deptRole?.id ?? null,
          department: deptRole?.name ?? null,
        } as any).select().single();

        if (hiredAgent) {
          hiredRoles.push(effectiveRole);
          const deptLabel = deptRole ? ` [${deptRole.name}]` : '';
          await supabase.from('activity_log').insert({
            company_id: s.company_id, type: 'agent-hired',
            message: `Auto-hired ${agentName} as ${effectiveRole}${deptLabel} (from planning session)`,
          });
          initAgentBrain(s.company_id, (hiredAgent as any).id).catch(e =>
            console.error('[plan-session-hire] brain init error:', e.message)
          );
        }
      }
    }

    // 3. Create sprint + tickets from implementation_plan
    const implContent = tabMap.implementation_plan ?? '';
    const phases = parseMasterPlanPhases(implContent);

    const ticketIds: string[] = [];
    const ticketsByRole: Record<string, string[]> = {};

    if (phases.length > 0) {
      const { data: sprint } = await supabase.from('sprints').insert({
        company_id: s.company_id, name: 'Sprint 1',
        goal: phases[0]?.title ?? 'Phase 1', status: 'planning',
      } as any).select().single();

      if (sprint) {
        const { data: agents } = await supabase.from('agents')
          .select('id, role').eq('company_id', s.company_id);
        const workers = (agents ?? []).filter((a: any) => (a.role as string).toLowerCase() !== 'ceo');

        const firstPhaseTasks = phases[0]?.tasks ?? [];
        for (let i = 0; i < firstPhaseTasks.length; i++) {
          const taskText = firstPhaseTasks[i];
          const taskLower = taskText.toLowerCase();

          const roleMatch = taskText.match(/\(Role:\s*(\w[\w\s-]*?)\)/i);
          let agent = roleMatch
            ? workers.find((a: any) => {
                const role = (a.role as string).toLowerCase();
                const matched = roleMatch[1].toLowerCase().trim();
                return matched.includes(role) || role.includes(matched);
              })
            : null;

          if (!agent) {
            const prefixMatch = taskText.match(/^(\w[\w\s-]*?):\s/);
            agent = prefixMatch
              ? workers.find((a: any) => {
                  const role = (a.role as string).toLowerCase();
                  const prefix = prefixMatch[1].toLowerCase().trim();
                  return prefix.includes(role) || role.includes(prefix);
                })
              : null;
          }

          if (!agent) agent = workers.find((a: any) => taskLower.includes((a.role as string).toLowerCase())) ?? null;
          if (!agent && workers.length > 0) agent = workers[i % workers.length];

          const { data: ticket } = await supabase.from('tickets').insert({
            company_id: s.company_id, agent_id: (agent as any)?.id ?? null,
            title: taskText.replace(/\(Role:\s*\w[\w\s-]*?\)/i, '').trim(),
            status: 'awaiting_approval', sprint_id: (sprint as any).id,
            board_column: 'todo', story_points: 1, priority: i,
            dependency_status: 'ready',
          } as any).select('id').single();

          if (ticket) {
            const tid = (ticket as any).id;
            ticketIds.push(tid);
            const roleName = (agent as any)?.role ?? 'Unassigned';
            if (!ticketsByRole[roleName]) ticketsByRole[roleName] = [];
            ticketsByRole[roleName].push(tid);
          }
        }

        // 4. Create auto-inferred dependencies
        try {
          await createRoleDependencies(ticketsByRole);
        } catch (depErr: any) {
          console.warn('[plan-session] Auto-dependency creation failed:', depErr.message);
        }
      }
    }

    // 5. Update session status
    await supabase.from('planning_sessions').update({
      status: 'approved', approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', sessionId);

    await supabase.from('activity_log').insert({
      company_id: s.company_id, type: 'goal-assigned',
      message: `Planning session approved. Hired: ${hiredRoles.join(', ') || 'none'}. Tickets: ${ticketIds.length}`,
    });

    await supabase.from('notifications').insert({
      company_id: s.company_id, type: 'system',
      title: 'Planning session approved',
      message: `${hiredRoles.length} agents hired, ${ticketIds.length} tickets created with dependencies.`,
      link: `/company/${s.company_id}/board`,
    });

    // 6. Persist to brain vault
    persistPlanToBrain(s.company_id, sessionId).catch(e =>
      console.error('[plan-session/approve] Brain persistence failed:', e.message)
    );
    if (ticketIds.length > 0) {
      persistDependencyGraph(s.company_id, 'Sprint 1').catch(e =>
        console.error('[plan-session/approve] Dep graph persistence failed:', e.message)
      );
    }

    res.json({
      success: true, hired: hiredRoles,
      ticketsCreated: ticketIds.length,
      dependenciesCreated: Object.keys(ticketsByRole).length > 1,
    });
  } catch (err: any) {
    console.error('[plan-session/approve] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Replan Tab ───────────────────────────────────────────────────────────────

router.post('/api/plan-session/:id/replan', async (req, res) => {
  try {
    const { tabKey, editedTabs } = req.body;

    const { data: session } = await supabase.from('planning_sessions')
      .select('company_id, directive').eq('id', req.params.id).single();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const cwd = await getCompanyCwd((session as any).company_id).catch(() => process.cwd());

    replanTab(req.params.id, tabKey ?? 'overview', editedTabs ?? {}, cwd).catch(err =>
      console.error('[plan-session/replan] Background replan failed:', err.message)
    );

    res.json({ success: true, message: 'Re-planning started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
