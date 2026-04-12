import type { Provider, ProviderConfig, ProviderExecuteOptions, UnifiedResponse, ModelTier } from './types';

const MODEL_MAP: Record<ModelTier, string> = {
  haiku: 'gpt-4o-mini',
  sonnet: 'gpt-4o',
  opus: 'o1',
};

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini':  { input: 0.00015, output: 0.0006 },
  'gpt-4o':       { input: 0.0025, output: 0.01 },
  'o1':           { input: 0.015, output: 0.06 },
  'o1-mini':      { input: 0.003, output: 0.012 },
};

export function createOpenAIProvider(config: ProviderConfig): Provider {
  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';

  return {
    name: 'openai',
    config,

    async isHealthy(): Promise<boolean> {
      const key = config.apiKey ?? process.env.OPENAI_API_KEY;
      if (!key) return false;
      try {
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${key}` },
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
      const key = config.apiKey ?? process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OpenAI API key not configured');

      const startMs = Date.now();

      // Use model directly if it contains a slash or known model name, else map from tier
      let model = options.model;
      if (MODEL_MAP[model as ModelTier]) {
        model = MODEL_MAP[model as ModelTier];
      }

      const messages: any[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.userPrompt });

      const body: any = {
        model,
        messages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      };

      if (options.tools?.length) {
        body.tools = options.tools.map((t: any) => ({
          type: 'function',
          function: { name: t.name ?? t, description: t.description ?? '' },
        }));
      }

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const usage = data.usage ?? {};

      const costs = COST_PER_1K[model] ?? COST_PER_1K['gpt-4o'];
      const costUsd = (
        (usage.prompt_tokens ?? 0) / 1000 * costs.input +
        (usage.completion_tokens ?? 0) / 1000 * costs.output
      );

      return {
        id: data.id ?? `openai-${Date.now()}`,
        model,
        output: choice?.message?.content ?? '',
        costUsd,
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        sessionId: data.id ?? '',
        stopReason: choice?.finish_reason ?? 'stop',
        provider: 'openai',
        latencyMs: Date.now() - startMs,
      };
    },
  };
}
