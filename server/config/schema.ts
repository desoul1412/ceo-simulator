/**
 * server/config/schema.ts
 * ─────────────────────────────────────────────────────────────
 * TypeScript interfaces that form the contract for all server
 * configuration.  Every provider implementation (env vars,
 * remote config, test stubs) must satisfy these shapes.
 *
 * Relationships:
 *   ServerConfig
 *     ├── DatabaseConfig
 *     ├── LLMProviderConfig
 *     └── AuthConfig
 *
 * Usage:
 *   import type { ServerConfig } from './config/schema.js';
 * ─────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. DatabaseConfig
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connection pool / timeout knobs for the Supabase (PostgreSQL) client.
 * Optional fields default to sane values in the factory function.
 */
export interface DatabasePoolConfig {
  /** Maximum number of concurrent connections in the pool (default: 10) */
  maxConnections?: number;
  /** Idle connection timeout in milliseconds (default: 30_000) */
  idleTimeoutMs?: number;
  /** Connection acquisition timeout in milliseconds (default: 10_000) */
  acquireTimeoutMs?: number;
}

/**
 * Full Supabase / PostgreSQL configuration.
 * Used by `supabaseAdmin.ts` and any raw `pg` clients.
 */
export interface DatabaseConfig {
  /** Public Supabase project URL — e.g. https://xyz.supabase.co */
  supabaseUrl: string;

  /**
   * Service-role key — bypasses Row Level Security.
   * NEVER expose to the browser or commit to VCS.
   */
  supabaseServiceRoleKey: string;

  /**
   * Optional direct PostgreSQL connection string.
   * Used for raw SQL migrations / RPC calls that bypass the Supabase SDK.
   * Format: postgresql://user:password@host:5432/dbname
   */
  postgresConnectionString?: string;

  /** Connection pool settings */
  pool?: DatabasePoolConfig;

  /**
   * Schema search path used for raw SQL statements (default: 'public').
   * Useful when multi-tenancy requires per-tenant schemas.
   */
  schema?: string;

  /** Whether to log every SQL statement to stdout (default: false) */
  debug?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LLMProviderConfig
// ─────────────────────────────────────────────────────────────────────────────

/** Supported LLM provider identifiers */
export type LLMProvider = 'anthropic' | 'openai' | 'ollama' | 'custom';

/**
 * Claude / Anthropic-specific knobs.
 * Mirrors the options accepted by `@anthropic-ai/claude-agent-sdk`.
 */
export interface AnthropicProviderConfig {
  provider: 'anthropic';

  /** Anthropic API key (sk-ant-…) */
  apiKey: string;

  /**
   * Model alias or full model ID.
   * Supported aliases: 'sonnet' | 'haiku' | 'opus'
   * Full IDs: 'claude-sonnet-4-5', 'claude-3-opus-20240229', etc.
   * @default 'sonnet'
   */
  model?: string;

  /** Base URL override for proxies / local mocks */
  baseUrl?: string;

  /** Request timeout in milliseconds (default: 120_000) */
  timeoutMs?: number;

  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;
}

/** OpenAI / compatible provider config (for future httpRunner integration) */
export interface OpenAIProviderConfig {
  provider: 'openai';

  /** OpenAI API key (sk-…) */
  apiKey: string;

  /**
   * Model name — e.g. 'gpt-4o', 'gpt-4-turbo'
   * @default 'gpt-4o'
   */
  model?: string;

  /** Base URL override — useful for Azure OpenAI or local proxies */
  baseUrl?: string;

  /** Request timeout in milliseconds (default: 120_000) */
  timeoutMs?: number;

  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;

  /** OpenAI organization ID */
  organizationId?: string;
}

/** Ollama / local LLM provider config */
export interface OllamaProviderConfig {
  provider: 'ollama';

  /**
   * Base URL of the running Ollama instance.
   * @default 'http://localhost:11434'
   */
  baseUrl?: string;

  /**
   * Model tag to use — e.g. 'llama3:8b', 'mistral'
   * @default 'llama3'
   */
  model?: string;

  /** Request timeout in milliseconds (default: 300_000) */
  timeoutMs?: number;
}

/** Escape hatch for any other LLM endpoint conforming to the OpenAI chat spec */
export interface CustomProviderConfig {
  provider: 'custom';

  /** Required base URL for the custom endpoint */
  baseUrl: string;

  /** Optional API key passed as Authorization: Bearer <apiKey> */
  apiKey?: string;

  /** Model identifier forwarded verbatim in the request body */
  model?: string;

  /** Request timeout in milliseconds (default: 120_000) */
  timeoutMs?: number;

  /** Arbitrary extra headers injected into every request */
  extraHeaders?: Record<string, string>;
}

/**
 * Discriminated union — pick one provider per deployment.
 * `claudeRunner.ts` consumes `AnthropicProviderConfig`.
 * `httpRunner.ts` can consume any of the rest.
 */
export type LLMProviderConfig =
  | AnthropicProviderConfig
  | OpenAIProviderConfig
  | OllamaProviderConfig
  | CustomProviderConfig;

/**
 * Per-agent LLM budget and safety rails.
 * Embedded inside `AgentContext.runtimeConfig` and validated at run time.
 */
export interface LLMBudgetConfig {
  /**
   * Hard ceiling on USD spend per agent invocation.
   * The runner will refuse to start if `budgetRemaining < minBudgetUsd`.
   * @default 2.0
   */
  maxBudgetUsd?: number;

  /**
   * Minimum remaining budget required before a run is allowed.
   * @default 0.01
   */
  minBudgetUsd?: number;

  /**
   * Maximum conversation turns before the agent is forcibly stopped.
   * @default 10
   */
  maxTurns?: number;

  /**
   * Effort level hint forwarded to the SDK.
   * @default 'medium'
   */
  effort?: 'low' | 'medium' | 'high';
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. AuthConfig
// ─────────────────────────────────────────────────────────────────────────────

/** JWT signing / verification settings */
export interface JWTConfig {
  /**
   * Secret used to sign and verify JWT tokens.
   * Must be at least 32 characters for HS256.
   */
  secret: string;

  /**
   * Token time-to-live expressed as a vercel/ms duration string or seconds.
   * @default '7d'
   */
  expiresIn?: string | number;

  /**
   * Signing algorithm.
   * @default 'HS256'
   */
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
}

/** Cookie / session hardening options */
export interface SessionConfig {
  /**
   * Name of the session cookie.
   * @default 'ceo_sid'
   */
  cookieName?: string;

  /**
   * Whether the cookie is HttpOnly (recommended: true).
   * @default true
   */
  httpOnly?: boolean;

  /**
   * SameSite policy.
   * @default 'strict'
   */
  sameSite?: 'strict' | 'lax' | 'none';

  /**
   * Whether to set the Secure flag (should be true in production).
   * Defaults to `true` when `NODE_ENV === 'production'`.
   */
  secure?: boolean;

  /**
   * Cookie max-age in milliseconds.
   * @default 604_800_000 (7 days)
   */
  maxAgeMs?: number;
}

/** CORS configuration for the Express API */
export interface CORSConfig {
  /**
   * Allowed origins.  Use `'*'` only in development.
   * @example ['https://ceo-simulator-iota.vercel.app']
   */
  allowedOrigins: string | string[];

  /** Allowed HTTP methods (default: standard REST verbs) */
  allowedMethods?: string[];

  /** Additional response headers exposed to the browser */
  exposedHeaders?: string[];

  /** Whether to reflect the `Access-Control-Allow-Credentials` header */
  credentials?: boolean;
}

/**
 * Top-level authentication & authorization configuration.
 * Consumed by Express middleware and Supabase RLS helpers.
 */
export interface AuthConfig {
  /** JWT signing / verification settings */
  jwt: JWTConfig;

  /** Session cookie settings */
  session?: SessionConfig;

  /** CORS policy */
  cors?: CORSConfig;

  /**
   * List of IP addresses or CIDR ranges allowed to call admin endpoints.
   * Empty array = no IP restriction (rely on JWT only).
   */
  adminAllowlist?: string[];

  /**
   * Whether to enforce Supabase Row Level Security checks on the service-role
   * client (for defence-in-depth).  Normally false — service role bypasses RLS.
   * @default false
   */
  enforceRLS?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ServerConfig  (root aggregate)
// ─────────────────────────────────────────────────────────────────────────────

/** HTTP server operational mode */
export type NodeEnv = 'development' | 'production' | 'test';

/**
 * Aggregate configuration contract for the entire backend server.
 *
 * Every sub-system (database, LLM, auth, logging) is expressed as a
 * nested typed interface so that:
 *   - The env adapter (`env.ts`) can construct a concrete instance.
 *   - Test suites can inject stubs without touching process.env.
 *   - Future remote-config adapters can satisfy the same contract.
 */
export interface ServerConfig {
  // ── Runtime ────────────────────────────────────────────────
  /** Port the HTTP server binds to */
  port: number;

  /** Runtime environment */
  nodeEnv: NodeEnv;

  /** Human-readable service name used in logs and Sentry traces */
  serviceName?: string;

  /** Semantic version of the deployed build (injected at build time) */
  version?: string;

  // ── Sub-systems ────────────────────────────────────────────
  /** Supabase / PostgreSQL connection settings */
  database: DatabaseConfig;

  /** Primary LLM provider used by agent runners */
  llm: LLMProviderConfig;

  /**
   * Optional secondary LLM provider used as fallback when the primary is
   * unavailable (circuit-breaker pattern from CLAUDE.md §4).
   */
  llmFallback?: LLMProviderConfig;

  /** Per-run LLM budget and safety rails */
  llmBudget?: LLMBudgetConfig;

  /** Authentication, session, and CORS settings */
  auth: AuthConfig;

  // ── Feature flags ──────────────────────────────────────────
  /**
   * Enable the heartbeat daemon that auto-processes agent tasks every 30 s.
   * @default true (disabled in test environment)
   */
  enableHeartbeatDaemon?: boolean;

  /**
   * Enable Obsidian vault sync after agent task completion.
   * @default true
   */
  enableObsidianSync?: boolean;

  /**
   * Enable real-time Supabase subscriptions on the server side.
   * @default true
   */
  enableRealtimeSubscriptions?: boolean;

  // ── Observability ──────────────────────────────────────────
  /**
   * Minimum log level.
   * @default 'info' in production, 'debug' in development
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';

  /**
   * Optional Sentry DSN for error tracking.
   * If omitted, Sentry is not initialised.
   */
  sentryDsn?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Config factory helper types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A partial deep override of `ServerConfig` — used by test helpers to
 * merge a minimal fixture with production defaults.
 *
 * @example
 * ```ts
 * const cfg = buildConfig(defaults, { port: 0, nodeEnv: 'test' });
 * ```
 */
export type PartialServerConfig = Partial<
  Omit<ServerConfig, 'database' | 'llm' | 'auth'>
> & {
  database?: Partial<DatabaseConfig>;
  llm?: LLMProviderConfig;
  auth?: Partial<AuthConfig>;
};

/**
 * Function signature for any config factory / builder.
 * Accepts overrides and returns a fully-resolved `ServerConfig`.
 */
export type ConfigFactory = (overrides?: PartialServerConfig) => ServerConfig;
