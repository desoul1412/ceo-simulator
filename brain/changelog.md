---
tags: [changelog, meta]
date: 2026-04-12
status: active
---

# Changelog

## 2026-04-12 — Task 1.1.4: Vercel Project `vnsir-com` — Config, Env Groups, Security Headers

### Summary

Task 1.1.4 delivers three outcomes:
1. **`vercel.json` updated** — project named `vnsir-com`, security headers added
2. **`brain/wiki/Vercel-Project-Spec.md` created** — full deployment spec with env var groups, security header rationale, 14 acceptance criteria
3. **`brain/00-Index.md` updated** — new "Deployment / DevOps" section; `vercel.json` entry annotated

**Agent:** liam-chen (Project Manager)  
**Conflict risk:** Low — `vercel.json` is not in any open MR by `agent/dev-sharma` branches (verified: their MRs are focused on `DocumentsPage.tsx` / UI components). No shared file edits.

---

### 1. `vercel.json` — Changes

**File:** `vercel.json` (modified)

| Field | Before | After |
|-------|--------|-------|
| `name` | _(absent)_ | `"vnsir-com"` |
| `headers` | _(absent)_ | Three security headers on `"/(.*)"` |

**Headers added:**

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
    ]
  }
]
```

**Existing config preserved unchanged:**
- `$schema`, `framework`, `buildCommand`, `outputDirectory` — untouched
- `rewrites` — untouched (API pass-through + SPA catch-all)

---

### 2. `brain/wiki/Vercel-Project-Spec.md` — New Document

**10 sections, 14 acceptance criteria, 1 operator runbook**

#### Section 1 — Overview
- Renamed project from `ceo-simulator-iota` → `vnsir-com`
- Documents why the name aligns with the VNSIR spec codename

#### Section 2 — Vercel Project Setup
- Full project identity table: name, framework, root dir, build command, output dir, Node version
- GitHub repo linkage: production branch `main`, preview branches all non-main
- `Ignored Build Step` command documented — prevents spurious rebuilds on `brain/*.md`-only commits
- Conflict avoidance: `agent/dev-sharma` preview branches get auto-deployed, NOT set as production

#### Section 3 — Environment Variable Groups

**`production` group (8 variables):**

| Variable | Type |
|----------|------|
| `VITE_SUPABASE_URL` | Plain |
| `VITE_SUPABASE_ANON_KEY` | Secret |
| `SUPABASE_URL` | Plain |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret |
| `ANTHROPIC_API_KEY` | Secret |
| `JWT_SECRET` | Secret (min 32 chars) |
| `NODE_ENV` | Plain (`production`) |
| `VITE_APP_VERSION` | Plain (commit SHA) |

**`preview` group (8 variables):**
- Same keys as production; different secrets (separate JWT_SECRET, ideally lower-quota Anthropic key)
- `NODE_ENV=preview`
- `VITE_APP_VERSION=preview-{SHA}`

**Security rule documented:** `VITE_*` variables are baked into the client bundle — service role keys and JWT secrets must NEVER have `VITE_` prefix.

#### Section 4 — Security Headers

| Header | Value | Protection Against |
|--------|-------|--------------------|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage on cross-origin |

- Future headers catalogued (CSP, Permissions-Policy, HSTS, X-DNS-Prefetch-Control) with rationale for deferral
- CSP deferred because inline styles + canvas in Pixel Art HUD require careful tuning post UI stabilization

#### Section 5 — SPA Routing
- Documents why `/api/:path*` must precede `/(.*)`  
- Explains catch-all returns `index.html` (200) instead of 404 for React Router v6

#### Section 6 — Deployment Workflow
- Production deploy flow (push to `main` → Vercel CI → build → edge deploy)
- Preview deploy flow (any branch push)
- Manual deploy runbook (`vercel --prod --token=...`)

#### Section 7 — Acceptance Criteria (14 ACs)

| Range | Area |
|-------|------|
| VP-01 – VP-04 | Project identity + GitHub linkage |
| VP-05 – VP-06 | Env var groups |
| VP-07 – VP-09 | Security headers (verified via `curl -I`) |
| VP-10 – VP-11 | SPA routing correctness |
| VP-12 – VP-14 | Secret hygiene, build success, ignored build step |

#### Section 8 — Operator Runbook
- Secret rotation procedure
- Adding new env vars (with safety check for `VITE_*`)
- `curl` command to verify headers in production

#### Section 9 — Open Questions (3 items)
- OQ-01: Custom domain (`app.ceo-simulator.com`) — CEO decision pending
- OQ-02: `agent/dev-sharma` preview branch — dedicated Supabase branch? (OPEN)
- OQ-03: CSP pre-launch vs post-v1 — recommend pre-launch

---

### 3. `brain/00-Index.md` — Updates

- **New section added:** "Deployment / DevOps" under Phase 1 Specs
  - `[[Vercel-Project-Spec]]` wikilink added with description
- **Backend section:** `vercel.json` entry updated with security headers annotation + link to `[[Vercel-Project-Spec]]`
- **Header notice:** Updated to reference Task 1.1.4

---

### Files Changed

| File | Change |
|------|--------|
| `vercel.json` | **MODIFIED** — added `"name": "vnsir-com"` + `"headers"` block (3 security headers) |
| `brain/wiki/Vercel-Project-Spec.md` | **NEW** — full deployment spec (v1.0, active) |
| `brain/00-Index.md` | **UPDATED** — Deployment/DevOps section; header notice; backend section annotation |
| `brain/changelog.md` | **UPDATED** (this entry) |

---

## 2026-04-12 — Task 1.1.1: VNSIR Implementation Spec v1.0

### VNSIR Implementation Spec — New Document
- **File**: `brain/wiki/VNSIR-Implementation-Spec.md` (new, active)
- **Task**: 1.1.1
- **Agent**: liam-chen (Project Manager)
- **Status**: Complete spec; source of truth for all frontend pages and route-level requirements

### What Was Specified

**VNSIR** = **V**irtual **N**avigation **S**imulation **I**nterface **R**efactor — codename for the complete frontend page architecture of CEO Simulator v3.

#### Section 1 — Overview
- Defined scope, purpose, and relationship to [[Auth-System-Spec]], [[Migration-Spec]], [[Office-Simulator-Architecture]]
- Auth guard injection points called out for all 14 routes

#### Section 2 — Page Inventory (14 routes)

Full route table sourced directly from `src/router.tsx`:

| # | Route | Component |
|---|-------|-----------|
| P-01 | `/` | `<MasterDashboard />` |
| P-02 | `/company/:id` | `<CompanyView />` → `<CompanyDetail />` |
| P-03 | `/company/:id/agents` | `<CompanyView />` (agents tab) |
| P-04 | `/company/:id/agents/:agentId` | `<AgentDetail />` |
| P-05 | `/company/:id/goals` | `<GoalsPage />` |
| P-06 | `/company/:id/documents` | `<DocumentsPage />` |
| P-07 | `/company/:id/costs` | `<CostsPage />` |
| P-08 | `/company/:id/org-chart` | `<OrgChartPage />` |
| P-09 | `/company/:id/board` | `<ScrumBoard />` |
| P-10 | `/company/:id/merge-requests` | `<MergeRequestsPage />` |
| P-11 | `/company/:id/overview` | `<ProjectOverview />` |
| P-12 | `/company/:id/settings` | `<ProjectSettings />` |
| P-13 | `/settings` | `<SettingsPage />` |
| P-14 | `/settings/:tab` | `<SettingsPage />` (deep-link) |

#### Section 3 — Layout Shell ACs
- `<AppLayout />`: 5 ACs covering shell stability, HUD styling, no layout shift
- `<NavBar />`: 7 ACs covering brand, tabs, active state, routing, responsive collapse

#### Section 4 — Per-Page Acceptance Criteria (83 ACs total)

| Page | ACs Written |
|------|------------|
| MasterDashboard | MD-01 → MD-10 (10 ACs) |
| CompanyView | CV-01 → CV-08 (8 ACs) |
| Agents Tab | AG-01 → AG-08 (8 ACs) |
| AgentDetail | AD-01 → AD-09 (9 ACs) |
| GoalsPage | GL-01 → GL-09 (9 ACs) |
| DocumentsPage | DC-01 → DC-06 (6 ACs) |
| CostsPage | CS-01 → CS-08 (8 ACs) |
| OrgChartPage | OC-01 → OC-07 (7 ACs) |
| ScrumBoard | SB-01 → SB-11 (11 ACs) |
| MergeRequestsPage | MR-01 → MR-07 (7 ACs) |
| ProjectOverview | PO-01 → PO-10 (10 ACs) |
| ProjectSettings | PS-01 → PS-06 (6 ACs) |
| SettingsPage | GS-01 → GS-09 (9 ACs) |

#### Section 5 — Data Flow Diagrams (7 diagrams, ASCII art)
1. Global State Architecture (Zustand ↔ Supabase ↔ OrchestratorAPI ↔ LocalState)
2. Master Dashboard flow (Zustand hydration → CompanyTile render → Realtime sync)
3. CompanyView flow (PixelOfficeCanvas + GoalPanel + ActivityFeed + ApprovalPanel)
4. ScrumBoard flow (fetchTickets → columns → approve/complete sprint)
5. ProjectOverview flow (plans + plan comments + env vars CRUD)
6. AgentDetail lifecycle state machine (active/paused/throttled/terminated)
7. Auth Guard flow (JWT check → owner_id validation → Outlet or Forbidden)

#### Section 6 — User Stories (11 stories across 3 sprints)
- Sprint 1 (Page Completeness): V-01 to V-05
- Sprint 2 (Data Integrity): V-06 to V-09
- Sprint 3 (Auth Integration): V-10 to V-11

#### Section 7 — Open Questions (4 items)
- Q-01: DocumentsPage vault endpoint ownership (avoid editing until resolved — potential conflict with agent/dev-sharma)
- Q-02: CompanyView / agents tab split decision
- Q-03: Auth integration — client-side filter vs server re-query
- Q-04: ScrumBoard drag-and-drop — v1 or stretch?

### Conflict Avoidance Note
Flagged Q-01 explicitly: `DocumentsPage.tsx` may be in agent/dev-sharma's MR scope. No edits were made to that file. Open question documented for coordination.

### Files Changed
- `brain/wiki/VNSIR-Implementation-Spec.md` — **NEW** (spec, v1.0, active)
- `brain/00-Index.md` — **UPDATED** (VNSIR wikilink added to Phase 1 Specs; Navigation section updated from 13 → 14 routes; date updated 2026-04-11 → 2026-04-12)
- `brain/changelog.md` — **UPDATED** (this entry)

---

## 2026-04-11 — Migration Specification v1.0

### Migration Spec — New Document
- **File**: `brain/wiki/Migration-Spec.md` (new, active)
- **Status**: Complete specification; source of truth for all schema definitions

### Tables Catalogued (Section 2) — All 17 Tables
Full column-level schema, type annotations, nullable flags, defaults, and FK relationships documented for every table referenced in the codebase:

| # | Table | Primary Purpose |
|---|-------|----------------|
| 1 | `companies` | Root company entity (status, budget, repo, brain_summary) |
| 2 | `agents` | AI worker agents (runtime, budget, canvas position, lifecycle) |
| 3 | `goals` | Hierarchical goal tree (self-referential parent_id) |
| 4 | `delegations` | CEO → worker task delegation (ephemeral, deleted on completion) |
| 5 | `activity_log` | Human-readable event feed (powers ActivityFeed component) |
| 6 | `tickets` | Kanban work items (approval gate, board_column, sprint scoping) |
| 7 | `ticket_comments` | Threaded comments (human/agent/system author types) |
| 8 | `audit_log` | Structured compliance log (append-only, event_type enum) |
| 9 | `task_queue` | Legacy flat task queue (deprecated — use tickets pipeline) |
| 10 | `token_usage` | Per-invocation LLM cost ledger (input/output tokens + USD) |
| 11 | `agent_sessions` | Claude SDK session tracking (enables multi-turn memory) |
| 12 | `merge_requests` | Git branch + diff review (open/merged/rejected, diff stats) |
| 13 | `notifications` | In-app notification bell (type, read flag, deep link) |
| 14 | `sprints` | Agile sprint containers (triggers auto-next-sprint on complete) |
| 15 | `project_plans` | AI-generated plans (triggers auto-hire, auto-sprint on approve) |
| 16 | `configs` | Three-level config store (global → company → agent scopes) |
| 17 | `project_env_vars` | Per-company env vars (is_secret masking, agent injection) |

### FK Dependency Graph (Section 3)
- Full cascade rule table defined: all child tables CASCADE on company delete
- `tickets.agent_id`, `merge_requests.agent_id`, `token_usage.agent_id` → SET NULL (preserve history)
- `agent_sessions.agent_id` → CASCADE (sessions meaningless without agent)

### Migration File Numbering Convention (Section 4)
- **Supabase**: `YYYYMMDDHHMMSS_snake_case_description.sql` — timestamp-prefixed, generated via `supabase migration new`
- **Docker init**: `NN-kebab-case-description.sql` — two-digit sequence, run once on volume creation
- Canonical Docker init sequence: `01-extensions` → `02-schema` → `03-rls-policies` → `04-functions` → `05-indexes` → `06-seed-dev`
- Naming vocabulary: 10 standard verb prefixes (`create_`, `add_`, `drop_`, `alter_`, `rename_`, `seed_`, `backfill_`, `add_rls_`, `add_index_`, `add_trigger_`)

### Shared Patterns (Section 5)
- Standard column set: `id UUID PK`, `created_at TIMESTAMPTZ`
- `updated_at` auto-trigger pattern: SQL for `update_updated_at()` function documented
- `check_stale_agents()` RPC SQL defined (5-min stale, 30-min dead thresholds)

### Migration Backlog (Section 7)
- 🔴 `users` table + `user_id` FK on companies (auth — see [[Auth-System-Spec]])
- 🔴 UNIQUE constraints missing on `project_env_vars(company_id, key)` and `configs(scope, scope_id, type, key)`
- 🟡 `task_queue` deprecation, `activity_log` 90-day retention, `goals` table migration
- 🟢 Performance indexes, notification cleanup

### Table-to-File Reference Matrix (Section 8)
Cross-reference of all 17 tables against 7 server source files documented.

---

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

---

## 2026-04-11 — Task 2.5: Chair Blocking Decision + furnitureFootprints.ts

### Decision: Chairs are NON-BLOCKING (see [[Role-Seat-Validation]] — Task 2.5 section)

**Verdict:** `CUSHIONED_CHAIR_*` and `WOODEN_CHAIR_*` variants → footprint `{ w: 0, h: 0 }` — zero cells contributed to the walkable grid blocking overlay.

**Core Rationale:**
- Chair tiles ARE `ROLE_SEATS`. Blocking chairs = blocking the agent's own assigned seat.
- DESK_SIDE agents (DevOps at (2,13), QA at (9,13)) sit directly on their chair tile — marking it non-walkable makes those seats permanently unreachable via BFS.
- Chairs are visual affordances rendered beneath agent sprites, not physical obstacles.
- Industry precedent (Pixel Agents, RPG genre): only furniture with a mass larger than one person blocks movement.

**Rejected alternative:** Placing ROLE_SEATS one tile south of each chair. Rejected — breaks visual alignment and complicates layout authoring.

### New File: `src/engine/furnitureFootprints.ts`

Complete furniture collision registry for the office engine.

**Exports:**
| Export | Description |
|--------|-------------|
| `FurnitureFootprint` | Interface: `{ w: number, h: number }` |
| `FURNITURE_FOOTPRINTS` | Registry: maps furniture type key → footprint |
| `resolveFurnitureKey(type)` | Strips variant suffix: `"PC_SIDE:left"` → `"PC_SIDE"` |
| `getFurnitureFootprint(type)` | Lookup with safe fallback `{ w:1, h:1 }` for unknown types |
| `applyFurnitureBlocking(grid, items)` | Mutates WalkableGrid — adds furniture blocking on top of tile-based grid |

**Footprint summary by category:**

| Category | Types | Footprint |
|----------|-------|-----------|
| Desks | DESK_FRONT, DESK_SIDE, DESK_CORNER | w:1-2, h:1-2 (blocking) |
| PCs / Monitors | PC_FRONT_OFF, PC_FRONT_ON, PC_SIDE, PC_SIDE_ON | w:1, h:1 (blocking) |
| **Chairs** | **CUSHIONED_CHAIR_*, WOODEN_CHAIR_*** | **w:0, h:0 (NON-BLOCKING)** |
| Sofas | SOFA_SIDE, SOFA_FRONT | w:2, h:1 (blocking) |
| Storage | BOOKSHELF, FILING_CABINET, SERVER_RACK | w:1-2, h:1-2 (blocking) |
| Appliances | COFFEE_MACHINE, WATER_COOLER, PRINTER | w:1, h:1 (blocking) |
| Décor | PLANT_SMALL | w:0, h:0 (non-blocking); PLANT_LARGE/TALL w:1, h:1 |
| Meeting | MEETING_TABLE, WHITEBOARD, TV_STAND | w:2-3, h:1-2 (blocking) |

**`applyFurnitureBlocking()` logic:**
```typescript
// Non-blocking furniture — skip entirely (zero tiles blocked)
if (fp.w === 0 || fp.h === 0) continue;

// Blocking furniture — mark footprint rect as non-walkable
for (let dr = 0; dr < fp.h; dr++) {
  for (let dc = 0; dc < fp.w; dc++) {
    grid[row + dr][col + dc] = false;
  }
}
```

### Acceptance Criteria — All Met
- [x] All 6 chair variants in registry with `{ w: 0, h: 0 }`
- [x] `applyFurnitureBlocking()` skips zero-footprint items
- [x] Variant suffix stripped before registry lookup (`"WOODEN_CHAIR_SIDE:left"` → `"WOODEN_CHAIR_SIDE"`)
- [x] Safe fallback `{ w:1, h:1 }` for unregistered furniture types
- [x] BFS can still reach chair seat tiles (DevOps: (2,13), QA: (9,13))
- [x] Decision rationale documented in [[Role-Seat-Validation]] — Task 2.5 section

### Files Changed
- `src/engine/furnitureFootprints.ts` — **NEW** (furniture blocking registry + overlay utility)
- `brain/wiki/Role-Seat-Validation.md` — **UPDATED** (Task 2.5 decision section appended; frontmatter tags expanded)
- `brain/changelog.md` — **UPDATED** (this entry)

---

## 2026-04-11 — Phase 1 Index Update (Post-Flight Doc Control)

### Action: `brain/00-Index.md` Updated with All Phase 1 Spec Links

**Agent:** liam-chen (Project Manager)
**Trigger:** POST-FLIGHT — all Phase 1 spec documents confirmed written; index must reflect current vault state per CLAUDE.md §1 PRE-FLIGHT/POST-FLIGHT protocol.

### New Section Added: "Phase 1 Specs" *(top of index, above Architecture)*

8 new Wikilinks registered in `[[00-Index]]`:

| Wikilink | Document | Category |
|----------|----------|----------|
| `[[Migration-Spec]]` | Database Migration Spec v1.0 — 17-table schema, FK graph, naming conventions | Backend & Data |
| `[[Database-Abstraction-Spec]]` | Database Abstraction Spec — Supabase/PostgreSQL/SQLite adapter pattern | Backend & Data |
| `[[Docker-Deployment-Spec]]` | Docker Deployment Spec v1.0 — multi-stage Dockerfile, Compose, 40+ env vars | Backend & Data |
| `[[Auth-System-Spec]]` | Auth System Spec v2.0 — JWT, RLS, users table, per-user company isolation | Auth |
| `[[Auth-Implementation-Roadmap]]` | Auth Implementation Roadmap — user stories, sprint breakdown, ACs | Auth |
| `[[Auth-Executive-Summary]]` | Auth Executive Summary — Spec Complete ✅ / Implementation: Ready 🚀 | Auth |
| `[[Provider-Abstraction-Spec]]` | LLM Provider Abstraction Spec — Anthropic/OpenAI/Ollama unified adapter | LLM / AI |
| `[[Role-Seat-Validation]]` | ROLE_SEATS Reachability Validation & Chair Blocking Decision (Tasks 2.4/2.5) | Canvas / Office Engine |

### Index Structural Changes
- `status` frontmatter: `archived` → `active`
- `date` frontmatter: `2026-04-08` → `2026-04-11`
- Archive warning replaced with active update notice (original handover link preserved)
- Outstanding auth item in Backend section updated to cross-link `[[Auth-System-Spec]]`

### Files Changed
- `brain/00-Index.md` — **UPDATED** (Phase 1 Specs section added; status/date refreshed)
- `brain/changelog.md` — **UPDATED** (this entry)
