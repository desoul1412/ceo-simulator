import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import {
  checkSprintCompletion, updateCompanyBrainSummary, parseMasterPlanPhases,
} from '../helpers/brain';

const router = Router();

router.get('/api/companies/:id/sprints', async (req, res) => {
  const { data, error } = await supabase.from('sprints')
    .select('*').eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/api/companies/:id/sprints', async (req, res) => {
  const { name, goal, start_date, end_date } = req.body;
  const { data, error } = await supabase.from('sprints')
    .insert({ company_id: req.params.id, name, goal, start_date, end_date })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/api/sprints/:id', async (req, res) => {
  const updates: any = {};
  for (const key of ['name', 'goal', 'start_date', 'end_date', 'status']) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase.from('sprints')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/api/sprints/:id/tickets', async (req, res) => {
  const { data, error } = await supabase.from('tickets')
    .select('*').eq('sprint_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Sprint Manual Completion ────────────────────────────────────────────────

router.post('/api/sprints/:id/complete', async (req, res) => {
  try {
    const { data: sprint } = await supabase.from('sprints').select('*').eq('id', req.params.id).single();
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    await checkSprintCompletion(req.params.id);

    const { data: updated } = await supabase.from('sprints').select('status').eq('id', req.params.id).single();
    if ((updated as any)?.status !== 'completed') {
      await supabase.from('sprints').update({ status: 'completed' }).eq('id', req.params.id);

      const s = sprint as any;
      await supabase.from('activity_log').insert({
        company_id: s.company_id, type: 'status-change',
        message: `Sprint "${s.name}" manually completed`,
      });
      await supabase.from('notifications').insert({
        company_id: s.company_id, type: 'system',
        title: `Sprint completed: ${s.name}`,
        message: `Sprint "${s.name}" was manually completed.`,
        link: `/company/${s.company_id}/board`,
      });

      await updateCompanyBrainSummary(s.company_id);

      // Create next sprint from master plan
      const { data: plans } = await supabase.from('project_plans')
        .select('*').eq('company_id', s.company_id).eq('type', 'master_plan').eq('status', 'approved')
        .order('created_at', { ascending: false }).limit(1);

      if (plans && plans.length > 0) {
        const masterPlan = plans[0] as any;
        const phases = parseMasterPlanPhases(masterPlan.content);

        const { data: existingSprints } = await supabase.from('sprints')
          .select('id').eq('company_id', s.company_id);

        const nextSprintNumber = (existingSprints ?? []).length + 1;
        const nextPhaseIndex = (existingSprints ?? []).length;

        if (nextPhaseIndex < phases.length) {
          const nextPhase = phases[nextPhaseIndex];
          const { data: newSprint } = await supabase.from('sprints').insert({
            company_id: s.company_id, name: `Sprint ${nextSprintNumber}`,
            goal: nextPhase.title, status: 'planning',
          } as any).select().single();

          if (newSprint) {
            const { data: agents } = await supabase.from('agents')
              .select('id, role').eq('company_id', s.company_id);
            const workers = (agents ?? []).filter((a: any) => (a.role as string).toLowerCase() !== 'ceo');

            for (let i = 0; i < nextPhase.tasks.length; i++) {
              const taskText = nextPhase.tasks[i];
              const taskLower = taskText.toLowerCase();
              const prefixMatch = taskText.match(/^(\w[\w\s-]*?):\s/);
              let agent = prefixMatch
                ? workers.find((a: any) => {
                    const role = (a.role as string).toLowerCase();
                    const prefix = prefixMatch[1].toLowerCase().trim();
                    return prefix.includes(role) || role.includes(prefix);
                  })
                : null;
              if (!agent) agent = workers.find((a: any) => taskLower.includes((a.role as string).toLowerCase())) ?? null;
              if (!agent && workers.length > 0) agent = workers[i % workers.length];

              await supabase.from('tickets').insert({
                company_id: s.company_id, agent_id: (agent as any)?.id ?? null,
                title: taskText, status: 'open', sprint_id: (newSprint as any).id,
                board_column: 'todo', story_points: 1, priority: i,
              } as any);
            }

            await supabase.from('notifications').insert({
              company_id: s.company_id, type: 'system',
              title: `Sprint ${nextSprintNumber} auto-created`,
              message: `${nextPhase.tasks.length} tickets from "${nextPhase.title}"`,
              link: `/company/${s.company_id}/board`,
            });
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
