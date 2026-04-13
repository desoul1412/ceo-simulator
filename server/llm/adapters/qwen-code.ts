/**
 * QwenCode Adapter — supports QwenCode via OpenAI-compatible endpoint.
 * Can be: OpenRouter model, local Ollama, or qwen-code CLI.
 * Config: { base_url, api_key?, model_prefix? }
 */

import type { LLMAdapter, LLMModel, LLMRequest, LLMResponse } from '../types';

export class QwenCodeAdapter implements LLMAdapter {
  readonly providerType = 'http';

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const provider = model.provider;
    const apiKey = provider?.config?.api_key ?? '';
    const baseUrl = provider?.config?.base_url ?? 'https://openrouter.ai/api/v1';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
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
      throw new Error(`QwenCode ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const output = data.choices?.[0]?.message?.content ?? '';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const costIn = inputTokens * (model.cost_per_1k_input ?? 0) / 1000;
    const costOut = outputTokens * (model.cost_per_1k_output ?? 0) / 1000;

    return {
      output,
      costUsd: costIn + costOut,
      inputTokens,
      outputTokens,
      sessionId: data.id ?? '',
      modelUsed: model.model_id,
      providerUsed: 'qwen-code',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
