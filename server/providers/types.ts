// ── LLM Provider Abstraction ─────────────────────────────────────────────────

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export interface UnifiedResponse {
  id: string;
  model: string;
  output: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  sessionId: string;
  stopReason: string;
  provider: string;
  latencyMs: number;
}

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;       // lower = preferred
  maxRetries: number;
  timeoutMs: number;
}

export interface ProviderExecuteOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
  cwd?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  effort?: string;
  resume?: string;
  permissionMode?: string;
}

export interface Provider {
  name: string;
  config: ProviderConfig;
  isHealthy(): Promise<boolean>;
  execute(options: ProviderExecuteOptions): Promise<UnifiedResponse>;
  getModelId(tier: ModelTier): string;
}
