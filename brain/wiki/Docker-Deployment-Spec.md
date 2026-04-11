---
tags: [docker, deployment, infrastructure, devops, backend, postgres, redis]
date: 2026-04-11
status: active
---

# Docker Deployment Specification

**Linked from:** [[00-Index]], [[Factory-Operations-Manual]], [[Auth-System-Spec]], [[Database-Abstraction-Spec]]

**Version:** 1.0  
**Author:** Liam Chen (Technical Lead)  
**Status:** Active specification — ready for implementation

---

## 1. Overview

This spec defines the self-hosted Docker deployment architecture for the CEO Simulator. The system currently runs on Vercel (SPA) + Supabase (managed PG). Docker Compose provides a fully local / self-hostable alternative — critical for:

- **Air-gapped / on-premise** deployments (enterprise customers)
- **Local development parity** — dev environment that mirrors production exactly
- **CI/CD pipelines** — reproducible test environments without Supabase dependency
- **Cost control** — run Postgres locally instead of paying Supabase compute

**What this spec covers:**
1. Multi-stage `Dockerfile` for the unified `app` container (Vite SPA build + Express server)
2. `docker-compose.yml` service topology: `app`, `postgres`, `redis`
3. Complete environment variable schema with types, defaults, and validation rules
4. Networking, volume mounts, health check contracts
5. Secrets management strategy
6. Migration and seed scripts

**What this spec does NOT cover:**
- Kubernetes / Helm charts (future spec: `K8s-Deployment-Spec`)
- CDN configuration for the SPA static assets
- CI/CD pipeline YAML (delegated to DevOps agent)

---

## 2. Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     docker-compose network                  │
│                       (ceo-net bridge)                      │
│                                                             │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │       app:3001       │    │      postgres:5432        │  │
│  │  ┌────────────────┐  │    │  PostgreSQL 16-alpine     │  │
│  │  │ Express Server │◄─┼────┤  Volume: pg-data          │  │
│  │  │  server/       │  │    │  Init: /docker-entrypoint │  │
│  │  │  index.ts      │  │    │        -initdb.d/         │  │
│  │  └────────────────┘  │    └───────────────────────────┘  │
│  │  ┌────────────────┐  │                                   │
│  │  │ Vite SPA Build │  │    ┌───────────────────────────┐  │
│  │  │  dist/ (static)│  │    │    redis:6379 (optional)  │  │
│  │  │  served by     │  │    │  Redis 7-alpine           │  │
│  │  │  Express static│  │    │  Volume: redis-data       │  │
│  │  └────────────────┘  │    │  Profile: queue           │  │
│  └──────────────────────┘    └───────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Exposed to host:
  app:      localhost:3001  (all traffic — Express handles SPA + API)
  postgres: localhost:5432  (debug access, bind commented out in prod)
  redis:    localhost:6379  (debug access, bind commented out in prod)
```

### Service Responsibilities

| Service    | Image               | Role                                              | Required |
|------------|---------------------|---------------------------------------------------|----------|
| `app`      | Custom (Dockerfile) | Vite SPA static files + Express API (port 3001)   | ✅ Yes   |
| `postgres` | `postgres:16-alpine`| Standalone PostgreSQL — replaces Supabase PG      | ✅ Yes   |
| `redis`    | `redis:7-alpine`    | Job queue, session cache, rate limiting           | ⚡ Optional (profile: `queue`) |

---

## 3. Dockerfile (Multi-Stage)

**File:** `Dockerfile` (project root)

```dockerfile
# ═══════════════════════════════════════════════════════════
# Stage 1: deps — install node_modules (cached layer)
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package manifests only — layer cache busts only when
# dependencies change, not on source code changes.
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ═══════════════════════════════════════════════════════════
# Stage 2: builder — compile TypeScript + Vite SPA bundle
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine AS builder
WORKDIR /app

# Inherit node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args that bake into the SPA at build time.
# These are PUBLIC values only — never put secrets here.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL=/api
ARG VITE_APP_VERSION=unknown

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Compile server TypeScript for production
RUN npx tsc -p tsconfig.node.json --outDir dist-server --noEmit false

# Build Vite SPA → dist/
RUN npm run build

# ═══════════════════════════════════════════════════════════
# Stage 3: runner — minimal production image
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 ceo-app

# Production node_modules only
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Compiled server code
COPY --from=builder /app/dist-server ./dist-server

# Built SPA (served as static files by Express)
COPY --from=builder /app/dist ./dist

# Brain vault (read-only mount preferred via volume, but include
# defaults for cold-start without a volume mount)
COPY --chown=ceo-app:nodejs brain/ ./brain/

# Public assets (sprites, tiles)
COPY --chown=ceo-app:nodejs public/ ./public/

USER ceo-app

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

# Healthcheck — Express /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist-server/server/index.js"]
```

### Build Notes

- **Stage 1 (`deps`):** Only `package.json` + `package-lock.json` are copied. Docker layer cache is preserved on source-only changes — `npm ci` does not re-run.
- **Stage 2 (`builder`):** `VITE_*` build args are injected here; they are baked into the JS bundle (Vite replaces `import.meta.env.VITE_*` at build time). **Never inject server secrets as `ARG` — they appear in `docker history`.**
- **Stage 3 (`runner`):** Strips all dev tooling. Final image target is ~180 MB (node:22-alpine base).
- **`tsconfig.node.json`** must include `server/` in `include` paths (verify before building).

---

## 4. docker-compose.yml

**File:** `docker-compose.yml` (project root)

```yaml
# CEO Simulator — Self-Hosted Deployment
# Usage:
#   Standard:  docker compose up -d
#   With Redis: docker compose --profile queue up -d
#   Dev mode:  docker compose -f docker-compose.yml -f docker-compose.dev.yml up

version: "3.9"

# ── Named Volumes ────────────────────────────────────────────────────────────
volumes:
  pg-data:
    driver: local
  redis-data:
    driver: local
  brain-vault:
    driver: local

# ── Networks ─────────────────────────────────────────────────────────────────
networks:
  ceo-net:
    driver: bridge

# ── Services ─────────────────────────────────────────────────────────────────
services:

  # ─────────────────────────────────────────────────────────────────────────
  # app — Vite SPA + Express API server
  # ─────────────────────────────────────────────────────────────────────────
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:-}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:-}
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-/api}
        VITE_APP_VERSION: ${VITE_APP_VERSION:-local}
    image: ceo-simulator:latest
    container_name: ceo-app
    restart: unless-stopped
    ports:
      - "${APP_HOST_PORT:-3001}:3001"
    environment:
      # Runtime — Server-side only (not in bundle)
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3001

      # Database (choose ONE mode)
      DATABASE_MODE: ${DATABASE_MODE:-supabase}   # "supabase" | "postgres" | "sqlite"
      DATABASE_URL: ${DATABASE_URL:-}              # Used when DATABASE_MODE=postgres

      # Supabase (used when DATABASE_MODE=supabase)
      SUPABASE_URL: ${SUPABASE_URL:-}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:-}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:-}

      # Auth / JWT
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      JWT_ACCESS_EXPIRY: ${JWT_ACCESS_EXPIRY:-15m}
      JWT_REFRESH_EXPIRY: ${JWT_REFRESH_EXPIRY:-7d}

      # AI / Claude
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-opus-4-5}
      ANTHROPIC_MAX_TOKENS: ${ANTHROPIC_MAX_TOKENS:-8192}

      # Redis (optional — only relevant when profile=queue)
      REDIS_URL: ${REDIS_URL:-}
      REDIS_ENABLED: ${REDIS_ENABLED:-false}

      # Daemon
      HEARTBEAT_DAEMON_AUTO_START: ${HEARTBEAT_DAEMON_AUTO_START:-true}
      HEARTBEAT_INTERVAL_MS: ${HEARTBEAT_INTERVAL_MS:-30000}

      # CORS
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:3001}

      # Brain vault path (mounted volume)
      BRAIN_ROOT: /app/brain

    volumes:
      # Persist the Obsidian brain vault across container restarts
      - brain-vault:/app/brain
      # Git repos for agent worktrees (optional — large)
      - ${REPOS_HOST_PATH:-./repos}:/app/repos

    networks:
      - ceo-net

    depends_on:
      postgres:
        condition: service_healthy

    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  # ─────────────────────────────────────────────────────────────────────────
  # postgres — Standalone PostgreSQL (replaces Supabase PG in self-hosted mode)
  # ─────────────────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: ceo-postgres
    restart: unless-stopped
    ports:
      # Expose for local psql / Tableplus access.
      # Comment out in production to block external access.
      - "${PG_HOST_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-ceo_simulator}
      POSTGRES_USER: ${POSTGRES_USER:-ceo_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      # Named volume for persistent data
      - pg-data:/var/lib/postgresql/data
      # Init scripts — run once on first container creation only
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    networks:
      - ceo-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-ceo_admin} -d ${POSTGRES_DB:-ceo_simulator}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # ─────────────────────────────────────────────────────────────────────────
  # redis — Optional job queue and session cache
  # Activate with: docker compose --profile queue up -d
  # ─────────────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: ceo-redis
    restart: unless-stopped
    profiles:
      - queue
    ports:
      # Comment out in production
      - "${REDIS_HOST_PORT:-6379}:6379"
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD required when profile=queue}
      --maxmemory ${REDIS_MAX_MEMORY:-256mb}
      --maxmemory-policy allkeys-lru
      --save 60 1
      --loglevel warning
    volumes:
      - redis-data:/data
    networks:
      - ceo-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
```

---

## 5. docker-compose.dev.yml (Override for Local Dev)

**File:** `docker-compose.dev.yml` (project root)

Used with: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

```yaml
# Development overrides — DO NOT use in production
version: "3.9"

services:
  app:
    build:
      target: builder        # Use builder stage for hot-reload support
    command: npm run dev:all  # Runs Vite dev server + tsx server watcher
    environment:
      NODE_ENV: development
      VITE_HMR_PORT: 5173
    ports:
      - "5173:5173"   # Vite dev server (HMR)
      - "3001:3001"   # Express API
    volumes:
      # Live source mount for hot-reload — overrides COPY in Dockerfile
      - .:/app
      - /app/node_modules  # Preserve container node_modules (anonymous volume)

  postgres:
    ports:
      - "5432:5432"    # Always expose in dev

  redis:
    profiles: []       # Remove profile restriction — always available in dev
    ports:
      - "6379:6379"
```

---

## 6. Environment Variable Schema

All variables are sourced from `.env` (gitignored). A `.env.example` file MUST be maintained in source control.

### 6.1 Variable Categories

```
Category A: Runtime Identity
Category B: Database Connection
Category C: Authentication & JWT
Category D: AI / Claude Agent
Category E: Redis / Queue
Category F: Daemon & Timing
Category G: Server & CORS
Category H: Vite Build-Time (VITE_ prefix)
```

### 6.2 Complete Variable Reference

#### Category A — Runtime Identity

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `NODE_ENV` | `enum` | `production` | No | Must be `development \| production \| test` |
| `PORT` | `integer` | `3001` | No | Range: `1024–65535` |
| `VITE_APP_VERSION` | `string` | `unknown` | No | Semver pattern: `\d+\.\d+\.\d+` or `local` |

#### Category B — Database Connection

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `DATABASE_MODE` | `enum` | `supabase` | Yes | Must be `supabase \| postgres \| sqlite` |
| `DATABASE_URL` | `string` | — | Conditional | Required when `DATABASE_MODE=postgres`. Format: `postgresql://user:pass@host:port/db` |
| `SUPABASE_URL` | `string` | — | Conditional | Required when `DATABASE_MODE=supabase`. Format: `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `string` | — | Conditional | Required when `DATABASE_MODE=supabase`. JWT format (3 dot-separated base64 segments) |
| `SUPABASE_ANON_KEY` | `string` | — | Conditional | Required when `DATABASE_MODE=supabase`. JWT format |
| `POSTGRES_DB` | `string` | `ceo_simulator` | No | Alphanumeric + underscores only. Max 63 chars |
| `POSTGRES_USER` | `string` | `ceo_admin` | No | Alphanumeric + underscores only. Max 63 chars |
| `POSTGRES_PASSWORD` | `string` | — | **Yes** | Min 16 chars. Must contain uppercase, lowercase, digit |

#### Category C — Authentication & JWT

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `JWT_SECRET` | `string` | — | **Yes** | Min 32 chars (256-bit). Generated with: `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRY` | `string` | `15m` | No | Vercel ms format: `[0-9]+[smhd]`. Max `1h` |
| `JWT_REFRESH_EXPIRY` | `string` | `7d` | No | Vercel ms format. Max `30d` |

#### Category D — AI / Claude Agent

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `ANTHROPIC_API_KEY` | `string` | — | **Yes** | Format: `sk-ant-[a-zA-Z0-9-_]{40,}` |
| `ANTHROPIC_MODEL` | `string` | `claude-opus-4-5` | No | Must be a valid Anthropic model ID |
| `ANTHROPIC_MAX_TOKENS` | `integer` | `8192` | No | Range: `1–200000`. Must be ≤ model's context window |
| `ANTHROPIC_BUDGET_USD` | `float` | `1.00` | No | Range: `0.01–1000.00`. Two decimal places |

#### Category E — Redis / Queue

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `REDIS_ENABLED` | `boolean` | `false` | No | Must be `true \| false` (string) |
| `REDIS_URL` | `string` | — | Conditional | Required when `REDIS_ENABLED=true`. Format: `redis://:password@host:port` |
| `REDIS_PASSWORD` | `string` | — | Conditional | Required when `profile=queue`. Min 16 chars |
| `REDIS_MAX_MEMORY` | `string` | `256mb` | No | Redis memory notation: `[0-9]+(mb\|gb)`. Max `4gb` |
| `REDIS_TTL_SECONDS` | `integer` | `3600` | No | Range: `60–86400` |

#### Category F — Daemon & Timing

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `HEARTBEAT_DAEMON_AUTO_START` | `boolean` | `true` | No | Must be `true \| false` |
| `HEARTBEAT_INTERVAL_MS` | `integer` | `30000` | No | Range: `5000–300000` (5s – 5min) |
| `AGENT_STALE_THRESHOLD_MS` | `integer` | `90000` | No | Must be > `HEARTBEAT_INTERVAL_MS * 2` |
| `AGENT_DEAD_THRESHOLD_MS` | `integer` | `300000` | No | Must be > `AGENT_STALE_THRESHOLD_MS` |
| `TASK_QUEUE_POLL_MS` | `integer` | `5000` | No | Range: `1000–60000` |

#### Category G — Server & CORS

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `CORS_ORIGINS` | `string` | `http://localhost:3001` | No | Comma-separated list of origins. Each must be valid URL or `*` (wildcard only for dev) |
| `APP_HOST_PORT` | `integer` | `3001` | No | Range: `1024–65535`. Host-side port mapping |
| `PG_HOST_PORT` | `integer` | `5432` | No | Range: `1024–65535` |
| `REDIS_HOST_PORT` | `integer` | `6379` | No | Range: `1024–65535` |
| `REPOS_HOST_PATH` | `string` | `./repos` | No | Valid absolute or relative path |
| `BRAIN_ROOT` | `string` | `/app/brain` | No | Absolute path inside container. Do not override unless volume mount changes |

#### Category H — Vite Build-Time (`VITE_` prefix)

> ⚠️ These are baked into the JavaScript bundle at build time. **Never put secrets here.**

| Variable | Type | Default | Required | Validation Rule |
|----------|------|---------|----------|-----------------|
| `VITE_SUPABASE_URL` | `string` | — | Conditional | Required when using Supabase backend. Same format as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `string` | — | Conditional | The anon/public key only — NOT the service role key |
| `VITE_API_BASE_URL` | `string` | `/api` | No | Must start with `/` or be absolute URL |
| `VITE_APP_VERSION` | `string` | `local` | No | Free-form version string |

---

## 7. Validation Implementation

### 7.1 Server-Side Startup Validation

**File:** `server/config.ts` (to be created)

```typescript
import { z } from 'zod';   // Install: npm install zod

// ── Validation schemas ───────────────────────────────────────────────────────

const databaseModeSchema = z.enum(['supabase', 'postgres', 'sqlite']);

const envSchema = z.object({
  // Runtime Identity
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),

  // Database
  DATABASE_MODE: databaseModeSchema.default('supabase'),
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters (256-bit)'),
  JWT_ACCESS_EXPIRY: z.string().regex(/^\d+[smhd]$/).default('15m'),
  JWT_REFRESH_EXPIRY: z.string().regex(/^\d+[smhd]$/).default('7d'),

  // AI
  ANTHROPIC_API_KEY: z.string().regex(/^sk-ant-/, 'ANTHROPIC_API_KEY must start with sk-ant-'),
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-5'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().min(1).max(200000).default(8192),
  ANTHROPIC_BUDGET_USD: z.coerce.number().min(0.01).max(1000).default(1.0),

  // Redis
  REDIS_ENABLED: z.enum(['true', 'false']).default('false'),
  REDIS_URL: z.string().optional(),
  REDIS_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),

  // Daemon
  HEARTBEAT_DAEMON_AUTO_START: z.enum(['true', 'false']).default('true'),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
  AGENT_STALE_THRESHOLD_MS: z.coerce.number().int().default(90000),
  AGENT_DEAD_THRESHOLD_MS: z.coerce.number().int().default(300000),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3001'),

  // Brain
  BRAIN_ROOT: z.string().default('/app/brain'),
}).superRefine((data, ctx) => {
  // Cross-field validation: DATABASE_MODE dependencies
  if (data.DATABASE_MODE === 'postgres' && !data.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DATABASE_URL is required when DATABASE_MODE=postgres',
      path: ['DATABASE_URL'],
    });
  }
  if (data.DATABASE_MODE === 'supabase') {
    if (!data.SUPABASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SUPABASE_URL required when DATABASE_MODE=supabase', path: ['SUPABASE_URL'] });
    }
    if (!data.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SUPABASE_SERVICE_ROLE_KEY required when DATABASE_MODE=supabase', path: ['SUPABASE_SERVICE_ROLE_KEY'] });
    }
  }

  // Redis URL required if REDIS_ENABLED=true
  if (data.REDIS_ENABLED === 'true' && !data.REDIS_URL) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'REDIS_URL required when REDIS_ENABLED=true', path: ['REDIS_URL'] });
  }

  // Threshold ordering
  if (data.AGENT_STALE_THRESHOLD_MS <= data.HEARTBEAT_INTERVAL_MS * 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'AGENT_STALE_THRESHOLD_MS must be > HEARTBEAT_INTERVAL_MS * 2',
      path: ['AGENT_STALE_THRESHOLD_MS'],
    });
  }
  if (data.AGENT_DEAD_THRESHOLD_MS <= data.AGENT_STALE_THRESHOLD_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'AGENT_DEAD_THRESHOLD_MS must be > AGENT_STALE_THRESHOLD_MS',
      path: ['AGENT_DEAD_THRESHOLD_MS'],
    });
  }
});

// ── Parse & export ───────────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ [Config] Environment validation FAILED:');
  parsed.error.errors.forEach(e => {
    console.error(`   ${e.path.join('.')}: ${e.message}`);
  });
  process.exit(1);  // Hard fail — do not start with invalid config
}

export const config = parsed.data;
export type Config = typeof config;
```

### 7.2 Fail-Fast Behaviour

- Validation runs **before** any Express routes are registered
- Any validation error calls `process.exit(1)` — container restarts and logs are visible
- Docker Compose `restart: unless-stopped` + health check prevents silent bad state

---

## 8. PostgreSQL Init Scripts

**Directory:** `docker/postgres/init/` (mounted read-only)

Scripts run in alphabetical order on first `pg-data` volume creation only.

```
docker/postgres/init/
├── 01-extensions.sql      ← Enable pgcrypto, uuid-ossp
├── 02-schema.sql          ← All CREATE TABLE statements (mirrors Supabase schema)
├── 03-rls-policies.sql    ← Row Level Security policies (see Auth-System-Spec)
├── 04-seed-dev.sql        ← Dev seed data (only included in dev builds via ARG)
└── 05-functions.sql       ← PL/pgSQL helpers (e.g., update_updated_at trigger)
```

**01-extensions.sql:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**05-functions.sql (update trigger):**
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

> ℹ️ Full schema SQL lives in `docker/postgres/init/02-schema.sql`. It is the canonical source of truth for the self-hosted database schema. The Supabase schema is kept in sync via migration files.

---

## 9. Volume Strategy

| Volume | Purpose | Backup Priority |
|--------|---------|----------------|
| `pg-data` | All PostgreSQL data (companies, agents, goals, tickets…) | 🔴 Critical — daily backup |
| `redis-data` | Redis RDB snapshots (job queue state, sessions) | 🟡 Important — Redis reconstructable from PG on restart |
| `brain-vault` | Obsidian markdown vault (`brain/`) — agent memory | 🔴 Critical — git-tracked + volume backup |

### Backup Commands

```bash
# Postgres dump
docker exec ceo-postgres pg_dump -U ceo_admin ceo_simulator > backup-$(date +%Y%m%d).sql

# Brain vault sync to git
docker exec ceo-app sh -c "cd /app/brain && git add -A && git commit -m 'vault backup $(date)' && git push"

# Redis snapshot
docker exec ceo-redis redis-cli -a $REDIS_PASSWORD BGSAVE
docker cp ceo-redis:/data/dump.rdb ./backup-redis-$(date +%Y%m%d).rdb
```

---

## 10. .env.example

**File:** `.env.example` (committed to source control — no real values)

```dotenv
# ── Runtime Identity ─────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001
VITE_APP_VERSION=1.0.0

# ── Database ─────────────────────────────────────────────────────────────────
# Set to: supabase | postgres | sqlite
DATABASE_MODE=postgres

# When DATABASE_MODE=postgres (Docker self-hosted)
DATABASE_URL=postgresql://ceo_admin:CHANGE_ME@postgres:5432/ceo_simulator
POSTGRES_DB=ceo_simulator
POSTGRES_USER=ceo_admin
POSTGRES_PASSWORD=CHANGE_ME_MIN_16_CHARS

# When DATABASE_MODE=supabase (managed cloud)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# ── Auth / JWT ───────────────────────────────────────────────────────────────
# Generate: openssl rand -hex 32
JWT_SECRET=CHANGE_ME_REPLACE_WITH_64_HEX_CHARS
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ── AI / Claude Agent ────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-CHANGE_ME
ANTHROPIC_MODEL=claude-opus-4-5
ANTHROPIC_MAX_TOKENS=8192
ANTHROPIC_BUDGET_USD=1.00

# ── Redis / Queue (optional — activate with --profile queue) ─────────────────
REDIS_ENABLED=false
REDIS_URL=redis://:CHANGE_ME@redis:6379
REDIS_PASSWORD=CHANGE_ME_MIN_16_CHARS
REDIS_MAX_MEMORY=256mb

# ── Daemon & Timing ──────────────────────────────────────────────────────────
HEARTBEAT_DAEMON_AUTO_START=true
HEARTBEAT_INTERVAL_MS=30000
AGENT_STALE_THRESHOLD_MS=90000
AGENT_DEAD_THRESHOLD_MS=300000
TASK_QUEUE_POLL_MS=5000

# ── Server & CORS ────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins
CORS_ORIGINS=http://localhost:3001,https://your-domain.com
APP_HOST_PORT=3001
PG_HOST_PORT=5432
REDIS_HOST_PORT=6379

# ── Paths ────────────────────────────────────────────────────────────────────
REPOS_HOST_PATH=./repos
BRAIN_ROOT=/app/brain
```

---

## 11. Quick-Start Commands

```bash
# 1. Copy env template
cp .env.example .env && nano .env   # Fill in secrets

# 2. Generate JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# 3. Start standard (app + postgres)
docker compose up -d

# 4. Start with Redis queue
docker compose --profile queue up -d

# 5. View logs
docker compose logs -f app
docker compose logs -f postgres

# 6. Run DB migrations (after container is up)
docker exec ceo-app node dist-server/db/migrate.js

# 7. Open psql shell
docker exec -it ceo-postgres psql -U ceo_admin ceo_simulator

# 8. Rebuild app after code changes
docker compose build app && docker compose up -d app

# 9. Full reset (⚠️ destroys all data)
docker compose down -v
```

---

## 12. Acceptance Criteria

> These must pass before this spec is marked complete and the implementation is merged.

| # | Criterion | Test Method |
|---|-----------|-------------|
| AC-01 | `docker compose up -d` starts `app` and `postgres` successfully | `docker compose ps` — all services `Up (healthy)` |
| AC-02 | `app` health check returns HTTP 200 from `/api/health` | `curl http://localhost:3001/api/health` |
| AC-03 | SPA (`/`) loads with correct Pixel HUD theme | Browser visit `http://localhost:3001` |
| AC-04 | `DATABASE_MODE=postgres` routes all DB calls through `DATABASE_URL` | Integration test: create company, verify in PG |
| AC-05 | Missing `JWT_SECRET` causes `process.exit(1)` with clear error log | `docker logs ceo-app` shows field-level error |
| AC-06 | Missing `ANTHROPIC_API_KEY` fails validation before server starts | Same as above |
| AC-07 | `POSTGRES_PASSWORD` shorter than 16 chars is rejected at startup | Zod validation error in logs |
| AC-08 | `pg-data` volume persists data across `docker compose restart` | Insert record, restart, verify record exists |
| AC-09 | Redis profile activates only when `--profile queue` passed | `docker compose ps` — redis absent without flag |
| AC-10 | `brain-vault` volume persists Obsidian vault across restarts | Write file, restart, verify file exists |
| AC-11 | Multi-stage build produces final image ≤ 300 MB | `docker image ls ceo-simulator` — check SIZE |
| AC-12 | Container runs as non-root `ceo-app` user (UID 1001) | `docker exec ceo-app whoami` → `ceo-app` |

---

## 13. Related Specs

- [[Auth-System-Spec]] — JWT middleware, endpoint auth table, RLS policies
- [[Database-Abstraction-Spec]] — `DatabaseAdapter` interface for `postgres` vs `supabase` mode
- [[Factory-Operations-Manual]] — Full SOP for zero-human factory operations
- [[Office-Simulator-Architecture]] — Canvas engine, agent system, overall architecture

---

## 14. Implementation Checklist

- [ ] Create `Dockerfile` (multi-stage) at project root
- [ ] Create `docker-compose.yml` at project root
- [ ] Create `docker-compose.dev.yml` at project root
- [ ] Create `.env.example` (committed, no secrets)
- [ ] Add `.env` to `.gitignore` (if not already)
- [ ] Create `docker/postgres/init/` directory with SQL init scripts
- [ ] Create `server/config.ts` with Zod validation schema
- [ ] Install `zod`: `npm install zod`
- [ ] Update `server/index.ts` to import `config` from `server/config.ts` (replace `process.env.*` direct reads)
- [ ] Update `tsconfig.node.json` to include `server/` in compile output
- [ ] Run all 12 acceptance criteria — document results in `brain/raw/docker-ac-results.md`
- [ ] Update `brain/changelog.md` with implementation completion entry
