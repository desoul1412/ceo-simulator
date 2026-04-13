/**
 * Gemini Adapter — Google Generative AI API.
 * Text-in/text-out (no filesystem access).
 * Good for long context (1M+ tokens) and cost-effective tasks.
 */

import type { LLMAdapter, LLMModel, LLMRequest, LLMResponse } from '../types';

export class GeminiAdapter implements LLMAdapter {
  readonly providerType = 'http';

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    const provider = model.provider;
    const apiKey = provider?.config?.api_key;
    const baseUrl = provider?.config?.base_url ?? 'https://generativelanguage.googleapis.com/v1beta';

    if (!apiKey) throw new Error('Gemini: missing api_key in provider config');

    const res = await fetch(`${baseUrl}/models/${model.model_id}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ parts: [{ text: request.userPrompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const output = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
    const usage = data.usageMetadata ?? {};
    const inputTokens = usage.promptTokenCount ?? 0;
    const outputTokens = usage.candidatesTokenCount ?? 0;
    const costIn = inputTokens * (model.cost_per_1k_input ?? 0.0005) / 1000;
    const costOut = outputTokens * (model.cost_per_1k_output ?? 0.0015) / 1000;

    return {
      output,
      costUsd: costIn + costOut,
      inputTokens,
      outputTokens,
      sessionId: '',
      modelUsed: model.model_id,
      providerUsed: 'gemini',
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
