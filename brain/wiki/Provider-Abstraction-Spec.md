---
tags: [llm, providers, abstraction, api, anthropic, openai, ollama, integration]
date: 2026-04-11
status: active
---

# LLM Provider Abstraction Specification

**Linked from:** [[00-Index]], [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]]

**Status:** Active specification for provider plugin architecture

---

## 1. Overview

The CEO Simulator supports multiple LLM providers (Anthropic, OpenAI, Ollama, HTTP-generic). This spec defines a unified `LLMProvider` interface contract that abstracts provider-specific implementations while maintaining compatibility with the existing [[AgentRunResult]] shape.

**Goals:**
- Plugin-based provider system — add new LLM providers without modifying `agentRunner.ts`
- Unified cost accounting and token tracking across all providers
- Support both synchronous `complete()` and streaming `stream()` patterns
- Predictable cost estimation for budget-aware agents
- Session persistence (where supported by provider)

---

## 2. Core Interface Definition

### `LLMProvider` Abstract Interface

Located at: `server/providers/LLMProvider.ts` (to be created)

```typescript
/**
 * Abstract provider interface for LLM completion requests.
 * All providers must implement these three methods.
 */
export interface LLMProvider {
  /**
   * Synchronous completion: send prompt, get result immediately.
   * Use for short, simple tasks without streaming overhead.
   *
   * @param prompt - Full prompt text (may include system + user messages)
   * @param options - Provider-specific options (model, temperature, max_tokens, etc.)
   * @returns Promise resolving to a completed ProviderResult
   */
  complete(
    prompt: string,
    options: ProviderOptions,
  ): Promise<ProviderResult>;

  /**
   * Streaming completion: iteratively receive tokens/chunks.
   * Use for long-running tasks, interactive feedback, or budget tracking.
   *
   * Yields ProviderStreamChunk objects; caller assembles final result.
   * MUST emit 'result' chunk at end with final metrics.
   *
   * @param prompt - Full prompt text
   * @param options - Provider-specific options
   * @returns AsyncIterable of stream chunks
   */
  stream(
    prompt: string,
    options: ProviderOptions,
  ): AsyncIterable<ProviderStreamChunk>;

  /**
   * Estimate cost without running the prompt.
   * Used by budget-aware agents to pre-check feasibility.
   *
   * @param inputTokens - Estimated token count (user can provide or we estimate)
   * @param outputTokens - Estimated output tokens (default: model's max context / 2)
   * @param model - Model name/ID (e.g., "gpt-4", "claude-3-opus", "mistral")
   * @returns Estimated cost in USD
   */
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model: string,
  ): number;

  /**
   * Provider name (lowercase, hyphenated).
   * Used for routing and logging: "anthropic", "openai", "ollama", "http-generic"
   */
  readonly name: string;

  /**
   * Provider version/tag (e.g., "1.0.0").
   * For audit + capability tracking.
   */
  readonly version: string;

  /**
   * List of supported model IDs for this provider.
   * Empty array = any model ID is accepted (HTTP-generic).
   */
  readonly supportedModels: string[];
}

/**
 * Options bag for a completion request.
 * Providers consume only fields relevant to them; others are ignored.
 */
export interface ProviderOptions {
  // Standard fields (all providers)
  model?: string; // e.g., "gpt-4", "claude-3-opus"
  maxTokens?: number; // max output tokens
  temperature?: number; // 0.0 - 1.0+
  topP?: number; // nucleus sampling
  topK?: number; // top-K sampling

  // Provider-specific fields
  systemPrompt?: string; // For providers that differentiate system vs user
  sessionId?: string; // For providers supporting session resume
  customHeaders?: Record<string, string>; // For HTTP-generic
  ollama_url?: string; // For Ollama
  [key: string]: any; // Pass-through for provider-specific extensions
}

/**
 * Result of a complete() call.
 * Maps directly to AgentRunResult shape.
 */
export interface ProviderResult {
  // Output text (may be incomplete if error)
  output: string;

  // Cost in USD
  costUsd: number;

  // Token usage
  inputTokens: number;
  outputTokens: number;

  // Session ID (for providers supporting persistent sessions)
  sessionId?: string;

  // Optional: detailed metrics
  stopReason?: string; // "end_turn", "max_tokens", "error", etc.
  model?: string; // Actual model used (may differ from requested)
  cached?: boolean; // Was this response cached?
}

/**
 * A single chunk from stream().
 * Caller is responsible for assembling text chunks into final output.
 */
export type ProviderStreamChunk =
  | {
      type: 'text';
      text: string; // Delta text token(s)
    }
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
    }
  | {
      type: 'result';
      output: string; // Complete output text
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
      sessionId?: string;
      stopReason?: string;
    }
  | {
      type: 'error';
      error: string; // Error message
    };
```

---

## 3. Mapping to `AgentRunResult`

The existing `AgentRunResult` interface (from `server/agents/agentRunner.ts:9-15`):

```typescript
export interface AgentRunResult {
  output: string;           // ← ProviderResult.output
  costUsd: number;          // ← ProviderResult.costUsd
  inputTokens: number;      // ← ProviderResult.inputTokens
  outputTokens: number;     // ← ProviderResult.outputTokens
  sessionId: string;        // ← ProviderResult.sessionId ?? ""
}
```

**Conversion function** (to be added to provider abstraction layer):

```typescript
export function providerResultToAgentRunResult(
  result: ProviderResult,
): AgentRunResult {
  return {
    output: result.output,
    costUsd: result.costUsd,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    sessionId: result.sessionId ?? '',
  };
}
```

---

## 4. Supported Providers

### 4.1 Anthropic (`anthropic`)

**Location:** `server/providers/AnthropicProvider.ts`

**Models:**
- `claude-3-5-sonnet-20241022` (fast, balanced)
- `claude-3-opus-20250219` (most capable, expensive)
- `claude-3-haiku-20250307` (cheapest, limited reasoning)

**Features:**
- Full streaming support via `Messages API`
- Session resume via session tokens (stored in `sessionId`)
- Accurate token counting pre-request
- Native support for system + user prompt separation

**Cost Model (as of 2026-04):**

| Model | Input | Output |
|-------|-------|--------|
| Sonnet | $3.00/M | $15.00/M |
| Opus | $15.00/M | $75.00/M |
| Haiku | $0.80/M | $4.00/M |

**Implementation Notes:**
- Use `@anthropic-ai/sdk` or (if available) [[Factory-Operations-Manual#Claude-Agent-SDK | Claude Agent SDK]]
- `options.systemPrompt` → separate system role
- `options.sessionId` → `resume_session` in request
- Max tokens: respect budget-aware limits from `AgentContext.budgetRemaining`

### 4.2 OpenAI (`openai`)

**Location:** `server/providers/OpenAIProvider.ts`

**Models:**
- `gpt-4o` (multimodal, latest)
- `gpt-4-turbo` (reasoning, 128K context)
- `gpt-3.5-turbo` (fast, cheap)

**Features:**
- Streaming via `chat/completions` with `stream=true`
- No built-in session resume (context kept in function caller)
- Function calling (optional, for tool use)
- Accurate usage reporting

**Cost Model (as of 2026-04):**

| Model | Input | Output |
|-------|-------|--------|
| GPT-4o | $5.00/M | $15.00/M |
| GPT-4-Turbo | $10.00/M | $30.00/M |
| GPT-3.5 | $0.50/M | $1.50/M |

**Implementation Notes:**
- Use `openai` npm package
- `options.systemPrompt` → `role: "system"` message
- No session support — `sessionId` always returns ""
- Handle rate limiting (429) with exponential backoff
- Requires `OPENAI_API_KEY` env var

### 4.3 Ollama (`ollama`)

**Location:** `server/providers/OllamaProvider.ts`

**Models:**
- Any model available locally: `mistral`, `llama2`, `neural-chat`, etc.
- Models must be pre-pulled: `ollama pull <model>`

**Features:**
- Completely local — zero API cost
- Streaming via `/api/generate` endpoint
- No authentication required
- Token counting is approximate (model-dependent)

**Cost Model:**
- $0.00 USD (purely local compute)
- Real cost: GPU/CPU resources consumed locally

**Implementation Notes:**
- Default URL: `http://localhost:11434`
- Override via `options.ollama_url`
- `/api/generate` endpoint used (compatible with open-source tools)
- Token counting fallback: character count / 4 (approximate)
- No session support
- Gracefully degrade if Ollama not running

### 4.4 HTTP-Generic (`http-generic`)

**Location:** `server/providers/HttpGenericProvider.ts`

**Models:**
- Any — provider accepts arbitrary model names

**Features:**
- Call any HTTP endpoint that accepts JSON POST
- Response must include `output` + cost/token fields
- Flexible — supports in-house LLM services, edge functions, etc.

**Configuration:**
```json
{
  "url": "https://my-llm-service.example.com/v1/complete",
  "method": "POST",
  "headers": { "Authorization": "Bearer ...", ... },
  "timeout": 120000,
  "costMultiplier": 1.0,
  "tokenMultiplier": 1.0
}
```

**Expected Response Format:**
```json
{
  "output": "...",
  "cost_usd": 0.042,
  "input_tokens": 1234,
  "output_tokens": 567,
  "session_id": "optional-session-token",
  "model": "actual-model-used"
}
```

**Features:**
- Agnostic to underlying provider
- Optional multipliers for cost/token adjustment
- Timeout handling with graceful failure
- Session persistence (optional)

**Implementation Notes:**
- Fallback parsing: if response missing fields, use defaults (0 cost, 0 tokens)
- No streaming support (HTTP-generic); use polling or custom streaming endpoint
- Custom headers applied to all requests

---

## 5. Integration Points

### 5.1 Agent Dispatcher (`server/agents/agentRunner.ts`)

Current flow:
```
executeAgent(ctx: AgentContext)
  ↓
  switch(ctx.runtimeType) {
    case 'claude_sdk':     → executeClaudeAgent()
    case 'http_endpoint':  → executeHttpAgent()
    case 'bash_script':    → executeBashAgent()
  }
  ↓
  AgentRunResult
```

**Proposed refactor** (Phase 2):
```
executeAgent(ctx: AgentContext)
  ↓
  provider = await providerRegistry.get(ctx.runtimeConfig.provider)
  ↓
  options = {
    model: ctx.runtimeConfig.model,
    maxTokens: ctx.budgetRemaining * 1000 (approx),
    systemPrompt: ctx.systemPrompt,
    sessionId: ctx.activeSessionId,
  }
  ↓
  result = await provider.stream(prompt, options)  // or .complete()
  ↓
  AgentRunResult
```

### 5.2 Provider Registry

**Location:** `server/providers/registry.ts`

```typescript
export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  /**
   * Register a provider implementation.
   * Typically called during boot.
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Fetch a provider by name.
   * @throws Error if not registered
   */
  async get(name: string): Promise<LLMProvider> {
    const p = this.providers.get(name);
    if (!p) throw new Error(`Provider not found: ${name}`);
    return p;
  }

  /**
   * List all registered providers.
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton
export const providerRegistry = new ProviderRegistry();

// Boot initialization
export async function initProviders() {
  providerRegistry.register(new AnthropicProvider());
  providerRegistry.register(new OpenAIProvider());
  providerRegistry.register(new OllamaProvider());
  providerRegistry.register(new HttpGenericProvider());
}
```

### 5.3 Budget Awareness

Agents have `budgetRemaining: number` (in USD).

**Pre-flight check:**
```typescript
const estimatedCost = provider.estimateCost(
  estimateTokens(prompt),
  ctx.runtimeConfig.maxOutputTokens ?? 4000,
  ctx.runtimeConfig.model,
);

if (estimatedCost > ctx.budgetRemaining) {
  throw new Error(`Budget insufficient: need $${estimatedCost.toFixed(2)}, have $${ctx.budgetRemaining.toFixed(2)}`);
}
```

**Runtime tracking:**
- Stream chunks include usage deltas
- Call `estimateCost()` iteratively to alert agent if approaching limit
- Truncate output if actual cost exceeds budget

### 5.4 Session Persistence

Providers may return a `sessionId` for multi-turn conversations.

**Storage:**
- `agents.active_session_id` (existing column)
- Pass to next invocation via `options.sessionId`

**Fallback:** If provider doesn't support sessions, `sessionId = ""` (empty string)

---

## 6. Streaming vs. Completion

### When to use `stream()`

- Long-running tasks (>10s estimated)
- Interactive feedback to user (real-time token display)
- Budget-aware iteration (stop early if costs exceed threshold)
- [[Factory-Operations-Manual#Heartbeat-System | Heartbeat updates]] — emit `onActivity()` per chunk

### When to use `complete()`

- Short, deterministic tasks
- Batch processing
- Offline execution
- Simple cost tracking

**Default:** Use `stream()` with `complete()` fallback if streaming not supported

---

## 7. Error Handling

Each provider MUST handle:

1. **Network errors** (connection refused, timeout)
   - Emit `{ type: 'error', error: '...' }` chunk
   - Caller logs to notification system

2. **Rate limits** (429)
   - Exponential backoff (OpenAI)
   - Fail fast for Ollama (local)
   - Retry for HTTP-generic (with config)

3. **Invalid input** (prompt too long, bad model)
   - Throw synchronously or emit error chunk
   - Include helpful context

4. **Budget exhaustion**
   - Provider stops iterating mid-stream
   - Emit final `result` chunk with partial output
   - Caller handles truncation

---

## 8. Configuration & Boot

### Environment Variables

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# Ollama (optional, default: http://localhost:11434)
OLLAMA_URL=http://ollama-service:11434

# HTTP-Generic (optional, per-agent config)
# → Passed via agents.runtime_config JSON
```

### Initialization Sequence

```typescript
// server/boot.ts (or similar)

import { initProviders, providerRegistry } from './providers/registry';

async function boot() {
  // Validate API keys
  if (!process.env.ANTHROPIC_API_KEY && process.env.ENABLE_ANTHROPIC !== 'false') {
    console.warn('⚠ Anthropic disabled (no API key)');
  }

  // Initialize all providers
  await initProviders();

  console.log(`✓ Providers ready: ${providerRegistry.list().join(', ')}`);
}
```

---

## 9. Testing Strategy

### Unit Tests

**Location:** `server/providers/__tests__/`

```typescript
// server/providers/__tests__/AnthropicProvider.test.ts

import { AnthropicProvider } from '../AnthropicProvider';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it('should estimate cost for Sonnet', () => {
    const cost = provider.estimateCost(1000, 500, 'claude-3-5-sonnet-20241022');
    expect(cost).toBeCloseTo(0.00525, 5); // 1K * 3/M + 500 * 15/M
  });

  it('should stream text chunks', async () => {
    const chunks: string[] = [];
    for await (const chunk of provider.stream('Hello', { model: 'claude-3-5-sonnet' })) {
      if (chunk.type === 'text') chunks.push(chunk.text);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle rate limits with backoff', async () => {
    // Mock API to return 429
    // Verify exponential backoff retry logic
  });
});
```

### Integration Tests

```typescript
// server/providers/__tests__/integration.test.ts

describe('Provider Integration', () => {
  it('should dispatch to correct provider via registry', async () => {
    const provider = await providerRegistry.get('anthropic');
    const result = await provider.complete('1+1=?', { model: 'claude-3-haiku' });
    expect(result.output).toContain('2');
  });

  it('should convert ProviderResult to AgentRunResult', () => {
    const result = providerResultToAgentRunResult({
      output: 'test',
      costUsd: 0.001,
      inputTokens: 10,
      outputTokens: 5,
    });
    expect(result).toMatchObject({
      output: 'test',
      costUsd: 0.001,
      inputTokens: 10,
      outputTokens: 5,
      sessionId: '',
    });
  });
});
```

---

## 10. Migration Path (Phase-Based Rollout)

### Phase 1 (Current)
- Existing runners remain unchanged
- Spec document published
- Provider abstract base class stubbed

### Phase 2 (v2)
- Implement `AnthropicProvider` wrapper around `executeClaudeAgent()`
- Add `providerRegistry`
- Refactor `agentRunner.ts` to dispatch via registry (backward compatible)

### Phase 3 (v3)
- Implement `OpenAIProvider`
- Implement `OllamaProvider`
- Add provider selection UI in hire dialog

### Phase 4 (v4)
- Implement `HttpGenericProvider`
- Full multi-provider testing
- Documentation + examples for custom providers

---

## 11. Future Extensions

### Streaming Callbacks

```typescript
// Enhanced streaming with progress callbacks
stream(
  prompt,
  options,
  callbacks?: {
    onChunk?: (chunk: ProviderStreamChunk) => void;
    onToken?: (token: string) => void;
    onCostUpdate?: (costUsd: number) => void;
  }
): AsyncIterable<ProviderStreamChunk>;
```

### Fine-Tuning & Custom Models

```typescript
// Stored in agents.runtime_config
{
  provider: 'openai',
  model: 'ft:gpt-3.5-turbo:org-xxx',
  finetuning_config: { ... }
}
```

### Tool Use / Function Calling

```typescript
// Provider-agnostic tool abstraction
interface ProviderTool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

interface ProviderOptions {
  tools?: ProviderTool[];
  toolChoice?: 'auto' | 'required' | 'none';
}
```

### Caching & Prompt Optimization

```typescript
// Prompt compression before sending
interface ProviderOptions {
  cacheControl?: 'strict' | 'lazy' | 'none';
  compressPrompt?: boolean; // Use LLM to summarize context
}
```

---

## 12. References

- [[00-Index]] — Master project index
- [[Office-Simulator-Architecture]] — Agent system architecture
- [[Factory-Operations-Manual]] — Execution pipeline & SOP
- [[Auth-System-Spec]] — Example of interface-first spec
- `server/agents/agentRunner.ts` — Current dispatcher (to refactor)
- `server/agents/claudeRunner.ts` — Reference implementation (becomes `AnthropicProvider`)

---

## 13. Acceptance Criteria

- [ ] `LLMProvider` interface defined and documented
- [ ] `ProviderOptions` and `ProviderResult` types documented with examples
- [ ] All 4 providers (Anthropic, OpenAI, Ollama, HTTP-generic) mapped to interface
- [ ] Cost model tables for all providers (current as of 2026-04)
- [ ] `ProviderRegistry` singleton pattern specified
- [ ] Integration points documented (agentRunner.ts, session persistence, budget awareness)
- [ ] Streaming vs. completion decision tree documented
- [ ] Error handling strategy per provider
- [ ] Boot/initialization sequence documented
- [ ] Unit + integration test stubs written
- [ ] Migration path (Phase 1-4) defined
- [ ] Linked to [[00-Index]] and related specs

---

## 14. Sign-Off

**Spec Version:** 1.0 (active)
**Last Updated:** 2026-04-11
**Author:** PM / Technical Lead
**Status:** Ready for Phase 2 implementation (AnthropicProvider wrapper)
