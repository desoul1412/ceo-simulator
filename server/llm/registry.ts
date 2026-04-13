/**
 * LLM Registry — loads providers + models from Supabase, caches in memory.
 * Resolves routing chains for agents with cascade: agent → company → global.
 */

import { supabase } from '../supabaseAdmin';
import type { LLMProvider, LLMModel } from './types';

let cachedProviders: LLMProvider[] | null = null;
let cachedModels: LLMModel[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

function isCacheValid(): boolean {
  return cachedProviders !== null && Date.now() - cacheTime < CACHE_TTL;
}

export function invalidateCache(): void {
  cachedProviders = null;
  cachedModels = null;
  cacheTime = 0;
}

export async function getProviders(): Promise<LLMProvider[]> {
  if (isCacheValid() && cachedProviders) return cachedProviders;
  try {
    const { data, error } = await supabase.from('llm_providers').select('*').eq('is_active', true);
    if (error) { console.warn('[llm-registry] Failed to load providers:', error.message); return []; }
    cachedProviders = (data ?? []) as LLMProvider[];
    cacheTime = Date.now();
    return cachedProviders;
  } catch {
    return [];
  }
}

export async function getModels(): Promise<LLMModel[]> {
  if (isCacheValid() && cachedModels) return cachedModels;
  try {
    const { data, error } = await supabase
      .from('llm_models')
      .select('*, provider:llm_providers(*)')
      .eq('is_active', true);
    if (error) { console.warn('[llm-registry] Failed to load models:', error.message); return []; }
    cachedModels = (data ?? []).map((m: any) => ({
      ...m,
      provider: m.provider ?? undefined,
    })) as LLMModel[];
    cacheTime = Date.now();
    return cachedModels;
  } catch {
    return [];
  }
}

export async function getModelById(modelId: string): Promise<LLMModel | null> {
  const models = await getModels();
  return models.find(m => m.id === modelId) ?? null;
}

export async function getProviderById(providerId: string): Promise<LLMProvider | null> {
  const providers = await getProviders();
  return providers.find(p => p.id === providerId) ?? null;
}

/**
 * Get the routing chain for an agent.
 * Cascade: agent-specific → company default → global default.
 * Returns models sorted by priority (lowest first = try first).
 */
export async function getRoutingChain(
  agentId: string | null,
  companyId: string | null,
): Promise<LLMModel[]> {
  try {
    // 1. Try agent-specific routing
    if (agentId) {
      const { data } = await supabase
        .from('agent_model_routing')
        .select('model_id, priority')
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .order('priority', { ascending: true });
      if (data && data.length > 0) {
        return resolveModels(data as any[]);
      }
    }

    // 2. Try company default
    if (companyId) {
      const { data } = await supabase
        .from('agent_model_routing')
        .select('model_id, priority')
        .is('agent_id', null)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('priority', { ascending: true });
      if (data && data.length > 0) {
        return resolveModels(data as any[]);
      }
    }

    // 3. Global default
    const { data } = await supabase
      .from('agent_model_routing')
      .select('model_id, priority')
      .is('agent_id', null)
      .is('company_id', null)
      .eq('is_active', true)
      .order('priority', { ascending: true });
    if (data && data.length > 0) {
      return resolveModels(data as any[]);
    }

    return [];
  } catch {
    return [];
  }
}

async function resolveModels(routing: { model_id: string; priority: number }[]): Promise<LLMModel[]> {
  const models = await getModels();
  const result: LLMModel[] = [];
  for (const r of routing) {
    const model = models.find(m => m.id === r.model_id);
    if (model) result.push(model);
  }
  return result;
}
