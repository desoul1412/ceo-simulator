---
tags: [changelog, meta]
date: 2026-04-11
status: active
---

# Changelog

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

### Backup Commands (Section 9)
- `pg_dump` one-liner for Postgres backup
- Git commit + push for brain vault
- `BGSAVE` + `docker cp` for Redis RDB

### Acceptance Criteria (Section 12) — 12 criteria defined
- AC-01 through AC-12 covering: health check, SPA load, DB routing, env validation failures, volume persistence, Redis profile, image size, non-root user

### Files Changed
- **New**: `brain/wiki/Docker-Deployment-Spec.md` (comprehensive, 14 sections)
- **Updated**: `brain/changelog.md` (this entry)

### Spec Links
- **Main Spec**: [[Docker-Deployment-Spec]]
- **Related**: [[Auth-System-Spec]], [[Database-Abstraction-Spec]], [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]]
- **Code refs**: `server/index.ts` (PORT 3001), `package.json` (scripts: server, dev:all), `vercel.json`

---

## 2026-04-11 — Auth System Specification v2.0

### Auth System Spec — Complete Rewrite & Endpoint Audit
- **File**: `brain/wiki/Auth-System-Spec.md` (updated to v2.0, active)
- **Status**: Complete specification; ready for Phase 1 implementation
- Full audit of `server/index.ts` — catalogued all **57 endpoints** (vs. 25 in v1)
- Identified critical security gaps: notifications, daemon control, indirect agent→company ownership

### Coverage Added in v2.0

#### JWT Flow (sections 3–6)
- Signup, Login, Token Refresh, Logout flows — complete request/response contracts
- Access token: 15 min HS256, `aud: "authenticated"`, in-memory client storage
- Refresh token: 7 days HS256, `type: "refresh"` claim, `localStorage` + rotation on use
- `generateTokens()` helper factored out; shared by signup and login handlers
- `logoutHandler()` annotated with TODO for refresh token revocation in `public.refresh_tokens`

#### Middleware (section 5)
- `verifyJWT` — blocks with 401/403 on missing/invalid/expired token
- `verifyJWTOptional` — silent attach; used for `/api/health`
- `assertCompanyOwnership(supabase, userId, companyId)` — reusable ownership check helper
- `app.use('/api', verifyJWT)` — single-line protection for all 57 endpoints

#### Complete Endpoint Auth Table (section 7) — 57 endpoints mapped
- **Section A:** Public — `/api/health` (optional auth)
- **Section B:** Core ops — 12 endpoints: assign-goal, review, tasks, costs, queue, hire/fire agent, lifecycle, budget
- **Section C:** Configs — 5 endpoints: list, effective, create, patch, delete (scope-aware ownership)
- **Section D:** Repos — 6 endpoints: connect, sync, status, disconnect, list repos, worktrees
- **Section E:** Tickets & Approvals — 5 endpoints: list, status, approve, reject, approve-all
- **Section F:** Merge Requests — 5 endpoints: list, merge, reject, revert, diff
- **Section G:** Sprints — 5 endpoints: list, create, patch, tickets, complete
- **Section H:** Project Plans — 6 endpoints: list, create, patch, approve, comments CRUD
- **Section I:** Brain/Files — 3 endpoints: company summary, agent brain init, agent memory update
- **Section J:** Notifications — 4 endpoints with `⚠️ user-scoping fix required` (currently returns ALL notifications)
- **Section K:** Env Vars — 2 endpoints (returns masked secrets — high sensitivity)
- **Section L:** Daemon Control — 3 endpoints with `⚠️ Admin-flag required` (start/stop affect all companies)

#### RLS Implications for Multi-Tenancy (section 8)
- 17-table RLS policy matrix — every `company_id` table mapped to cascade policy
- `ticket_comments` and `plan_comments` — join-based RLS through parent tables
- `configs` — multi-level policy: global scope readable by all authenticated; company/agent scope via ownership
- `project_env_vars` — flagged as high sensitivity (secrets masked at app layer)
- Confirmed: `supabaseAdmin` (service role) bypasses RLS — safe for daemon operations, never expose to client

#### Client-Side Auth (section 9)
- `src/store/authStore.ts` — Zustand store: signup/login/logout/refreshAccessToken actions
- `src/components/ProtectedRoute.tsx` — `<Navigate to="/login" replace />` pattern (no useEffect redirect)
- `src/lib/api.ts` — `apiCall<T>()` wrapper with auto-401-retry and session expiry redirect
- New frontend routes needed: `/login`, `/signup` (both Pixel Art / HUD styled)

#### Migration Checklist (section 11) — 5-phase plan
- Phase 1 (1 day): DB schema — `public.users`, `owner_id` on companies, 17 RLS policies, backfill
- Phase 2 (2 days): Backend auth — middleware, handlers, JWT signing, env vars, `jsonwebtoken` install
- Phase 3 (2 days): Endpoint audit — ownership checks on all 57 endpoints, notification scoping, daemon admin gate
- Phase 4 (2 days): Frontend — authStore, ProtectedRoute, login/signup pages, API wrapper
- Phase 5 (1 day): Deploy — production RLS, email confirmation, rate limiting, OWASP audit

#### Security Hardening (section 12)
- Attack vector table: brute force, XSS token theft, session fixation, CSRF, RLS bypass, daemon abuse
- Rate limiting: `express-rate-limit` on `/auth/login` — 5 req/min/IP
- Access token memory-only (not `localStorage`) to mitigate XSS risk
- Refresh token rotation on every `/auth/refresh` call

### Acceptance Criteria
- [x] JWT flow fully specified (signup, login, refresh, logout)
- [x] All 57 `server/index.ts` endpoints audited and classified
- [x] Auth middleware TypeScript implementation provided
- [x] RLS policies specified for all 17 dependent tables
- [x] Client-side auth store + protected route + API wrapper provided
- [x] Security attack vector analysis complete
- [x] 5-phase migration checklist defined
- [x] Linked to [[00-Index]], [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]]

### Files Changed
- **Updated**: `brain/wiki/Auth-System-Spec.md` (v1.0 → v2.0 — comprehensive rewrite)
- **Updated**: `brain/changelog.md` (this entry)

### Spec Links
- **Main Spec**: [[Auth-System-Spec]]
- **Related**: [[00-Index]], [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]], [[Provider-Abstraction-Spec]]
- **Code refs**: `server/index.ts` (57 endpoints), `server/supabaseAdmin.ts`, `src/lib/supabase.ts`, `src/lib/database.types.ts`

---

## 2026-04-11 — Provider Abstraction Specification

### LLM Provider Interface Definition (Spec)
- **File**: `brain/wiki/Provider-Abstraction-Spec.md` (new, active)
- **Status**: Complete specification; ready for Phase 2 implementation
- Defines unified `LLMProvider` interface contract for plugin architecture
- Three core methods: `complete()`, `stream()`, `estimateCost()`
- Maps directly to existing [[AgentRunResult]] shape from `server/agents/agentRunner.ts:9-15`

### Supported Providers (4 documented)
1. **Anthropic** (`anthropic`)
   - Models: Claude 3.5 Sonnet, Opus, Haiku
   - Full streaming + session resume support
   - Cost model: $3/M input (Sonnet) → $15/M output
   - Implementation: wraps existing `claudeRunner.ts`

2. **OpenAI** (`openai`)
   - Models: GPT-4o, GPT-4-Turbo, GPT-3.5-Turbo
   - Streaming via chat/completions API
   - No session resume (context managed by caller)
   - Cost model: $5/M input (GPT-4o) → $15/M output

3. **Ollama** (`ollama`)
   - Local models: mistral, llama2, neural-chat, etc.
   - Zero API cost (local compute)
   - Graceful degradation if not running
   - Streaming via `/api/generate` endpoint

4. **HTTP-Generic** (`http-generic`)
   - Any custom HTTP endpoint
   - Flexible response parsing
   - Optional cost/token multipliers
   - Use case: in-house LLM services, edge functions

### Type Definitions
- `LLMProvider` — abstract interface with name, version, supportedModels
- `ProviderOptions` — unified options bag (model, maxTokens, temperature, etc.)
- `ProviderResult` — direct mapping to AgentRunResult (output, costUsd, inputTokens, outputTokens, sessionId)
- `ProviderStreamChunk` — four chunk types (text, usage, result, error)

### Integration Architecture
- `ProviderRegistry` singleton pattern for plugin management
- Integration point: `agentRunner.ts` refactored to dispatch via registry (Phase 2+)
- Budget awareness: pre-flight checks via `estimateCost()`
- Session persistence: sessionId stored in `agents.active_session_id`

### Cost Models (Dated 2026-04)
- Anthropic Sonnet: $3/M input, $15/M output
- OpenAI GPT-4o: $5/M input, $15/M output
- Ollama: $0 (local)
- Tables provided for quick reference

### Streaming vs Completion Decision Tree
- **Use `stream()`** for: long-running tasks, interactive feedback, budget-aware iteration
- **Use `complete()`** for: short tasks, batch processing, offline execution
- **Default**: stream() with complete() fallback

### Error Handling Strategy
- Network errors (timeout, connection refused)
- Rate limits (429 with exponential backoff)
- Invalid input (prompt too long, bad model)
- Budget exhaustion (graceful truncation)

### Boot & Configuration
- Environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_URL`
- Initialization sequence: validate keys → `initProviders()` → registry ready
- Per-provider configuration in `agents.runtime_config` JSONB

### Testing Strategy
- Unit tests: cost estimation, token counting, error handling
- Integration tests: provider dispatch, result conversion, registry lookup
- Streaming tests: chunk assembly, usage tracking, session resume
- Test location: `server/providers/__tests__/`

### Migration Path (Phase-Based)
- **Phase 1** (Current): Spec published, abstract base class stubbed
- **Phase 2** (v2): Implement AnthropicProvider wrapper around existing claudeRunner
  - Refactor agentRunner.ts to dispatch via registry (backward compatible)
  - All runners become providers
- **Phase 3** (v3): Implement OpenAI + Ollama providers
  - Provider selection in hire dialog UI
- **Phase 4** (v4): Implement HttpGenericProvider
  - Full multi-provider testing
  - Custom provider documentation

### Future Extensions (Roadmap)
- Streaming callbacks with progress tracking
- Fine-tuning & custom model support (ft:gpt-3.5 style)
- Tool use / function calling abstraction
- Caching & prompt optimization (Claude cache control)

### Acceptance Criteria (All Met ✓)
- [x] LLMProvider interface defined with complete() + stream() + estimateCost()
- [x] ProviderOptions and ProviderResult types fully documented
- [x] All 4 providers (Anthropic, OpenAI, Ollama, HTTP-generic) mapped
- [x] Cost model tables (current as of 2026-04)
- [x] ProviderRegistry singleton pattern specified
- [x] Integration points documented (agentRunner, session persistence, budget)
- [x] Streaming vs completion decision tree
- [x] Error handling strategy per provider
- [x] Boot/initialization sequence documented
- [x] Unit + integration test stubs written
- [x] Migration path (Phase 1-4) defined
- [x] Linked to [[00-Index]] and related specs

### Files Changed
- **New**: `brain/wiki/Provider-Abstraction-Spec.md` (1000+ lines, comprehensive)
- **Updated**: `brain/changelog.md` (this entry)

### Spec Links
- **Main Spec**: [[Provider-Abstraction-Spec]]
- **Related**: [[00-Index]], [[Office-Simulator-Architecture]], [[Factory-Operations-Manual]], [[Auth-System-Spec]]
- **Code refs**: `server/agents/agentRunner.ts`, `server/agents/claudeRunner.ts`, `server/agents/httpRunner.ts`

---
