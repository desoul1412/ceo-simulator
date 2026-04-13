export interface LLMProvider {
  id: string;
  slug: string;
  name: string;
  provider_type: 'sdk' | 'http';
  config: Record<string, any>;
  is_active: boolean;
}

export interface LLMModel {
  id: string;
  provider_id: string;
  slug: string;
  name: string;
  model_id: string;
  tier: 'fast' | 'mid' | 'premium';
  cost_per_1k_input: number | null;
  cost_per_1k_output: number | null;
  max_context_tokens: number | null;
  supports_tools: boolean;
  is_active: boolean;
  provider?: LLMProvider;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  tools?: string[];
  allowedTools?: string[];
  maxTurns?: number;
  maxBudgetUsd?: number;
  effort?: string;
  cwd?: string;
  permissionMode?: string;
  model?: string; // override model_id
  resume?: string; // session resume
}

export interface LLMResponse {
  output: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  sessionId: string;
  modelUsed: string;
  providerUsed: string;
}

export interface LLMAdapter {
  readonly providerType: string;
  execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}

/** Roles that require filesystem access (code tasks) */
export const CODE_ROLES = new Set([
  'engineering', 'frontend', 'backend', 'devops', 'qa', 'full-stack',
]);

/** Check if a role/task requires filesystem (SDK-only) providers */
export function requiresFilesystem(role: string, task: string): boolean {
  if (CODE_ROLES.has(role.toLowerCase())) return true;
  // Task-based detection: if task mentions code editing
  const codeKeywords = /\b(implement|code|fix|build|refactor|write.*component|create.*api|add.*endpoint|edit.*file|modify|debug)\b/i;
  return codeKeywords.test(task);
}
