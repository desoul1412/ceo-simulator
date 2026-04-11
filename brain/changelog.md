---
tags: [changelog, meta]
date: 2026-04-11
status: active
---

# Changelog

## 2026-04-11 — Task 2.4: ROLE_SEATS Reachability Validation + Bug Fixes

### Validation Results (see [[Role-Seat-Validation]])
Cross-referenced all 6 `ROLE_SEATS` coordinates against `public/assets/default-layout-1.json` furniture placement.

| Role     | Old Seat  | New Seat  | Verdict                          |
|----------|-----------|-----------|----------------------------------|
| CEO      | (4, 3)    | —         | ✅ PASS — correctly between PC(4,2) and CHAIR(4,4) |
| Frontend | (9, 3)    | —         | ✅ PASS — correctly between PC(9,2) and CHAIR(9,4) |
| PM       | (18, 3)   | —         | ✅ PASS — correctly between PC(18,2) and CHAIR(18,4) |
| Backend  | (24, 3)   | —         | ✅ PASS — correctly between PC(24,2) and CHAIR(24,4) |
| DevOps   | **(4,14)**  | **(2,13)** | ❌ FIXED — was in open corridor; now at WOODEN_CHAIR_SIDE desk A |
| QA       | **(9,14)**  | **(9,13)** | ❌ FIXED — off-by-one row; now at WOODEN_CHAIR_SIDE:left desk A |

**Result: 4/6 PASS (no change) · 2/6 FIXED**
All 6 tiles are walkable. The 2 failures were semantic placement bugs — agents were navigable but visually displaced from their furniture.

### Files Modified
- `src/components/PixelOfficeCanvas.tsx` — `ROLE_SEATS` constant updated + inline comments added
- `src/lib/api.ts` — `ROLE_SEATS` in `assignGoal()` updated + inline comment added
- `src/components/CeoPlanFlow.tsx` — `ROLE_SEATS` in `handleApprove()` updated + inline comment added

### Root Cause
The bottom-floor desks use a `DESK_SIDE` pattern where the agent sits at the `WOODEN_CHAIR_SIDE` tile, **not** at the center of the desk cluster. The original coordinates pointed to an empty corridor gap between desk cluster A (rows 12–13) and desk cluster B (rows 16–17).

---

## 2026-04-11 — Docker Deployment Specification v1.0

### Docker Deployment Spec — New Document
- **File**: `brain/wiki/Docker-Deployment-Spec.md` (new, active)
- **Status**: Complete specification; ready for implementation
- Defines full self-hosted Docker Compose architecture as alternative to Vercel + Supabase cloud

### Architecture Documented (Section 2)
- **Service topology**: `app` (Vite SPA + Express), `postgres` (standalone), `redis` (optional, profile: `queue`)
- **Network**: `ceo-net` bridge network — all inter-service communication stays internal
- **3 named volumes**: `pg-data` (critical), `brain-vault` (critical), `redis-data` (important)

### Dockerfile — Multi-Stage (Section 3)
- **Stage 1 `deps`**: `npm ci` only — layer-cached, only invalidated when `package.json` changes
- **Stage 2 `builder`**: TypeScript compile (`tsconfig.node.json`) + Vite SPA bundle (`dist/`)
- **Stage 3 `runner`**: `node:22-alpine` minimal image, non-root user `ceo-app` (UID 1001), ~180 MB final size
- `VITE_*` ARGs baked at build time (public values only — secrets never in `docker history`)
- `/api/health` HEALTHCHECK built into image

### docker-compose.yml (Section 4)
- `app` service: build args for VITE_ vars, 13 runtime env vars, `depends_on: postgres healthy`, brain-vault volume mount
- `postgres` service: `postgres:16-alpine`, `POSTGRES_PASSWORD` required via `:?` syntax, `/docker-entrypoint-initdb.d` init scripts, pg_isready health check
- `redis` service: `redis:7-alpine`, `--profile queue` activation, password-protected (`requirepass`), `allkeys-lru` eviction, RDB persistence
- `docker-compose.dev.yml` override: live source mount, Vite HMR on :5173, Redis profile disabled (always available)

### Environment Variable Schema (Sections 6–7)
- **8 categories**, **40+ variables** fully documented
- **Category A**: Runtime identity (NODE_ENV, PORT, VITE_APP_VERSION)
- **Category B**: Database — `DATABASE_MODE` enum (`supabase|postgres|sqlite`) gates conditional requirements for `DATABASE_URL` vs `SUPABASE_*` vars
- **Category C**: JWT — `JWT_SECRET` min 32 chars; access/refresh expiry regex `[0-9]+[smhd]`
- **Category D**: Anthropic — API key format `sk-ant-*`, budget float validation
- **Category E**: Redis — URL required when `REDIS_ENABLED=true`; memory notation `[0-9]+(mb|gb)`
- **Category F**: Daemon timing — threshold ordering enforced (`STALE > INTERVAL*2`, `DEAD > STALE`)
- **Category G**: Server/CORS — comma-separated origins, host port mappings
- **Category H**: Vite build-time — `VITE_*` prefix, explicitly marked secrets-forbidden

### Zod Validation (`server/config.ts`) (Section 7.1)
- Full Zod schema for all 40+ env vars with type coercion, regex, range checks
- `.superRefine()` cross-field validation: DATABASE_MODE dependencies, Redis URL gating, threshold ordering
- **Fail-fast**: validation errors call `process.exit(1)` before any routes register
- Field-level error messages in log output for fast diagnosis

### PostgreSQL Init Scripts (Section 8)
- `docker/postgres/init/` — 5 numbered SQL files run alphabetically on first volume creation
- `01-extensions.sql`: uuid-ossp, pgcrypto
- `02-schema.sql`: full CREATE TABLE (mirrors Supabase schema — source of truth for self-hosted)
- `03-rls-policies.sql`: RLS policies (see [[Auth-System-Spec]])
- `04-seed-dev.sql`: dev data (ARG-gated)
- `05-functions.sql`: `update_updated_at()` trigger
