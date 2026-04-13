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

/** Get adapter for a provider */
async function getAdapter(model: LLMModel): Promise<LLMAdapter | null> {
  // Ensure model has provider loaded
  if (!model.provider && model.provider_id) {
    model.provider = (await getProviderById(model.provider_id)) ?? undefined;
  }
  const providerSlug = model.provider?.slug;
  if (!providerSlug) return null;
  return adapters.get(providerSlug) ?? null;
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
): Promise<LLMResponse> {
  const chain = await getRoutingChain(agentId, companyId);

  if (chain.length === 0) {
    throw new Error('[llm-router] No routing chain configured. Run the 013_llm_providers.sql migration and seed defaults.');
  }

  const needsFs = requiresFilesystem(context.role, context.task);

  // Filter chain: if task needs filesystem, only SDK providers
  const eligible = chain.filter(m => {
    if (!needsFs) return true;
    return m.provider?.provider_type === 'sdk';
  });

  if (eligible.length === 0) {
    // Fallback: if no eligible models but chain exists, try SDK models from full chain
    const sdkModels = chain.filter(m => m.provider?.provider_type === 'sdk');
    if (sdkModels.length > 0) {
      eligible.push(...sdkModels);
    } else {
      throw new Error(`[llm-router] Task requires filesystem access (role: ${context.role}) but no SDK providers in routing chain.`);
    }
  }

  const errors: string[] = [];

  for (const model of eligible) {
    const adapter = await getAdapter(model);
    if (!adapter) {
      errors.push(`No adapter for provider: ${model.provider?.slug ?? 'unknown'}`);
      continue;
    }

    try {
      console.log(`[llm-router] Trying ${model.name} (${model.provider?.slug}) for "${context.task.slice(0, 50)}..."`);
      const response = await adapter.execute(model, request);
      console.log(`[llm-router] Success: ${model.name} — $${response.costUsd.toFixed(4)}`);
      return response;
    } catch (err: any) {
      const errMsg = `${model.name} (${model.provider?.slug}): ${err.message}`;
      console.warn(`[llm-router] Failed: ${errMsg}`);
      errors.push(errMsg);
      // Continue to next model in chain
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
