/**
 * Server environment validation — fails loudly at startup if required vars are missing.
 * Uses zod for type-safe validation.
 */

import { z } from 'zod';

const envSchema = z.object({
  // Required: Supabase connection
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Optional: Server config
  PORT: z.string().optional().default('3001'),
  NODE_ENV: z.enum(['development', 'test', 'production']).optional().default('development'),

  // Optional: Embedding provider (for semantic memory search)
  EMBEDDING_API_URL: z.string().url().optional(),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional().default('text-embedding-3-small'),
  EMBEDDING_DIMS: z.string().optional().default('1536'),

  // Optional: Brain filesystem mirror (default OFF)
  BRAIN_SYNC_ENABLED: z.enum(['true', 'false']).optional().default('false'),
});

export type ServerEnv = z.infer<typeof envSchema>;

let _env: ServerEnv | null = null;

export function validateEnv(): ServerEnv {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n[env] Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nCheck your server/.env file. See .env.example for required variables.\n');
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

export function getEnv(): ServerEnv {
  if (!_env) return validateEnv();
  return _env;
}
