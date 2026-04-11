import { getClient } from './db';
import type { Config } from './types';

const db = () => getClient();

export async function getConfigs(scope: string, scopeId: string, type?: string) {
  let q = db().from('configs')
    .select('*')
    .eq('scope', scope)
    .eq('scope_id', scopeId);
  if (type) q = q.eq('type', type);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getMergedConfigs(companyId: string, agentId?: string) {
  // 3-level cascade: global → company → agent
  const { data: globalConfigs } = await db().from('configs')
    .select('*').eq('scope', 'global');
  const { data: companyConfigs } = await db().from('configs')
    .select('*').eq('scope', 'company').eq('scope_id', companyId);

  const merged = new Map<string, Config>();
  for (const c of (globalConfigs ?? [])) merged.set(c.key, c as Config);
  for (const c of (companyConfigs ?? [])) merged.set(c.key, c as Config);

  if (agentId) {
    const { data: agentConfigs } = await db().from('configs')
      .select('*').eq('scope', 'agent').eq('scope_id', agentId);
    for (const c of (agentConfigs ?? [])) merged.set(c.key, c as Config);
  }

  return Array.from(merged.values());
}

export async function createConfig(config: Partial<Config>) {
  const { data, error } = await db().from('configs').insert(config).select().single();
  if (error) throw error;
  return data as Config;
}

export async function updateConfig(id: string, updates: Partial<Config>) {
  const { data, error } = await db().from('configs').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Config;
}

export async function deleteConfig(id: string) {
  const { error } = await db().from('configs').delete().eq('id', id);
  if (error) throw error;
}
