/**
 * Claude API Adapter — direct Anthropic HTTP API.
 * Text-in/text-out only (no filesystem access).
 * Good for planning, analysis, writing tasks.
 */

import type { LLMAdapter, LLMModel, LLMRequest, LLMResponse } from '../types';

export class ClaudeApiAdapter implements LLMAdapter {
  readonly providerType = 'http';

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const provider = model.provider;
    const apiKey = provider?.config?.api_key;
    const baseUrl = provider?.config?.base_url ?? 'https://api.anthropic.com';

    if (!apiKey) throw new Error('Claude API: missing api_key in provider config');

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model.model_id,
        max_tokens: 8192,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const output = (data.content ?? []).map((b: any) => b.text ?? '').join('');
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const costIn = inputTokens * (model.cost_per_1k_input ?? 0.003) / 1000;
    const costOut = outputTokens * (model.cost_per_1k_output ?? 0.015) / 1000;

    return {
      output,
      costUsd: costIn + costOut,
      inputTokens,
      outputTokens,
      sessionId: data.id ?? '',
      modelUsed: model.model_id,
      providerUsed: 'claude-api',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
