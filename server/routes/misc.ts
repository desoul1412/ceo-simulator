import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { processNextTask, getQueueStatus } from '../taskProcessor';
import { processNextTicket, getTicketQueueStatus } from '../ticketProcessor';
import { listWorktrees } from '../worktreeManager';
import { getCompanyCwd } from '../repoManager';
import { retryDeadLetter, resolveDeadLetter } from '../circuitBreaker';

const router = Router();

// ── Health Check ─────────────────────────────────────────────────────────────

router.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: { supabase: !!process.env.SUPABASE_URL, agentSdk: true },
  });
});

// ── Task Queue ───────────────────────────────────────────────────────────────

router.get('/api/tasks/:companyId', async (req, res) => {
  const { data, error } = await supabase.from('task_queue')
    .select('*').eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/api/process-queue', async (req, res) => {
  try {
    const companyId = req.body?.companyId;
    const cwd = companyId ? await getCompanyCwd(companyId) : process.cwd();
    const result = await processNextTask(cwd);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/queue-status/:companyId', async (req, res) => {
  try {
    const status = await getQueueStatus(req.params.companyId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Token Usage / Costs ──────────────────────────────────────────────────────

router.get('/api/costs/:companyId', async (req, res) => {
  const { data, error } = await supabase.from('token_usage')
    .select('*').eq('company_id', req.params.companyId)
    .order('invoked_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  const total = (data ?? []).reduce((sum: number, r: any) => sum + (r.cost_usd ?? 0), 0);
  res.json({ entries: data, totalCostUsd: total });
});

// ── Worktrees ────────────────────────────────────────────────────────────────

router.get('/api/worktrees', (_req, res) => {
  const worktrees = listWorktrees(process.cwd());
  res.json({ worktrees });
});

// ── Dead Letter Queue ────────────────────────────────────────────────────────

router.get('/api/companies/:id/dead-letter-queue', async (req, res) => {
  const { data } = await supabase.from('dead_letter_queue')
    .select('*, tickets(title, agent_id)')
    .eq('company_id', req.params.id)
    .order('escalated_at', { ascending: false });
  res.json(data ?? []);
});

router.post('/api/dead-letter/:id/retry', async (req, res) => {
  const ok = await retryDeadLetter(req.params.id);
  res.json({ success: ok });
});

router.post('/api/dead-letter/:id/resolve', async (req, res) => {
  const { resolution } = req.body;
  const ok = await resolveDeadLetter(req.params.id, resolution ?? 'manual');
  res.json({ success: ok });
});

export default router;
