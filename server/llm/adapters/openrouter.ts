/**
 * OpenRouter Adapter — OpenAI-compatible API supporting many models.
 * Text-in/text-out (no filesystem access).
 */

import type { LLMAdapter, LLMModel, LLMRequest, LLMResponse } from '../types';

export class OpenRouterAdapter implements LLMAdapter {
  readonly providerType = 'http';

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const provider = model.provider;
    const apiKey = provider?.config?.api_key;
    const baseUrl = provider?.config?.base_url ?? 'https://openrouter.ai/api/v1';

    if (!apiKey) throw new Error('OpenRouter: missing api_key in provider config');

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ceo-simulator.app',
        'X-Title': 'CEO Simulator',
      },
      body: JSON.stringify({
        model: model.model_id,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const output = data.choices?.[0]?.message?.content ?? '';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const costIn = inputTokens * (model.cost_per_1k_input ?? 0.001) / 1000;
    const costOut = outputTokens * (model.cost_per_1k_output ?? 0.002) / 1000;

    return {
      output,
      costUsd: costIn + costOut,
      inputTokens,
      outputTokens,
      sessionId: data.id ?? '',
      modelUsed: model.model_id,
      providerUsed: 'openrouter',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
