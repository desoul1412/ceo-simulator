import { Router } from 'express';
import { supabase } from '../supabaseAdmin';

const router = Router();

router.get('/api/configs', async (req, res) => {
  const { scope, scope_id, type } = req.query;
  let query = supabase.from('configs').select('*').order('created_at', { ascending: true });
  if (scope) query = query.eq('scope', scope);
  if (scope_id) query = query.eq('scope_id', scope_id);
  if (type) query = query.eq('type', type);
  if (scope === 'global') query = query.is('scope_id', null);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/api/configs/effective/:agentId', async (req, res) => {
  const { data: agent } = await supabase.from('agents')
    .select('id, company_id').eq('id', req.params.agentId).single();
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const a = agent as any;

  const [globalRes, companyRes, agentRes] = await Promise.all([
    supabase.from('configs').select('*').eq('scope', 'global').is('scope_id', null),
    supabase.from('configs').select('*').eq('scope', 'company').eq('scope_id', a.company_id),
    supabase.from('configs').select('*').eq('scope', 'agent').eq('scope_id', a.id),
  ]);

  const merged = new Map<string, any>();
  for (const row of (globalRes.data ?? []) as any[]) {
    if (row.enabled) merged.set(`${row.type}:${row.key}`, row);
  }
  for (const row of (companyRes.data ?? []) as any[]) {
    if (row.enabled) merged.set(`${row.type}:${row.key}`, row);
    else merged.delete(`${row.type}:${row.key}`);
  }
  for (const row of (agentRes.data ?? []) as any[]) {
    if (row.enabled) merged.set(`${row.type}:${row.key}`, row);
    else merged.delete(`${row.type}:${row.key}`);
  }

  res.json(Array.from(merged.values()));
});

router.post('/api/configs', async (req, res) => {
  const { scope, scope_id, type, key, value, enabled } = req.body;
  if (!scope || !type || !key) {
    return res.status(400).json({ error: 'Missing scope, type, or key' });
  }
  const { data, error } = await supabase.from('configs')
    .insert({
      scope, scope_id: scope === 'global' ? null : scope_id,
      type, key, value: value ?? {}, enabled: enabled ?? true,
    }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/api/configs/:id', async (req, res) => {
  const updates: any = {};
  if (req.body.value !== undefined) updates.value = req.body.value;
  if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
  if (req.body.key !== undefined) updates.key = req.body.key;

  const { data, error } = await supabase.from('configs')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/api/configs/:id', async (req, res) => {
  const { error } = await supabase.from('configs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
