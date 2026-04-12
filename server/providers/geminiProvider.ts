import type { Provider, ProviderConfig, ProviderExecuteOptions, UnifiedResponse, ModelTier } from './types';

const MODEL_MAP: Record<ModelTier, string> = {
  haiku: 'gemini-2.0-flash',
  sonnet: 'gemini-2.5-pro',
  opus: 'gemini-2.5-pro',
};

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash':  { input: 0.0001, output: 0.0004 },
  'gemini-2.5-pro':    { input: 0.00125, output: 0.01 },
  'gemini-2.5-flash':  { input: 0.00015, output: 0.0006 },
};

export function createGeminiProvider(config: ProviderConfig): Provider {
  const baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';

  return {
    name: 'gemini',
    config,

    async isHealthy(): Promise<boolean> {
      const key = config.apiKey ?? process.env.GEMINI_API_KEY;
      if (!key) return false;
      try {
        const res = await fetch(`${baseUrl}/models?key=${key}`, {
          signal: AbortSignal.timeout(5000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    getModelId(tier: ModelTier): string {
      return MODEL_MAP[tier] ?? MODEL_MAP.sonnet;
    },

    async execute(options: ProviderExecuteOptions): Promise<UnifiedResponse> {
      const key = config.apiKey ?? process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Gemini API key not configured');

      const startMs = Date.now();

      let model = options.model;
      if (MODEL_MAP[model as ModelTier]) {
        model = MODEL_MAP[model as ModelTier];
      }

      // Build Gemini-format request
      const contents: any[] = [];

      if (options.systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: `[System Instructions]\n${options.systemPrompt}\n\n[User Request]\n${options.userPrompt}` }],
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: options.userPrompt }],
        });
      }

      const body: any = {
        contents,
        generationConfig: {
          maxOutputTokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.7,
        },
      };

      // Gemini uses systemInstruction for system prompts (v1beta)
      if (options.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: options.systemPrompt }],
        };
        contents[0] = {
          role: 'user',
          parts: [{ text: options.userPrompt }],
        };
      }

      const url = `${baseUrl}/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.map((p: any) => p.text).join('') ?? '';
      const usage = data.usageMetadata ?? {};

      const costs = COST_PER_1K[model] ?? COST_PER_1K['gemini-2.5-pro'];
      const inputTokens = usage.promptTokenCount ?? 0;
      const outputTokens = usage.candidatesTokenCount ?? 0;
      const costUsd = (
        inputTokens / 1000 * costs.input +
        outputTokens / 1000 * costs.output
      );

      return {
        id: `gemini-${Date.now()}`,
        model,
        output: content,
        costUsd,
        inputTokens,
        outputTokens,
        sessionId: '',
        stopReason: candidate?.finishReason ?? 'STOP',
        provider: 'gemini',
        latencyMs: Date.now() - startMs,
      };
    },
  };
}
