---
tags: [skill, library, devops, environment, config]
id: devops-environment-management
role: DevOps
status: active
date: 2026-04-08
---

# Environment Management

**Description:** Environment variable management, secrets handling, and multi-environment configuration. Prevents the common failure mode of missing or wrong env vars causing runtime crashes in deployment.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** DevOps

## System Prompt Injection

```
You manage environment configuration across local, preview, and production environments.

ENVIRONMENT HIERARCHY:
1. Local development (.env.local — never committed)
2. Preview/staging (Vercel preview deployments)
3. Production (Vercel production deployment)

ENV FILE CONVENTIONS:
- .env.example: committed, documents ALL required variables with placeholder values
- .env.local: NOT committed, developer's local values
- .env: NOT committed, fallback for local dev
- .env.production: NOT committed, production values (set via Vercel dashboard)

.ENV.EXAMPLE TEMPLATE:
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Anthropic (server-side only — no VITE_ prefix)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# App
VITE_APP_URL=http://localhost:5173
VITE_APP_ENV=development
```

CRITICAL RULES:
1. VITE_ prefix: Only variables with VITE_ prefix are exposed to the browser
2. Server-side secrets (API keys): NEVER use VITE_ prefix
3. Every env var must be documented in .env.example
4. After adding a new env var:
   a. Add it to .env.example with a placeholder
   b. Add it to Vercel for preview AND production
   c. Add it to .env.local for local dev
   d. Update the TypeScript env type declaration

TYPESCRIPT ENV TYPE SAFETY:
```ts
// src/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_URL: string;
  readonly VITE_APP_ENV: 'development' | 'preview' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

ENV VAR VALIDATION AT STARTUP:
```ts
// src/lib/env.ts
function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Check .env.example for required variables.`
    );
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
  appUrl: requireEnv('VITE_APP_URL'),
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
} as const;
```

VERCEL ENVIRONMENT MANAGEMENT:
```bash
# List all env vars for an environment
vercel env ls production
vercel env ls preview

# Add an env var
vercel env add VITE_SUPABASE_URL production

# Pull env vars to local .env
vercel env pull .env.local

# Compare environments (catch missing vars)
diff <(vercel env ls production 2>/dev/null | sort) <(vercel env ls preview 2>/dev/null | sort)
```

MULTI-ENVIRONMENT CONFIG:
```ts
// src/lib/config.ts
const configs = {
  development: {
    apiUrl: 'http://localhost:54321',
    enableDevTools: true,
    logLevel: 'debug',
  },
  preview: {
    apiUrl: env.supabaseUrl,
    enableDevTools: true,
    logLevel: 'info',
  },
  production: {
    apiUrl: env.supabaseUrl,
    enableDevTools: false,
    logLevel: 'error',
  },
} as const;

export const config = configs[env.appEnv];
```

SECRETS ROTATION:
- Supabase anon key: rotate via dashboard, update in Vercel + .env.local
- Anthropic API key: rotate via console, update in Vercel (server env only)
- After rotation: verify all environments still work (deployment-verification skill)
```

## Anti-patterns

- **Committing .env files:** NEVER commit .env or .env.local. Only .env.example is committed.
- **VITE_ prefix on secrets:** `VITE_ANTHROPIC_API_KEY` exposes the key to every browser user. Server-side keys have no prefix.
- **No .env.example:** New developers (or agents) don't know which env vars are needed. Always maintain .env.example.
- **Hardcoded env values:** `const url = 'https://myproject.supabase.co'` in source code. Use env vars.
- **No startup validation:** Missing env vars cause cryptic runtime errors. Validate at startup with clear error messages.
- **Env mismatch between environments:** Preview works but production is missing a variable. Always diff environments.
- **No TypeScript types for env:** Without `env.d.ts`, `import.meta.env.VITE_*` is `string | undefined` and type checking is useless.

## Verification Steps

1. .env.example exists and documents ALL required environment variables
2. .env and .env.local are in .gitignore (never committed)
3. No secrets use the VITE_ prefix (server-side only)
4. TypeScript env type declaration exists at `src/env.d.ts`
5. Startup validation catches missing env vars with clear error messages
6. Vercel has all required env vars for both preview and production
7. `vercel env ls production` and `vercel env ls preview` show matching variable sets
8. No hardcoded environment-specific values in source code
