import type { Provider, ProviderConfig, ProviderExecuteOptions, UnifiedResponse, ModelTier } from './types';

const MODEL_MAP: Record<ModelTier, string> = {
  haiku: 'anthropic/claude-haiku-4-5',
  sonnet: 'anthropic/claude-sonnet-4-6',
  opus: 'anthropic/claude-opus-4-6',
};

// OpenRouter cost per 1K tokens (approximate, varies by model)
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'anthropic/claude-haiku-4-5':  { input: 0.0008, output: 0.004 },
  'anthropic/claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'anthropic/claude-opus-4-6':   { input: 0.015, output: 0.075 },
};

export function createOpenRouterProvider(config: ProviderConfig): Provider {
  const baseUrl = config.baseUrl ?? 'https://openrouter.ai/api/v1';

  return {
    name: 'openrouter',
    config,

    async isHealthy(): Promise<boolean> {
      const key = config.apiKey ?? process.env.OPENROUTER_API_KEY;
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
      const key = config.apiKey ?? process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error('OpenRouter API key not configured');

      const startMs = Date.now();

      // Map model ID to OpenRouter format
      let model = options.model;
      if (!model.includes('/')) {
        // Convert bare model ID to OpenRouter format
        const tier = Object.entries(MODEL_MAP).find(([_, v]) =>
          model.includes(v.split('/')[1] ?? '')
        );
        model = tier ? tier[1] : `anthropic/${model}`;
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
        // OpenRouter supports OpenAI-format function calling
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
          'HTTP-Referer': 'https://ceo-simulator.vercel.app',
          'X-Title': 'CEO Simulator',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const usage = data.usage ?? {};

      // Estimate cost from usage
      const costs = COST_PER_1K[model] ?? COST_PER_1K['anthropic/claude-sonnet-4-6'];
      const costUsd = (
        (usage.prompt_tokens ?? 0) / 1000 * costs.input +
        (usage.completion_tokens ?? 0) / 1000 * costs.output
      );

      return {
        id: data.id ?? `or-${Date.now()}`,
        model,
        output: choice?.message?.content ?? '',
        costUsd,
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        sessionId: data.id ?? '',
        stopReason: choice?.finish_reason ?? 'stop',
        provider: 'openrouter',
        latencyMs: Date.now() - startMs,
      };
    },
  };
}
