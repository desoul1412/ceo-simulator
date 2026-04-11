import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { AUTO_NAMES, ROLE_COLORS, ROLE_SPRITES, DEFAULT_SYSTEM_PROMPTS, DEFAULT_SKILLS, DESK_POSITIONS_PLAN } from '../constants';
import { initAgentBrain } from '../helpers/brain';

const router = Router();

// ── Project Plans CRUD ───────────────────────────────────────────────────────

router.get('/api/companies/:id/plans', async (req, res) => {
  let query = supabase.from('project_plans').select('*').eq('company_id', req.params.id);
  if (req.query.type) query = query.eq('type', req.query.type as string);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/api/companies/:id/plans', async (req, res) => {
  const { type, title, content } = req.body;
  const { data, error } = await supabase.from('project_plans')
    .insert({ company_id: req.params.id, type, title, content }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/api/plans/:id', async (req, res) => {
  const { content, title } = req.body;
  const updates: any = {};
  if (content !== undefined) updates.content = content;
  if (title !== undefined) updates.title = title;
  const { data, error } = await supabase.from('project_plans')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Plan Comments ────────────────────────────────────────────────────────────

router.post('/api/plans/:id/comments', async (req, res) => {
  const { content, author } = req.body;
  const { data, error } = await supabase.from('plan_comments')
    .insert({ plan_id: req.params.id, content, author: author ?? 'CEO' }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/api/plans/:id/comments', async (req, res) => {
  const { data, error } = await supabase.from('plan_comments')
    .select('*').eq('plan_id', req.params.id).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Plan Approve (with autonomous execution triggers) ────────────────────────

router.post('/api/plans/:id/approve', async (req, res) => {
  const { data: plan, error } = await supabase.from('project_plans')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  const p = plan as any;

  await supabase.from('notifications').insert({
    company_id: p.company_id, type: 'plan_submitted',
    title: `Plan approved: ${p.title}`,
    message: `${p.type} plan "${p.title}" was approved`,
    link: `/company/${p.company_id}/overview`,
  });

  try {
    if (p.type === 'hiring_plan') {
      await _executeHiringPlan(p);
    }

    if (p.type === 'master_plan') {
      await _executeMasterPlan(p);
    }

    if (p.type === 'daily_plan') {
      const { data: pendingTickets } = await supabase.from('tickets')
        .select('id').eq('company_id', p.company_id).in('status', ['open', 'awaiting_approval']);

      await supabase.from('notifications').insert({
        company_id: p.company_id, type: 'ticket_approval',
        title: 'Daily plan approved — review tickets',
        message: `${(pendingTickets ?? []).length} tickets awaiting your review on the Board.`,
        link: `/company/${p.company_id}/board`,
      });
    }
  } catch (execErr: any) {
    console.error('[approve] Execution trigger error:', execErr.message);
  }

  res.json(plan);
});

// ── Internal: hiring plan execution ──────────────────────────────────────────

async function _executeHiringPlan(p: any) {
  const lines = (p.content as string).split('\n')
    .filter((l: string) => l.startsWith('|') && !l.includes('---') && !l.toLowerCase().includes('role'));

  for (const line of lines) {
    const cols = line.split('|').map((c: string) => c.trim()).filter(Boolean);
    if (cols.length >= 2) {
      const role = cols[0];
      const budget = parseFloat((cols[2] || '$10').replace('$', '')) || 10;

      const { data: existing } = await supabase
        .from('agents').select('id').eq('company_id', p.company_id).eq('role', role);
      if (existing?.length) continue;

      const namePool = AUTO_NAMES[role] ?? ['Agent'];
      const agentName = namePool[Math.floor(Math.random() * namePool.length)];

      const { data: allAgents } = await supabase.from('agents')
        .select('tile_col, tile_row, role, id').eq('company_id', p.company_id);
      const used = new Set((allAgents ?? []).map((a: any) => `${a.tile_col},${a.tile_row}`));
      const desk = DESK_POSITIONS_PLAN.find(d => !used.has(`${d.col},${d.row}`)) ?? { col: 5, row: 15 };
      const ceo = (allAgents as any[])?.find?.((a: any) => a.role === 'CEO');

      const { data: hiredAgent } = await supabase.from('agents').insert({
        company_id: p.company_id, name: agentName, role,
        color: ROLE_COLORS[role] ?? '#6a7a90',
        sprite_index: ROLE_SPRITES[role] ?? 0,
        tile_col: desk.col, tile_row: desk.row,
        system_prompt: DEFAULT_SYSTEM_PROMPTS[role] ?? `You are a ${role}.`,
        skills: DEFAULT_SKILLS[role] ?? [],
        budget_limit: budget, reports_to: ceo?.id ?? null, memory: {},
      } as any).select().single();

      await supabase.from('activity_log').insert({
        company_id: p.company_id, type: 'agent-hired',
        message: `Auto-hired ${agentName} as ${role} (from approved hiring plan)`,
      });

      if (hiredAgent) {
        initAgentBrain(p.company_id, (hiredAgent as any).id).catch(e =>
          console.error('[plan-hire-hook] brain init error:', e.message)
        );
      }
    }
  }

  await supabase.from('notifications').insert({
    company_id: p.company_id, type: 'system',
    title: 'Agents hired from plan',
    message: 'Hiring plan approved — agents auto-hired.',
    link: `/company/${p.company_id}/agents`,
  });
}

async function _executeMasterPlan(p: any) {
  const phases = (p.content as string).match(/###\s+(.+)/g) ?? [];
  const tasks = (p.content as string).match(/- \[ \]\s+(.+)/g) ?? [];

  if (phases.length === 0 && tasks.length === 0) return;

  const { data: sprint } = await supabase.from('sprints').insert({
    company_id: p.company_id, name: 'Sprint 1',
    goal: phases[0]?.replace('### ', '') ?? 'Phase 1', status: 'planning',
  } as any).select().single();

  if (sprint && tasks.length > 0) {
    const { data: agents } = await supabase.from('agents')
      .select('id, role').eq('company_id', p.company_id);
    const workers = (agents ?? []).filter((a: any) => (a.role as string).toLowerCase() !== 'ceo');

    for (let i = 0; i < tasks.length; i++) {
      const taskText = tasks[i].replace(/- \[ \]\s+/, '');
      const taskLower = taskText.toLowerCase();

      const prefixMatch = taskText.match(/^(\w[\w\s-]*?):\s/);
      let agent = prefixMatch
        ? workers.find((a: any) => {
            const role = (a.role as string).toLowerCase();
            const prefix = prefixMatch[1].toLowerCase().trim();
            return prefix.includes(role) || role.includes(prefix)
              || prefix.replace(/[-\s]/g, '').includes(role.replace(/[-\s]/g, ''));
          })
        : null;

      if (!agent) {
        agent = workers.find((a: any) => taskLower.includes((a.role as string).toLowerCase())) ?? null;
      }
      if (!agent && workers.length > 0) agent = workers[i % workers.length];

      await supabase.from('tickets').insert({
        company_id: p.company_id, agent_id: (agent as any)?.id ?? null,
        title: taskText, status: 'open', sprint_id: (sprint as any).id,
        board_column: 'todo', story_points: 1, priority: i,
      } as any);
    }
  }

  await supabase.from('notifications').insert({
    company_id: p.company_id, type: 'system',
    title: 'Sprint created from master plan',
    message: `Sprint 1 created with ${tasks.length} tickets.`,
    link: `/company/${p.company_id}/board`,
  });
}

export default router;
