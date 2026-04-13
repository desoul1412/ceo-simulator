import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { invalidateCache } from '../llm/registry';

export const llmRouter = Router();

// ── Providers CRUD ──────────────────────────────────────────────────────────

llmRouter.get('/providers', async (_req, res) => {
  const { data, error } = await supabase.from('llm_providers').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

llmRouter.post('/providers', async (req, res) => {
  const { slug, name, provider_type, config } = req.body;
  if (!slug || !name || !provider_type) return res.status(400).json({ error: 'Missing slug, name, or provider_type' });
  const { data, error } = await supabase.from('llm_providers')
    .insert({ slug, name, provider_type, config: config ?? {} })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  invalidateCache();
  res.json(data);
});

llmRouter.patch('/providers/:id', async (req, res) => {
  const updates: any = {};
  for (const key of ['name', 'slug', 'provider_type', 'config', 'is_active']) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase.from('llm_providers')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  invalidateCache();
  res.json(data);
});

llmRouter.delete('/providers/:id', async (req, res) => {
  const { error } = await supabase.from('llm_providers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  invalidateCache();
  res.json({ success: true });
});

// ── Models CRUD ─────────────────────────────────────────────────────────────

llmRouter.get('/models', async (req, res) => {
  let query = supabase.from('llm_models').select('*, provider:llm_providers(id, slug, name, provider_type)');
  if (req.query.provider_id) query = query.eq('provider_id', req.query.provider_id as string);
  const { data, error } = await query.order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

llmRouter.post('/models', async (req, res) => {
  const { provider_id, slug, name, model_id, tier, cost_per_1k_input, cost_per_1k_output, max_context_tokens, supports_tools } = req.body;
  if (!provider_id || !slug || !name || !model_id) return res.status(400).json({ error: 'Missing required fields' });
  const { data, error } = await supabase.from('llm_models')
    .insert({ provider_id, slug, name, model_id, tier: tier ?? 'mid', cost_per_1k_input, cost_per_1k_output, max_context_tokens, supports_tools: supports_tools ?? true })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  invalidateCache();
  res.json(data);
});

llmRouter.patch('/models/:id', async (req, res) => {
  const updates: any = {};
  for (const key of ['name', 'slug', 'model_id', 'tier', 'cost_per_1k_input', 'cost_per_1k_output', 'max_context_tokens', 'supports_tools', 'is_active']) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase.from('llm_models')
    .update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  invalidateCache();
  res.json(data);
});

llmRouter.delete('/models/:id', async (req, res) => {
  const { error } = await supabase.from('llm_models').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  invalidateCache();
  res.json({ success: true });
});

// ── Routing CRUD ────────────────────────────────────────────────────────────

// Global default
llmRouter.get('/routing/global', async (_req, res) => {
  const { data, error } = await supabase.from('agent_model_routing')
    .select('*, model:llm_models(*, provider:llm_providers(id, slug, name))')
    .is('agent_id', null).is('company_id', null)
    .eq('is_active', true).order('priority');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

llmRouter.put('/routing/global', async (req, res) => {
  const { models } = req.body; // [{ model_id, priority }]
  if (!Array.isArray(models)) return res.status(400).json({ error: 'models array required' });
  const { error: delErr } = await supabase.from('agent_model_routing').delete().is('agent_id', null).is('company_id', null);
  if (delErr) return res.status(500).json({ error: delErr.message });
  if (models.length > 0) {
    const rows = models.map((m: any, i: number) => ({
      agent_id: null, company_id: null, model_id: m.model_id, priority: m.priority ?? i,
    }));
    const { error: insErr } = await supabase.from('agent_model_routing').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }
  invalidateCache();
  res.json({ success: true });
});

// Company default
llmRouter.get('/routing/company/:companyId', async (req, res) => {
  const { data, error } = await supabase.from('agent_model_routing')
    .select('*, model:llm_models(*, provider:llm_providers(id, slug, name))')
    .is('agent_id', null).eq('company_id', req.params.companyId)
    .eq('is_active', true).order('priority');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

llmRouter.put('/routing/company/:companyId', async (req, res) => {
  const { models } = req.body;
  if (!Array.isArray(models)) return res.status(400).json({ error: 'models array required' });
  const { error: delErr } = await supabase.from('agent_model_routing').delete().is('agent_id', null).eq('company_id', req.params.companyId);
  if (delErr) return res.status(500).json({ error: delErr.message });
  if (models.length > 0) {
    const rows = models.map((m: any, i: number) => ({
      agent_id: null, company_id: req.params.companyId, model_id: m.model_id, priority: m.priority ?? i,
    }));
    const { error: insErr } = await supabase.from('agent_model_routing').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }
  invalidateCache();
  res.json({ success: true });
});

// Per-agent
llmRouter.get('/routing/agent/:agentId', async (req, res) => {
  const { data, error } = await supabase.from('agent_model_routing')
    .select('*, model:llm_models(*, provider:llm_providers(id, slug, name))')
    .eq('agent_id', req.params.agentId)
    .eq('is_active', true).order('priority');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

llmRouter.put('/routing/agent/:agentId', async (req, res) => {
  const { models } = req.body;
  if (!Array.isArray(models)) return res.status(400).json({ error: 'models array required' });
  const { error: delErr } = await supabase.from('agent_model_routing').delete().eq('agent_id', req.params.agentId);
  if (delErr) return res.status(500).json({ error: delErr.message });
  if (models.length > 0) {
    const rows = models.map((m: any, i: number) => ({
      agent_id: req.params.agentId, company_id: null, model_id: m.model_id, priority: m.priority ?? i,
    }));
    const { error: insErr } = await supabase.from('agent_model_routing').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }
  invalidateCache();
  res.json({ success: true });
});
