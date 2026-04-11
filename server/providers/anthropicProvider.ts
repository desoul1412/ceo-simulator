import type { Provider, ProviderConfig, ProviderExecuteOptions, UnifiedResponse, ModelTier } from './types';

const MODEL_MAP: Record<ModelTier, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
};

export function createAnthropicProvider(config: ProviderConfig): Provider {
  return {
    name: 'anthropic',
    config,

    async isHealthy(): Promise<boolean> {
      return !!process.env.ANTHROPIC_API_KEY;
    },

    getModelId(tier: ModelTier): string {
      return MODEL_MAP[tier] ?? MODEL_MAP.sonnet;
    },

    async execute(options: ProviderExecuteOptions): Promise<UnifiedResponse> {
      const startMs = Date.now();

      // Dynamically import Claude Agent SDK (only available when Anthropic is configured)
      const { query } = await import('@anthropic-ai/claude-agent-sdk');

      const queryOptions: any = {
        cwd: options.cwd ?? process.cwd(),
        systemPrompt: options.systemPrompt,
        maxTurns: options.maxTurns ?? 10,
        maxBudgetUsd: options.maxBudgetUsd ?? 2.0,
        model: options.model,
        effort: options.effort ?? 'medium',
        permissionMode: options.permissionMode ?? 'acceptEdits',
      };

      if (options.tools) {
        queryOptions.tools = options.tools;
        queryOptions.allowedTools = options.tools;
      }

      if (options.resume) {
        queryOptions.resume = options.resume;
      }

      let output = '';
      let costUsd = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let sessionId = '';
      let stopReason = '';

      for await (const event of query({
        prompt: options.userPrompt,
        options: queryOptions,
      })) {
        if (event.type === 'result') {
          output = (event as any).result ?? '';
          costUsd = (event as any).costUsd ?? 0;
          inputTokens = (event as any).inputTokens ?? 0;
          outputTokens = (event as any).outputTokens ?? 0;
          sessionId = (event as any).sessionId ?? '';
          stopReason = (event as any).stopReason ?? 'end_turn';
        }
      }

      return {
        id: sessionId || `anthropic-${Date.now()}`,
        model: options.model,
        output,
        costUsd,
        inputTokens,
        outputTokens,
        sessionId,
        stopReason,
        provider: 'anthropic',
        latencyMs: Date.now() - startMs,
      };
    },
  };
}
