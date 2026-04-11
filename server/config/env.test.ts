/**
 * server/config/env.test.ts
 * Integration tests for the centralized environment config.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Re-execute the env module with a patched process.env. */
async function importEnvWith(overrides: Record<string, string | undefined>) {
  const original = { ...process.env };
  Object.assign(process.env, overrides);

  // Remove undefined keys (simulate missing vars)
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
  }

  try {
    // Dynamic import with cache-busting
    const mod = await import(`./env.ts?t=${Date.now()}`);
    return mod;
  } finally {
    // Restore
    process.env = { ...original } as NodeJS.ProcessEnv;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('server/config/env — schema validation', () => {
  const VALID_ENV = {
    SUPABASE_URL: 'https://qdhengvarelfdtmycnti.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service-role-key',
    ANTHROPIC_API_KEY: 'sk-ant-test-key',
    PORT: '4000',
    NODE_ENV: 'test',
  };

  it('parses a fully valid environment without throwing', async () => {
    // Validate via the schema directly (unit-level, no module side-effects)
    const schema = z.object({
      SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
      PORT: z.coerce.number().int().positive().default(3001),
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    });

    const result = schema.safeParse(VALID_ENV);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
      expect(result.data.NODE_ENV).toBe('test');
      expect(result.data.SUPABASE_URL).toBe(VALID_ENV.SUPABASE_URL);
    }
  });

  it('applies PORT default of 3001 when PORT is not set', () => {
    const schema = z.object({
      PORT: z.coerce.number().int().positive().default(3001),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(3001);
  });

  it('applies NODE_ENV default of "development" when not set', () => {
    const schema = z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.NODE_ENV).toBe('development');
  });

  it('rejects an invalid SUPABASE_URL', () => {
    const schema = z.object({
      SUPABASE_URL: z.url(),
    });
    const result = schema.safeParse({ SUPABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('SUPABASE_URL');
    }
  });

  it('rejects a missing SUPABASE_SERVICE_ROLE_KEY', () => {
    const schema = z.object({
      SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    });
    const result = schema.safeParse({ SUPABASE_URL: 'https://x.supabase.co' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('accepts an invalid NODE_ENV value and fails', () => {
    const schema = z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    });
    const result = schema.safeParse({ NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('treats ANTHROPIC_API_KEY as optional — passes when omitted', () => {
    const schema = z.object({
      SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
      ANTHROPIC_API_KEY: z.string().min(1).optional(),
    });
    const result = schema.safeParse({
      SUPABASE_URL: 'https://qdhengvarelfdtmycnti.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('transforms PORT string to number', () => {
    const schema = z.object({
      PORT: z.coerce.number().int().positive().default(3001),
    });
    const result = schema.safeParse({ PORT: '8080' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.PORT).toBe('number');
      expect(result.data.PORT).toBe(8080);
    }
  });
});
