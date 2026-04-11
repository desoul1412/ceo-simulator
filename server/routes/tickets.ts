import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { getTicketQueueStatus } from '../ticketProcessor';
import { checkSprintCompletion, updateAgentMemory } from '../helpers/brain';
import { addDependency, removeDependency, getBlockers, getDependents, getDependencyGraph } from '../dependencyManager';

const router = Router();

// ── List Tickets ─────────────────────────────────────────────────────────────

router.get('/api/tickets/:companyId', async (req, res) => {
  const { data, error } = await supabase.from('tickets')
    .select('*, ticket_comments(id, author_type, content, created_at)')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/api/ticket-status/:companyId', async (req, res) => {
  const status = await getTicketQueueStatus(req.params.companyId);
  res.json(status);
});

// ── Approval Gates ───────────────────────────────────────────────────────────

router.post('/api/approve/:ticketId', async (req, res) => {
  const { data, error } = await supabase.from('tickets')
    .update({
      status: 'approved',
      approved_by: req.body?.approvedBy ?? 'CEO (human)',
      approved_at: new Date().toISOString(),
    })
    .eq('id', req.params.ticketId)
    .eq('status', 'awaiting_approval')
    .select().single();

  if (error || !data) return res.status(404).json({ error: 'Ticket not found or not awaiting approval' });

  await supabase.from('ticket_comments').insert({
    ticket_id: req.params.ticketId, author_type: 'human',
    content: `Approved by ${req.body.approvedBy ?? 'CEO (human)'}`,
  });

  const t = data as any;
  if (t.agent_id) {
    await supabase.from('agents').update({ status: 'working', assigned_task: t.title }).eq('id', t.agent_id);
  }

  await supabase.from('audit_log').insert({
    company_id: t.company_id, agent_id: t.agent_id, ticket_id: t.id,
    event_type: 'approval', message: `Ticket approved: "${t.title}"`,
  });

  res.json({ success: true, ticket: data });
});

router.post('/api/reject/:ticketId', async (req, res) => {
  const { data, error } = await supabase.from('tickets')
    .update({ status: 'cancelled' }).eq('id', req.params.ticketId).select().single();
  if (error || !data) return res.status(404).json({ error: 'Ticket not found' });

  await supabase.from('ticket_comments').insert({
    ticket_id: req.params.ticketId, author_type: 'human',
    content: `Rejected: ${req.body.reason ?? 'No reason given'}`,
  });

  res.json({ success: true });
});

router.post('/api/approve-all/:companyId', async (req, res) => {
  const { data, error } = await supabase.from('tickets')
    .update({
      status: 'approved',
      approved_by: 'CEO (human) — bulk',
      approved_at: new Date().toISOString(),
    })
    .eq('company_id', req.params.companyId)
    .eq('status', 'awaiting_approval')
    .select();

  if (error) return res.status(500).json({ error: error.message });

  for (const t of (data ?? []) as any[]) {
    if (t.agent_id) {
      await supabase.from('agents').update({ status: 'working', assigned_task: t.title }).eq('id', t.agent_id);
    }
  }

  res.json({ success: true, approved: (data ?? []).length });
});

// ── Board Column ─────────────────────────────────────────────────────────────

router.patch('/api/tickets/:id/column', async (req, res) => {
  const { board_column } = req.body;
  if (!board_column) return res.status(400).json({ error: 'Missing board_column' });
  const { data, error } = await supabase.from('tickets')
    .update({ board_column }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const t = data as any;
  if (board_column === 'done' && t.sprint_id) {
    checkSprintCompletion(t.sprint_id).catch(e => console.error('[column-hook] sprint check error:', e.message));
    if (t.agent_id) {
      updateAgentMemory(t.company_id, t.agent_id, t.title).catch(e => console.error('[column-hook] memory error:', e.message));
    }
  }

  res.json(data);
});

// ── Ticket PATCH & Reject ────────────────────────────────────────────────────

router.patch('/api/tickets/:id', async (req, res) => {
  const allowed = ['title', 'description', 'story_points', 'board_column', 'sprint_id', 'agent_id'];
  const updates: any = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase.from('tickets').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const t = data as any;
  if (updates.board_column === 'done' && t.sprint_id) {
    checkSprintCompletion(t.sprint_id).catch(e => console.error('[ticket-patch-hook] sprint check error:', e.message));
    if (t.agent_id) {
      updateAgentMemory(t.company_id, t.agent_id, t.title).catch(e => console.error('[ticket-patch-hook] memory error:', e.message));
    }
  }

  res.json(data);
});

router.post('/api/tickets/:id/reject', async (req, res) => {
  const { data: ticket } = await supabase.from('tickets').select('sprint_id, company_id').eq('id', req.params.id).single();
  const { error } = await supabase.from('tickets').update({ status: 'cancelled', board_column: 'done' }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  if (ticket && (ticket as any).sprint_id) {
    checkSprintCompletion((ticket as any).sprint_id).catch(e =>
      console.error('[ticket-reject-hook] sprint check error:', e.message)
    );
  }

  res.json({ success: true });
});

// ── Dependencies ─────────────────────────────────────────────────────────────

router.post('/api/tickets/:id/dependencies', async (req, res) => {
  const { blocker_id, type } = req.body;
  if (!blocker_id) return res.status(400).json({ error: 'blocker_id is required' });
  const result = await addDependency(blocker_id, req.params.id, type ?? 'finish_to_start', 'manual');
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true, id: result.id });
});

router.delete('/api/dependencies/:depId', async (req, res) => {
  const ok = await removeDependency(req.params.depId);
  if (!ok) return res.status(500).json({ error: 'Failed to remove dependency' });
  res.json({ success: true });
});

router.get('/api/tickets/:id/dependencies', async (req, res) => {
  const [blockers, dependents] = await Promise.all([
    getBlockers(req.params.id), getDependents(req.params.id),
  ]);
  res.json({ blockers, dependents });
});

export default router;
