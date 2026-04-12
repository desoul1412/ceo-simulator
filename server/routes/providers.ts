import { Router } from 'express';
import { providerRegistry } from '../providers/registry';
import type { ProviderConfig } from '../providers/types';
import { supabase } from '../supabaseAdmin';

const router = Router();

// ── List all registered providers with health status ─────────────────────────

router.get('/api/providers', async (_req, res) => {
  const providers = providerRegistry.list();
  const result = await Promise.all(
    providers.map(async (p) => ({
      name: p.name,
      enabled: p.config.enabled,
      priority: p.config.priority,
      healthy: await providerRegistry.isHealthy(p.name),
      haiku: p.getModelId('haiku'),
      sonnet: p.getModelId('sonnet'),
      opus: p.getModelId('opus'),
    }))
  );
  res.json(result);
});

// ── Get/Set provider configuration ───────────────────────────────────────────

router.get('/api/providers/config', async (_req, res) => {
  const { data } = await supabase
    .from('configs')
    .select('*')
    .eq('scope', 'global')
    .eq('type', 'llm_provider');
  res.json(data ?? []);
});

router.post('/api/providers/config', async (req, res) => {
  const { provider, modelOverrides, apiKey } = req.body;

  // Save provider preference
  if (provider) {
    await supabase.from('configs').upsert({
      scope: 'global',
      scope_id: 'system',
      type: 'llm_provider',
      key: 'preferred_provider',
      value: provider,
      enabled: true,
    }, { onConflict: 'scope,scope_id,type,key' });
  }

  // Save model overrides (custom model names per tier)
  if (modelOverrides) {
    for (const [tier, modelName] of Object.entries(modelOverrides)) {
      if (!modelName) continue;
      await supabase.from('configs').upsert({
        scope: 'global',
        scope_id: 'system',
        type: 'llm_provider',
        key: `model_${tier}`,
        value: modelName as string,
        enabled: true,
      }, { onConflict: 'scope,scope_id,type,key' });
    }
  }

  // Save API key (encrypted in production, plaintext for dev)
  if (apiKey && provider) {
    await supabase.from('configs').upsert({
      scope: 'global',
      scope_id: 'system',
      type: 'llm_provider',
      key: `${provider}_api_key`,
      value: apiKey,
      enabled: true,
    }, { onConflict: 'scope,scope_id,type,key' });
  }

  res.json({ success: true });
});

// ── Test provider connection ─────────────────────────────────────────────────

router.post('/api/providers/:name/test', async (req, res) => {
  const { name } = req.params;
  const provider = providerRegistry.get(name);
  if (!provider) {
    return res.status(404).json({ error: `Provider '${name}' not found` });
  }

  try {
    const healthy = await provider.isHealthy();
    res.json({ provider: name, healthy, message: healthy ? 'Connection OK' : 'Not reachable' });
  } catch (err: any) {
    res.json({ provider: name, healthy: false, message: err.message });
  }
});

export default router;
