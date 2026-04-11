---
tags: [plan, implementation_plan]
date: 2026-04-11
status: active
---

# Implementation Plan

> Directive: "Review this project, this is a multi agents framework that can help me work with any project, it still in testing but I want it to be an open-source ready product that uses can use with their own server, databases and LLM models. Please start planning with this approach"
> Size: medium | Cost: $4.8351

Now I have complete understanding of the codebase. Let me produce the implementation plan.

---

# 📋 Implementation Plan — CEO Simulator → Open-Source Multi-Agent Framework

## Executive Summary

This plan transforms a working but tightly-coupled multi-agent framework (hardcoded to Anthropic Claude SDK + Supabase) into a **self-hostable, provider-agnostic, open-source product** that users can deploy with their own server, databases, and LLM models.

**Current State**: 14 server files, 40+ frontend components, 13 routes, 3 agent runtimes (Claude SDK, HTTP, Bash), all hardcoded to Supabase + Anthropic. Zero auth. Zero tests on server. Zero containerization.

**Target State**: Provider-agnostic LLM layer, database abstraction (Supabase/Postgres/SQLite), JWT auth, Docker compose for one-command deployment, comprehensive test suite, OpenAPI docs.

---

## Phase 1: Foundation — Specs, Schema & Configuration
**Goal**: Establish specifications, extract the database schema into versioned migrations, and build environment/configuration validation — so every subsequent phase has a stable contract to build against.
**Duration**: Week 1 (5 days)
**Assigned Roles**: PM, Backend
**Dependencies**: None (kickoff phase)

### Tasks

- [ ] **(Role: PM)** — Write `brain/wiki/Provider-Abstraction-Spec.md`: Define the `LLMProvider` interface contract (`complete()`, `stream()`, `estimateCost()`), mapping to the existing `AgentRunResult` shape at `server/agents/agentRunner.ts:9-15`. Document supported providers: Anthropic, OpenAI, Ollama, HTTP-generic.
- [ ] **(Role: PM)** — Write `brain/wiki/Database-Abstraction-Spec.md`: Define `DatabaseAdapter` interface covering every Supabase call pattern found in the codebase (`.from().select()`, `.rpc()`, `.insert()`, `.update()`, `.delete()`, `.eq()`, `.in()`, `.order()`, `.limit()`, `.single()`). Document supported backends: Supabase, raw PostgreSQL (via `pg`), SQLite (for local dev).
- [ ] **(Role: PM)** — Write `brain/wiki/Auth-System-Spec.md`: Define JWT-based auth flow — signup, login, token refresh, per-user company isolation. Map current unprotected endpoints from `server/index.ts` to required auth middleware. Document RLS implications for multi-tenancy.
- [ ] **(Role: PM)** — Write `brain/wiki/Docker-Deployment-Spec.md`: Define `docker-compose.yml` architecture: `app` (Vite SPA + Express server), `postgres` (standalone), `redis` (optional for queue). Document environment variable schema with validation rules.
- [ ] **(Role: PM)** — Write `brain/wiki/Migration-Spec.md`: Catalog all tables referenced in code — `companies`, `agents`, `goals`, `delegations`, `activity_log`, `tickets`, `ticket_comments`, `audit_log`, `task_queue`, `token_usage`, `agent_sessions`, `merge_requests`, `notifications`, `sprints`, `project_plans`, `configs`, `env_vars`. Define migration file numbering convention.
- [ ] **(Role: Backend)** — Create `server/migrations/` directory. Extract SQL DDL for all 17+ tables from Supabase dashboard into numbered migration files: `001_companies.sql`, `002_agents.sql`, `003_goals.sql`, etc. Include all columns referenced in `server/agents/agentRunner.ts` (lines 39-44, 67-85, 88-101), `server/ticketProcessor.ts`, `server/index.ts`.
- [ ] **(Role: Backend)** — Create `server/migrations/017_users.sql` — the new `users` table for OSS multi-tenancy: `id`, `email`, `password_hash`, `display_name`, `created_at`. Add `owner_id UUID REFERENCES users(id)` column to `companies` table.
- [ ] **(Role: Backend)** — Create `server/migrations/018_rpc_functions.sql` — extract Postgres RPC functions referenced in code: `claim_next_ticket` (`ticketProcessor.ts:17`), `check_stale_agents` (`heartbeatDaemon.ts:47`).
- [ ] **(Role: Backend)** — Create `server/config/env.ts` — centralized environment variable validation. Replace scattered `process.env.X!` assertions (currently in `server/supabaseAdmin.ts:8-9`, `src/lib/supabase.ts:3-4`) with typed, validated config object using `zod`. Define required vs. optional vars with defaults.
- [ ] **(Role: Backend)** — Create `server/config/schema.ts` — TypeScript interfaces for all configuration: `ServerConfig`, `DatabaseConfig`, `LLMProviderConfig`, `AuthConfig`. These become the contract for all provider implementations.
- [ ] **(Role: PM)** — Update `brain/00-Index.md` with new spec links. Append all Phase 1 actions to `brain/changelog.md`.

### Definition of Done — Phase 1
- All 5 spec documents exist in `brain/wiki/` with YAML frontmatter (`tags`, `date`, `status: active`)
- ≥17 numbered migration `.sql` files in `server/migrations/`
- `server/config/env.ts` validates all env vars and throws descriptive errors on missing required vars
- `server/config/schema.ts` exports typed interfaces for all config sections
- All existing code still runs unchanged (no breaking changes)

---

## Phase 2: LLM Provider Abstraction Layer
**Goal**: Decouple the framework from `@anthropic-ai/claude-agent-sdk` so users can plug in any LLM (OpenAI, Ollama, local models) via a unified interface.
**Duration**: Week 2 (5 days)
**Dependencies**: Phase 1 `Provider-Abstraction-Spec.md` must be complete
**Assigned Roles**: AI Engineer, Backend

### Tasks

- [ ] **(Role: AI Engineer)** — Create `server/providers/llm/types.ts`: Define `LLMProvider` interface based on the existing `AgentRunResult` shape (`agentRunner.ts:9-15`). Methods: `execute(prompt, systemPrompt, options): AsyncIterable<LLMStreamEvent>`, `estimateCost(inputTokens, outputTokens): number`. Define `LLMStreamEvent` union type: `{ type: 'text', content }`, `{ type: 'tool_use', name, input }`, `{ type: 'result', costUsd, inputTokens, outputTokens, sessionId }`.
- [ ] **(Role: AI Engineer)** — Create `server/providers/llm/anthropic.ts`: Wrap existing `@anthropic-ai/claude-agent-sdk` `query()` calls (currently in `claudeRunner.ts:74`, `worker.ts:143`, `ceo.ts:112`) into the `LLMProvider` interface. This is a **zero-behavior-change refactor** — same SDK, new abstraction.
- [ ] **(Role: AI Engineer)** — Create `server/providers/llm/openai.ts`: Implement `LLMProvider` for OpenAI API (`gpt-4o`, `gpt-4o-mini`). Map tool definitions from Claude format to OpenAI function calling format. Handle streaming response format differences.
- [ ] **(Role: AI Engineer)** — Create `server/providers/llm/ollama.ts`: Implement `LLMProvider` for Ollama local models (`llama3`, `codellama`, `mistral`). Handle the `http://localhost:11434/api/generate` endpoint. Note: tool use may be limited — document graceful degradation.
- [ ] **(Role: AI Engineer)** — Create `server/providers/llm/registry.ts`: Provider factory function `createLLMProvider(config: LLMProviderConfig): LLMProvider`. Reads provider type from config (`anthropic | openai | ollama | http`), instantiates the correct class. Singleton cache per config hash.
- [ ] **(Role: Backend)** — Refactor `server/agents/claudeRunner.ts`: Replace direct `import { query } from '@anthropic-ai/claude-agent-sdk'` with `import { createLLMProvider } from '../providers/llm/registry'`. The `executeClaudeAgent()` function at line 29 becomes `executeLLMAgent()` — generic, provider-agnostic. Session resume (`options.resume` at line 63) becomes provider-specific via adapter pattern.
- [ ] **(Role: Backend)** — Refactor `server/agents/worker.ts`: Replace direct Claude SDK usage (line 1: `import { query }`) with the LLM provider registry. The `executeWorkerTask()` function (line 85) should resolve the provider from the agent's `runtime_config.provider` field, falling back to the global default.
- [ ] **(Role: Backend)** — Refactor `server/agents/ceo.ts`: Replace `import { query }` (line 1) with provider registry. Both `executeCeoGoal()` (line 58) and `executeCeoProjectReview()` (line 287) must use the abstracted provider. The `model: 'sonnet'` references (lines 121, 338) become configurable.
- [ ] **(Role: Backend)** — Update `server/agents/agentRunner.ts` `executeAgent()` (line 37): The `switch` on `ctx.runtimeType` at line 48 should add a new case `'llm_provider'` that uses the registry. Keep `claude_sdk` as a backward-compatible alias that routes through the Anthropic provider.
- [ ] **(Role: Backend)** — Add `provider` and `model` fields to `agents` table migration. Update `server/index.ts` hire-agent endpoint (line 583) to accept `provider` parameter. Default: read from env `DEFAULT_LLM_PROVIDER`.

### Definition of Done — Phase 2
- `server/providers/llm/` contains 5 files: `types.ts`, `anthropic.ts`, `openai.ts`, `ollama.ts`, `registry.ts`
- All 3 agent executors (`claudeRunner.ts`, `worker.ts`, `ceo.ts`) use the provider registry — zero direct SDK imports
- Setting `DEFAULT_LLM_PROVIDER=openai` + `OPENAI_API_KEY=sk-...` in `.env` makes the entire system use OpenAI
- Anthropic path is fully backward-compatible — existing deployments work without config changes
- Each provider has at least a smoke test (see Phase 5)

---

## Phase 3: Database Abstraction Layer
**Goal**: Decouple from Supabase client so users can run on raw PostgreSQL, SQLite, or keep Supabase. Enable `npm run migrate` for schema setup.
**Duration**: Week 2–3 (5 days, overlaps with Phase 2)
**Dependencies**: Phase 1 migrations + `Database-Abstraction-Spec.md` must be complete
**Assigned Roles**: Backend, DevOps

### Tasks

- [ ] **(Role: Backend)** — Create `server/providers/db/types.ts`: Define `DatabaseAdapter` interface. Methods must cover the Supabase query builder patterns used across the codebase: `from(table).select(columns).eq(col, val).order(col, opts).limit(n).single()`, `from(table).insert(row).select().single()`, `from(table).update(row).eq(col, val)`, `from(table).delete().eq(col, val)`, `rpc(fnName, params)`. Return types: `{ data, error }`.
- [ ] **(Role: Backend)** — Create `server/providers/db/supabase.ts`: Wrap the existing `@supabase/supabase-js` client as a `DatabaseAdapter`. This is a **zero-behavior-change refactor** — same Supabase, new interface. Directly wraps current `supabaseAdmin.ts`.
- [ ] **(Role: Backend)** — Create `server/providers/db/postgres.ts`: Implement `DatabaseAdapter` using the `pg` package directly. Translate `.from('agents').select('*').eq('company_id', id).order('created_at')` into parameterized SQL queries. Handle `.single()` → `LIMIT 1`, `.rpc()` → `SELECT fn_name($1, $2)`.
- [ ] **(Role: Backend)** — Create `server/providers/db/sqlite.ts`: Implement `DatabaseAdapter` using `better-sqlite3`. For local dev / single-user mode. Map PostgreSQL-specific features (JSON columns like `memory`, `runtime_config` in agents table) to SQLite JSON1 extension.
- [ ] **(Role: Backend)** — Create `server/providers/db/registry.ts`: Factory function `createDatabaseAdapter(config: DatabaseConfig): DatabaseAdapter`. Reads `DB_PROVIDER` from env (`supabase | postgres | sqlite`).
- [ ] **(Role: Backend)** — Replace ALL `import { supabase } from './supabaseAdmin'` calls across the server. There are **10 files** that import it: `agentRunner.ts`, `ceo.ts`, `claudeRunner.ts`, `worker.ts`, `heartbeatDaemon.ts`, `index.ts`, `memoryManager.ts`, `repoManager.ts`, `taskProcessor.ts`, `ticketProcessor.ts`. Each must use `getDatabase()` from the registry instead.
- [ ] **(Role: DevOps)** — Create `server/migrate.ts`: CLI tool that reads `server/migrations/*.sql` in order, tracks applied migrations in a `_migrations` table, and applies pending ones. Support `--up`, `--down`, `--status` flags. Must work with all 3 DB providers.
- [ ] **(Role: DevOps)** — Add `"migrate"` and `"migrate:status"` scripts to `package.json`. Add `pg` and `better-sqlite3` as optional peer dependencies (not required unless that provider is selected).
- [ ] **(Role: Backend)** — Refactor `src/lib/supabase.ts` (frontend client): Make it provider-aware. If `VITE_DB_PROVIDER=supabase`, use Supabase JS client with Realtime. If `VITE_DB_PROVIDER=api_only`, all data flows through the Express API (no direct DB access from frontend). The `useRealtimeSync.ts` hook must gracefully degrade to polling when Supabase Realtime isn't available.

### Definition of Done — Phase 3
- `server/providers/db/` contains 5 files: `types.ts`, `supabase.ts`, `postgres.ts`, `sqlite.ts`, `registry.ts`
- `npm run migrate` applies all 18+ migration files to a fresh database
- Setting `DB_PROVIDER=postgres` + `DATABASE_URL=postgres://...` makes the entire server use raw PG
- Setting `DB_PROVIDER=sqlite` + `SQLITE_PATH=./data.db` makes the server use SQLite (single-user mode)
- Zero `import { supabase }` in any server file except `server/providers/db/supabase.ts`
- Frontend falls back to API polling when Supabase Realtime is unavailable

---

## Phase 4: Authentication & Multi-Tenancy
**Goal**: Add JWT-based auth so each user sees only their own companies and agents. Enable the framework for multi-user deployment.
**Duration**: Week 3 (4 days)
**Dependencies**: Phase 3 database abstraction (needs `users` table + adapter)
**Assigned Roles**: Backend, Frontend

### Tasks

- [ ] **(Role: Backend)** — Create `server/auth/` module: `server/auth/jwt.ts` (sign/verify with `jsonwebtoken`), `server/auth/hash.ts` (bcrypt password hashing), `server/auth/middleware.ts` (Express middleware that extracts + validates JWT from `Authorization: Bearer <token>` header, attaches `req.user` with `{ id, email }`).
- [ ] **(Role: Backend)** — Create auth API endpoints in `server/index.ts`: `POST /api/auth/register` (email, password, display_name → JWT), `POST /api/auth/login` (email, password → JWT + refresh token), `POST /api/auth/refresh` (refresh_token → new JWT), `GET /api/auth/me` (returns current user profile).
- [ ] **(Role: Backend)** — Apply auth middleware to ALL existing endpoints in `server/index.ts`. Every route handler (currently ~40 endpoints starting at line 405) must: (a) require valid JWT, (b) filter queries by `req.user.id` via `owner_id` on `companies` table. The `/api/health` endpoint remains public.
- [ ] **(Role: Backend)** — Add `owner_id` filtering: Every `supabase.from('companies').select(...)` call must include `.eq('owner_id', req.user.id)`. Every company-scoped endpoint must verify the authenticated user owns the target company before processing.
- [ ] **(Role: Backend)** — Create `server/auth/optional.ts`: "optional auth" mode where `AUTH_ENABLED=false` (default for local dev) skips all auth checks and assigns a hardcoded `user.id`. This preserves the existing single-user experience for self-hosters who don't need auth.
- [ ] **(Role: Frontend)** — Create `src/lib/auth.ts`: Client-side auth module — `login()`, `register()`, `logout()`, `getToken()`, `isAuthenticated()`. Store JWT in `localStorage` (with refresh logic). Create `AuthContext` React context provider.
- [ ] **(Role: Frontend)** — Create `src/components/LoginPage.tsx` and `src/components/RegisterPage.tsx`: Pixel-art / HUD styled auth pages consistent with existing design system. Wire to `/api/auth/login` and `/api/auth/register`.
- [ ] **(Role: Frontend)** — Update `src/router.tsx`: Add auth-protected route wrapper. Redirect unauthenticated users to `/login`. Add `/login` and `/register` routes.
- [ ] **(Role: Frontend)** — Update `src/lib/orchestratorApi.ts`: Inject `Authorization: Bearer ${token}` header into every `fetch()` call (there are 50+ fetch calls in this file). Create a wrapper function `apiFetch(url, options)` that auto-injects the header.

### Definition of Done — Phase 4
- `POST /api/auth/register` creates user and returns JWT
- `POST /api/auth/login` validates credentials and returns JWT
- All 40+ API endpoints reject requests without valid JWT (when `AUTH_ENABLED=true`)
- User A cannot see User B's companies/agents/tickets
- `AUTH_ENABLED=false` preserves current single-user behavior (no login required)
- Frontend login/register pages render with pixel-art HUD styling
- All `orchestratorApi.ts` fetch calls include auth header

---

## Phase 5: Testing Infrastructure
**Goal**: Establish comprehensive test coverage across the new abstraction layers and existing untested modules. Set up the testing framework for ongoing development.
**Duration**: Week 3–4 (5 days, overlaps with Phase 4)
**Dependencies**: Phases 2 + 3 must be complete (need abstractions to mock against)
**Assigned Roles**: QA, Backend

### Tasks

- [ ] **(Role: QA)** — Create `server/__tests__/setup.ts`: Test harness using vitest. Set up in-memory SQLite database adapter for test isolation. Create factory functions: `createTestUser()`, `createTestCompany()`, `createTestAgent()`, `createTestTicket()`. Each test gets a fresh DB.
- [ ] **(Role: QA)** — Write unit tests for `server/providers/llm/registry.ts`: Test provider resolution for each type (`anthropic`, `openai`, `ollama`). Test fallback behavior when provider is missing. Test config validation. Target: 10+ test cases.
- [ ] **(Role: QA)** — Write unit tests for `server/providers/db/` adapters: Test the query builder → SQL translation for `postgres.ts` and `sqlite.ts`. Cover: `select + eq + order + limit + single`, `insert + select`, `update + eq`, `delete + eq`, `rpc`. Use snapshot testing for generated SQL. Target: 20+ test cases.
- [ ] **(Role: QA)** — Write unit tests for `server/agents/agentRunner.ts`: Mock the LLM provider to return canned responses. Test the full `executeAgent()` flow: status update → provider call → session recording → token usage tracking → budget update → memory extraction. Target: 8+ test cases.
- [ ] **(Role: QA)** — Write unit tests for `server/ticketProcessor.ts`: Test `processNextTicket()` flow with mocked DB. Cover: atomic claim, budget check (`line 63-77`), worktree creation, agent execution, MR creation, sprint completion check. Cover error paths: budget exhausted, agent paused, claim failure. Target: 12+ test cases.
- [ ] **(Role: QA)** — Write unit tests for `server/auth/`: Test JWT signing/verification, password hashing, middleware auth extraction, optional auth mode. Target: 10+ test cases.
- [ ] **(Role: QA)** — Write integration tests for API endpoints: Test the full request cycle for key endpoints — `/api/auth/register`, `/api/auth/login`, `/api/hire-agent`, `/api/assign-goal`, `/api/approve/:ticketId`. Use supertest with the Express app. Target: 15+ test cases.
- [ ] **(Role: Backend)** — Write mock LLM provider `server/providers/llm/mock.ts`: Returns deterministic responses for testing. Configurable: latency, cost, token counts, error simulation. Used by all agent tests.
- [ ] **(Role: QA)** — Write frontend component tests: Add tests for `LoginPage`, `RegisterPage`, `HireAgentDialog`, `ApprovalPanel`, `CeoGoalPanel`. Use `@testing-library/react`. Target: 10+ test cases.
- [ ] **(Role: QA)** — Configure test coverage reporting: Add `vitest.config.ts` coverage settings. Generate `lcov` reports. Set minimum coverage threshold: 60% for new code in `server/providers/`, `server/auth/`.

### Definition of Done — Phase 5
- `npm run test` runs all tests (existing + new) with 0 failures
- ≥85 new test cases across server + frontend
- Coverage report generated; `server/providers/` and `server/auth/` at ≥60% coverage
- Mock LLM provider enables fully offline test runs (no API keys required)
- All tests complete in <30s on CI

---

## Phase 6: Docker & Self-Hosting Infrastructure
**Goal**: One-command deployment via `docker compose up`. Users can run the full stack locally without any cloud dependencies.
**Duration**: Week 4 (4 days)
**Dependencies**: Phases 2, 3, 4 must be complete
**Assigned Roles**: DevOps, Backend

### Tasks

- [ ] **(Role: DevOps)** — Create `Dockerfile` (multi-stage): Stage 1: `node:22-alpine` build stage — install deps, `tsc -b`, `vite build`. Stage 2: `node:22-alpine` runtime — copy built assets + server, expose port 3001, `CMD ["node", "dist/server/index.js"]`. Express serves both API and static SPA.
- [ ] **(Role: DevOps)** — Create `docker-compose.yml`: Services: `app` (the Dockerfile), `postgres` (PostgreSQL 16 with volume mount), optional `redis` (for future queue scaling). Health checks on all services. Environment variables from `.env`.
- [ ] **(Role: DevOps)** — Create `docker-compose.override.yml` for local dev: Mounts source code as volumes, runs `npm run dev:all` for hot reload, exposes debug ports.
- [ ] **(Role: DevOps)** — Create `scripts/setup.sh`: First-run script that: (1) copies `.env.example` → `.env` with prompts, (2) runs `docker compose up -d postgres`, (3) runs `npm run migrate`, (4) creates default admin user, (5) starts the app. Make it work on macOS, Linux, and WSL.
- [ ] **(Role: Backend)** — Unify server + frontend serving: Modify `server/index.ts` to serve Vite-built static files from `dist/` in production mode. Add `app.use(express.static('dist'))` + SPA fallback for client-side routing. Remove dependency on separate Vite dev server in production.
- [ ] **(Role: DevOps)** — Create `.env.example` (comprehensive): Document every environment variable with comments. Categories: `# Server`, `# Database`, `# LLM Provider`, `# Auth`, `# Git/Repo`, `# Optional Features`. Include safe defaults for local dev.
- [ ] **(Role: DevOps)** — Create `scripts/backup.sh` and `scripts/restore.sh`: Database backup/restore scripts that work with all 3 DB providers. For Postgres: `pg_dump/pg_restore`. For SQLite: file copy.
- [ ] **(Role: Backend)** — Add `GET /api/setup/status` endpoint: Returns whether the system is initialized (has admin user, migrations applied, LLM provider configured). Powers first-run setup wizard in frontend.

### Definition of Done — Phase 6
- `docker compose up` starts the full stack from scratch in <60s
- `scripts/setup.sh` guides a new user through first-time configuration
- PostgreSQL data persists across container restarts via Docker volumes
- The SPA is served by Express in production (single port, no CORS needed)
- `.env.example` documents every env var with descriptions and defaults

---

## Phase 7: Documentation & OSS Polish
**Goal**: Make the project ready for public open-source release. README, contributing guide, API docs, and architecture diagrams.
**Duration**: Week 4–5 (4 days)
**Dependencies**: All prior phases substantially complete
**Assigned Roles**: PM, Frontend, DevOps

### Tasks

- [ ] **(Role: PM)** — Rewrite `README.md` for OSS: Quick start (Docker one-liner), manual setup, architecture overview, screenshots, provider configuration tables (LLM providers + DB providers), feature list, license.
- [ ] **(Role: PM)** — Create `docs/ARCHITECTURE.md`: System diagram (ASCII or Mermaid), data flow from goal → CEO reasoning → delegation → agent execution → MR. Map to actual source files.
- [ ] **(Role: PM)** — Create `docs/SELF-HOSTING.md`: Step-by-step guides for: Docker Compose, bare metal (Node + Postgres), Railway/Fly.io deployment. Include provider-specific setup: Anthropic API key, OpenAI API key, Ollama local, custom HTTP endpoint.
- [ ] **(Role: PM)** — Create `docs/API.md`: OpenAPI-style documentation for all ~40 endpoints. Group by resource (Auth, Companies, Agents, Tickets, Sprints, Plans, Merge Requests, Configs). Include request/response examples.
- [ ] **(Role: PM)** — Create `CONTRIBUTING.md`: Development setup, code style (TypeScript strict, ESLint config), PR process, test requirements, branch naming conventions.
- [ ] **(Role: Frontend)** — Create `src/components/SetupWizard.tsx`: First-run setup page that checks `/api/setup/status` and guides users through: (1) admin account creation, (2) LLM provider selection + API key, (3) first company creation. Pixel-art HUD styling.
- [ ] **(Role: Frontend)** — Create `src/components/ProviderSettings.tsx`: Settings page for configuring LLM providers, database connection, and feature flags. Integrate into existing `SettingsPage.tsx` (currently has General, Skills, MCP, Rules tabs — add "Providers" tab).
- [ ] **(Role: DevOps)** — Create `LICENSE` file (MIT). Create `.github/ISSUE_TEMPLATE/` with bug report and feature request templates. Create `.github/PULL_REQUEST_TEMPLATE.md`.

### Definition of Done — Phase 7
- `README.md` enables a new user to go from zero to running in <10 minutes
- All ~40 API endpoints documented with examples
- Setup wizard successfully guides first-time users through configuration
- Provider settings UI allows changing LLM/DB config without editing `.env`
- `CONTRIBUTING.md` enables external contributors to submit PRs

---

## Phase 8: CI/CD Pipeline & Release
**Goal**: Automated build, test, and release pipeline. Publish Docker images and npm package.
**Duration**: Week 5 (3 days)
**Dependencies**: Phase 5 (tests) + Phase 6 (Docker)
**Assigned Roles**: DevOps, QA

### Tasks

- [ ] **(Role: DevOps)** — Create `.github/workflows/ci.yml`: Trigger on PR + push to `main`. Steps: checkout → install (`npm ci`) → lint (`npm run lint`) → type check (`tsc --noEmit`) → unit tests (`npm run test`) → build (`npm run build`). Fail on any step.
- [ ] **(Role: DevOps)** — Create `.github/workflows/docker.yml`: Trigger on tag push (`v*`). Build multi-platform Docker image (`linux/amd64`, `linux/arm64`). Push to GitHub Container Registry (`ghcr.io`). Tag as `latest` + semver.
- [ ] **(Role: DevOps)** — Create `.github/workflows/release.yml`: On tag push, create GitHub Release with auto-generated changelog. Attach built artifacts (Docker image link, setup script).
- [ ] **(Role: QA)** — Add integration test step to CI: Spin up `docker compose -f docker-compose.test.yml up` with PostgreSQL + app. Run API integration tests against the containerized stack. Tear down after.
- [ ] **(Role: DevOps)** — Create `docker-compose.test.yml`: Minimal test stack with ephemeral PostgreSQL (no volumes). App configured with mock LLM provider. Used by CI for integration tests.
- [ ] **(Role: QA)** — Add E2E smoke test: Playwright test that: starts app → registers user → creates company → hires agent → assigns goal → verifies delegation appears. Runs in CI against Docker stack.

### Definition of Done — Phase 8
- Every PR triggers lint + type check + unit tests automatically
- Merges to `main` build and push Docker image to `ghcr.io`
- Tagged releases create GitHub Releases with changelog
- Integration tests run in CI against real PostgreSQL
- E2E smoke test validates the full user flow

---

## Testing Strategy

| Layer | Tool | Scope | Coverage Target |
|-------|------|-------|-----------------|
| **Unit** | vitest | Provider adapters, auth, config validation, memory manager, worktree manager | 70% line coverage |
| **Integration** | vitest + supertest | API endpoints with real DB (SQLite in-memory) | All endpoints have ≥1 happy path + 1 error path test |
| **E2E** | Playwright | Full user flow: register → create company → hire agent → assign goal → verify MR | 1 critical path test |
| **Contract** | vitest | LLM provider interface compliance — each provider implements all methods correctly | 100% interface coverage |
| **Mocking** | `server/providers/llm/mock.ts` | Deterministic LLM responses for offline testing. No API keys needed in CI. | - |

**TDD Circuit Breaker** (per CLAUDE.md §4): If any test fails 3 consecutive times during development, HALT and document in `brain/changelog.md`.

---

## CI/CD Pipeline

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐     ┌────────────┐
│  PR Open │────▶│   Lint    │────▶│ Type     │────▶│ Unit      │────▶│  Build     │
│          │     │ (eslint)  │     │ Check    │     │ Tests     │     │ (vite+tsc) │
└─────────┘     └──────────┘     │ (tsc)    │     │ (vitest)  │     └────────────┘
                                  └──────────┘     └──────────┘            │
                                                                            ▼
┌──────────┐     ┌──────────────┐     ┌──────────────┐              ┌────────────┐
│  Merge   │────▶│ Docker Build │────▶│ Integration  │◀─────────────│  PR Merged │
│  to main │     │ + Push GHCR  │     │ Tests (PG)   │              └────────────┘
└──────────┘     └──────────────┘     └──────────────┘

┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Tag v*  │────▶│ Docker Multi │────▶│ GitHub       │
│  push    │     │ -platform    │     │ Release      │
└──────────┘     └──────────────┘     └──────────────┘
```

---

## Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **LLM provider abstraction breaks Claude session resume** | High — session persistence is core to multi-turn agent work (`claudeRunner.ts:63`) | Medium | Keep Anthropic adapter as thin wrapper around existing SDK. Session resume is Anthropic-specific — other providers use stateless calls with full context injection. Document limitation in provider spec. |
| **Database abstraction performance regression** | Medium — adding a query builder layer adds overhead | Low | Benchmark key queries (ticket claim, agent heartbeat) before/after. SQLite adapter is for dev only — production targets Postgres. |
| **Supabase Realtime removal breaks live updates** | High — `useRealtimeSync.ts` powers live agent status | Medium | Implement SSE (Server-Sent Events) fallback in Express. When `DB_PROVIDER !== supabase`, the server pushes events via `/api/events` SSE endpoint. Frontend detects and auto-switches. |
| **Docker image size bloats** | Low — affects download time | Medium | Multi-stage build. Alpine base. `.dockerignore` excludes `node_modules`, `brain/`, `.git/`. Target: <200MB compressed. |
| **Auth breaks existing single-user deployments** | High — would block current users from upgrading | High | `AUTH_ENABLED=false` (default) skips all auth. No login required. Only enable for multi-user deployments. Migration adds `owner_id` with nullable default. |
| **SQLite limitations with concurrent agents** | Medium — SQLite has write-locking issues | Low | SQLite mode is explicitly "single-user dev mode". Document limitation. Use WAL mode. Recommend Postgres for production. |

---

## Phase Dependency Graph

```
Phase 1 (Foundation)
  ├──▶ Phase 2 (LLM Abstraction)
  ├──▶ Phase 3 (DB Abstraction)  ──▶ Phase 4 (Auth)
  │                                       │
  │    Phase 2 + Phase 3 ────────────▶ Phase 5 (Testing)
  │                                       │
  │    Phase 2 + Phase 3 + Phase 4 ──▶ Phase 6 (Docker)
  │                                       │
  │    All above ────────────────────▶ Phase 7 (Docs & Polish)
  │                                       │
  └──  Phase 5 + Phase 6 ───────────▶ Phase 8 (CI/CD & Release)
```

**Parallelism opportunities**:
- Phase 2 (LLM) and Phase 3 (DB) can run **in parallel** after Phase 1
- Phase 5 (Testing) can start as soon as Phase 2 OR 3 delivers its first adapter
- Phase 7 (Docs) PM tasks can start during Phase 6

---

## Budget Allocation by Phase

| Phase | Primary Cost Driver | Estimated Agent Budget |
|-------|--------------------|-----------------------|
| 1 — Foundation | PM spec writing + Backend migrations | $15 (PM) + $10 (Backend) |
| 2 — LLM Abstraction | AI Engineer new providers + Backend refactor | $18 (AI Eng) + $12 (Backend) |
| 3 — DB Abstraction | Backend adapters + DevOps migration tool | $15 (Backend) + $8 (DevOps) |
| 4 — Auth | Backend auth module + Frontend pages | $10 (Backend) + $8 (Frontend) |
| 5 — Testing | QA test suites across all layers | $15 (QA) + $5 (Backend mock) |
| 6 — Docker | DevOps containerization | $10 (DevOps) + $3 (Backend) |
| 7 — Docs & Polish | PM documentation + Frontend wizard | $8 (PM) + $6 (Frontend) |
| 8 — CI/CD | DevOps pipelines + QA integration | $6 (DevOps) + $4 (QA) |
| **Total** | | **~$153** |

---

## Summary — Critical Path

The **critical path** is: **Phase 1 → Phase 3 → Phase 4 → Phase 6 → Phase 8**

Database abstraction is the bottleneck because it touches every server file (10 files import `supabaseAdmin`), and auth depends on it. LLM abstraction (Phase 2) runs in parallel and is important but less blocking — the HTTP and Bash runners already work without Claude SDK.

**Week 1**: Specs + Migrations (Phase 1)
**Week 2**: LLM + DB abstraction in parallel (Phases 2+3)
**Week 3**: Auth + Testing begins (Phases 4+5)
**Week 4**: Docker + Docs (Phases 6+7)
**Week 5**: CI/CD + Release (Phase 8)
