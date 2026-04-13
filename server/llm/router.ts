/**
 * LLM Router — tries models in priority order with fallback.
 * Respects role-based constraints: code tasks → SDK providers only.
 */

import { getRoutingChain, getProviderById } from './registry';
import { requiresFilesystem } from './types';
import type { LLMAdapter, LLMModel, LLMRequest, LLMResponse } from './types';
import { ClaudeSdkAdapter } from './adapters/claude-sdk';
import { ClaudeApiAdapter } from './adapters/claude-api';
import { OpenRouterAdapter } from './adapters/openrouter';
import { GeminiAdapter } from './adapters/gemini';
import { QwenCodeAdapter } from './adapters/qwen-code';

// Adapter registry — maps provider slug to adapter instance
const adapters = new Map<string, LLMAdapter>();
adapters.set('claude-sdk', new ClaudeSdkAdapter());
adapters.set('claude-api', new ClaudeApiAdapter());
adapters.set('openrouter', new OpenRouterAdapter());
adapters.set('gemini', new GeminiAdapter());
adapters.set('qwen-code', new QwenCodeAdapter());

/** Register a custom adapter at runtime */
export function registerAdapter(slug: string, adapter: LLMAdapter): void {
  adapters.set(slug, adapter);
}

/** Get adapter for a provider (does NOT mutate the model object) */
async function getAdapter(model: LLMModel): Promise<{ adapter: LLMAdapter; provider: LLMProvider } | null> {
  const provider = model.provider ?? (model.provider_id ? await getProviderById(model.provider_id) ?? undefined : undefined);
  if (!provider) return null;
  const adapter = adapters.get(provider.slug);
  if (!adapter) return null;
  return { adapter, provider };
}

/**
 * Route and execute an LLM request.
 *
 * 1. Get routing chain for agent (cascade: agent → company → global)
 * 2. Filter by constraint (code tasks → SDK only)
 * 3. Try each model in priority order
 * 4. On failure → try next model
 * 5. Return result + which model/provider was used
 */
export async function routeAndExecute(
  agentId: string | null,
  companyId: string | null,
  request: LLMRequest,
  context: { role: string; task: string },
  preloadedChain?: LLMModel[],
): Promise<LLMResponse> {
  const chain = preloadedChain ?? await getRoutingChain(agentId, companyId);

  if (chain.length === 0) {
    throw new Error('[llm-router] No routing chain configured. Run the 013_llm_providers.sql migration and seed defaults.');
  }

  const needsFs = requiresFilesystem(context.role, context.task);

  // Filter chain: if task needs filesystem, only SDK providers
  const sdkOnly = (m: LLMModel) => m.provider?.provider_type === 'sdk';
  let eligible = needsFs ? chain.filter(sdkOnly) : chain;

  if (eligible.length === 0) {
    if (needsFs) {
      throw new Error(`[llm-router] Task requires filesystem access (role: ${context.role}) but no SDK providers in routing chain.`);
    }
    throw new Error('[llm-router] Routing chain is empty after filtering.');
  }

  const errors: string[] = [];

  for (const model of eligible) {
    const resolved = await getAdapter(model);
    if (!resolved) {
      errors.push(`No adapter for provider: ${model.provider?.slug ?? 'unknown'}`);
      continue;
    }

    try {
      console.log(`[llm-router] Trying ${model.name} (${resolved.provider.slug}) for "${context.task.slice(0, 50)}..."`);
      const response = await resolved.adapter.execute(model, request);
      console.log(`[llm-router] Success: ${model.name} — $${response.costUsd.toFixed(4)}`);
      return response;
    } catch (err: any) {
      const errMsg = `${model.name} (${resolved.provider.slug}): ${err.message}`;
      console.warn(`[llm-router] Failed: ${errMsg}`);
      errors.push(errMsg);
    }
  }

  throw new Error(`[llm-router] All models failed:\n${errors.join('\n')}`);
}

/**
 * Simple single-model execution (bypasses routing).
 * Used when caller already knows which model to use.
 */
export async function executeWithModel(
  model: LLMModel,
  request: LLMRequest,
): Promise<LLMResponse> {
  const adapter = await getAdapter(model);
  if (!adapter) throw new Error(`No adapter for provider: ${model.provider?.slug}`);
  return adapter.execute(model, request);
}
