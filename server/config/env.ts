/**
 * server/config/env.ts
 * ─────────────────────────────────────────────────────────────
 * Centralized, Zod-validated environment configuration.
 *
 * Usage:
 *   import { env } from './config/env.js';
 *   console.log(env.SUPABASE_URL);
 *
 * All consumers must import from here — never use process.env directly.
 * ─────────────────────────────────────────────────────────────
 */

import { config as loadDotenv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// ── Load .env relative to the project root (one level above /server) ─────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../.env') });

// ── Schema ────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  // ── Supabase ──────────────────────────────────────────────
  /** Public Supabase project URL, e.g. https://xyz.supabase.co */
  SUPABASE_URL: z.url({ error: 'SUPABASE_URL must be a valid URL' }),

  /** Service-role key — bypasses RLS; NEVER expose to the browser */
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { error: 'SUPABASE_SERVICE_ROLE_KEY is required' }),

  // ── Anthropic ─────────────────────────────────────────────
  /** Anthropic API key used by agent runners */
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, { error: 'ANTHROPIC_API_KEY is required' })
    .optional(),

  // ── Server ────────────────────────────────────────────────
  /** HTTP port the Express server listens on */
  PORT: z.coerce
    .number({ error: 'PORT must be a valid number' })
    .int()
    .positive()
    .default(3001),

  /** Runtime environment */
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

// ── Validate ──────────────────────────────────────────────────────────────────

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    throw new Error(
      `[env] ❌ Invalid environment variables:\n${issues}\n\nFix the above vars in your .env file before starting the server.`,
    );
  }

  return result.data;
}

/** Typed, validated environment — import this instead of process.env */
export const env = parseEnv();

/** Convenience type for callers that need to reference the shape */
export type Env = typeof env;
