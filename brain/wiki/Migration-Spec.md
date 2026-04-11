---
tags: [database, migrations, schema, postgresql, supabase, backend, infrastructure]
date: 2026-04-11
status: active
---

# Migration Specification

**Linked from:** [[00-Index]], [[Docker-Deployment-Spec]], [[Database-Abstraction-Spec]], [[Auth-System-Spec]], [[Factory-Operations-Manual]]

**Version:** 1.0  
**Author:** Liam Chen (Technical Lead)  
**Status:** Active specification — source of truth for all schema definitions

---

## 1. Overview

This spec catalogs every database table referenced in the CEO Simulator codebase, defines the canonical column schema for each, establishes foreign-key relationships, and defines the migration file numbering convention used by both Supabase (cloud) and the self-hosted PostgreSQL init scripts (see [[Docker-Deployment-Spec]] § 8).

**Two migration contexts exist:**

| Context | Location | Convention | Runner |
|---------|----------|------------|--------|
| Supabase cloud | `supabase/migrations/` | `YYYYMMDDHHMMSS_slug.sql` | Supabase CLI `db push` |
| Self-hosted Docker | `docker/postgres/init/` | `NN-slug.sql` (sequential) | `docker-entrypoint-initdb.d` |

Both contexts must stay in sync. The Supabase migrations are the **write-first** source. Docker init scripts are regenerated from the canonical Supabase schema after major releases.

---

## 2. Table Catalog

### 2.1 Overview — All 17 Tables

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CORE ENTITIES                     WORK EXECUTION                        │
│  ─────────────                     ──────────────                        │
│  companies ◄─┐                     task_queue  ──► agents                │
│  agents ────┘│                     tickets     ──► agents, sprints       │
│  goals ──────┤                     ticket_comments ──► tickets           │
│  delegations ┘                     merge_requests  ──► tickets, agents   │
│                                                                          │
│  OBSERVABILITY                     PLANNING                              │
│  ─────────────                     ────────                              │
│  activity_log ──► companies        sprints       ──► companies           │
│  audit_log    ──► companies        project_plans ──► companies           │
│  token_usage  ──► agents                                                 │
│  agent_sessions ──► agents        CONFIGURATION                          │
│  notifications ──► companies       ────────────                          │
│                                    configs       (multi-scope)           │
│                                    project_env_vars ──► companies        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 `companies`

**Purpose:** Root entity for every simulated company. All other tables are scoped to a company via `company_id`.

**Referenced in:** `server/index.ts`, `server/heartbeatDaemon.ts`, `server/taskProcessor.ts`, `src/lib/api.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `name` | `text` | NO | — | Company display name |
| `status` | `text` | NO | `'bootstrapping'` | Enum: `bootstrapping \| growing \| scaling \| dormant` |
| `ceo_goal` | `text` | YES | `null` | Active CEO instruction |
| `budget_spent` | `integer` | NO | `0` | Micro-USD (1 = $0.00001). Use `budget_spent / 100000.0` for display |
| `budget_limit` | `integer` | NO | `1000000` | Micro-USD cap. Default = $10.00 |
| `auto_approve` | `boolean` | NO | `false` | Skip human approval gate for tickets |
| `heartbeat_interval_ms` | `integer` | NO | `30000` | Daemon polling interval override |
| `repo_url` | `text` | YES | `null` | Git repo URL (if connected) |
| `repo_branch` | `text` | YES | `'main'` | Default branch |
| `repo_auth_method` | `text` | YES | `null` | `'token' \| 'ssh' \| null` |
| `repo_token` | `text` | YES | `null` | ⚠ Encrypted at rest — never expose to client |
| `brain_summary` | `text` | YES | `null` | Latest AI-generated company summary |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `status` (for daemon query filtering), `created_at DESC`

---

### 2.3 `agents`

**Purpose:** An AI worker agent belonging to a company. Has a runtime type, budget, tile position, and lifecycle state.

**Referenced in:** `server/index.ts`, `server/agents/agentRunner.ts`, `server/agents/ceo.ts`, `server/agents/worker.ts`, `server/taskProcessor.ts`, `server/ticketProcessor.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `name` | `text` | NO | — | Display name (e.g. "Alice Chen") |
| `role` | `text` | NO | — | `CEO \| PM \| Frontend \| Backend \| DevOps \| QA \| Designer` |
| `color` | `text` | NO | `'#6a7a90'` | Hex color for canvas sprite |
| `sprite_index` | `integer` | NO | `0` | Index into sprite sheet |
| `tile_col` | `integer` | NO | `0` | Canvas grid column position |
| `tile_row` | `integer` | NO | `0` | Canvas grid row position |
| `monthly_cost` | `integer` | NO | `5000` | USD/month for budget display |
| `reports_to` | `uuid` | YES | `null` | FK → `agents.id` (org chart parent) |
| `system_prompt` | `text` | YES | `null` | Base system prompt for LLM |
| `skills` | `jsonb` | NO | `'[]'` | Array of skill strings |
| `memory` | `jsonb` | NO | `'{}'` | Agent's persistent key-value memory |
| `runtime_type` | `text` | NO | `'claude_sdk'` | `claude_sdk \| http \| bash_script \| custom` |
| `runtime_config` | `jsonb` | NO | `'{}'` | Runtime-specific config (model, url, etc.) |
| `budget_limit` | `numeric(10,2)` | NO | `10.00` | USD budget cap |
| `budget_spent` | `numeric(10,4)` | NO | `0.0000` | USD spent to date |
| `status` | `text` | NO | `'idle'` | `idle \| working \| meeting \| break \| throttled` |
| `lifecycle_status` | `text` | NO | `'alive'` | `alive \| stale \| dead \| throttled` |
| `assigned_task` | `text` | YES | `null` | Current task description |
| `progress` | `integer` | NO | `0` | 0–100 percent |
| `active_session_id` | `text` | YES | `null` | Last Claude session ID (for continuation) |
| `last_heartbeat` | `timestamptz` | YES | `null` | Last ping timestamp |
| `heartbeat_status` | `text` | NO | `'alive'` | `alive \| stale \| dead` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `company_id`, `role`, `lifecycle_status`, `last_heartbeat` (for stale-agent RPC)

---

### 2.4 `goals`

**Purpose:** Hierarchical goal tree. CEO goals decompose into sub-goals assigned to teams. Used by GoalsPage and the delegation system.

**Referenced in:** `00-Index.md`, `src/lib/api.ts`, planned for GoalsPage

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `parent_id` | `uuid` | YES | `null` | FK → `goals.id` (self-referential hierarchy) |
| `title` | `text` | NO | — | Goal description |
| `status` | `text` | NO | `'active'` | `active \| completed \| cancelled \| blocked` |
| `assigned_to` | `uuid` | YES | `null` | FK → `agents.id` |
| `priority` | `text` | NO | `'medium'` | `low \| medium \| high \| critical` |
| `progress` | `integer` | NO | `0` | 0–100 percent |
| `due_date` | `date` | YES | `null` | Target completion date |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `company_id`, `parent_id`, `status`

---

### 2.5 `delegations`

**Purpose:** Tracks CEO task delegations to worker agents. Created during `executeCeoGoal`, deleted when all tasks complete.

**Referenced in:** `server/agents/ceo.ts`, `server/taskProcessor.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `to_agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `to_role` | `text` | NO | — | Role name (e.g. `'Frontend'`) |
| `task` | `text` | NO | — | Task description text |
| `progress` | `integer` | NO | `0` | 0–100 percent |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `company_id`, `to_agent_id`, `progress`  
**Note:** Rows are soft-deleted (all deleted) when all delegations for a company reach 100%.

---

### 2.6 `activity_log`

**Purpose:** Human-readable event stream. Powers the ActivityFeed component. Every significant server action appends here.

**Referenced in:** `server/index.ts` (extensively), `server/taskProcessor.ts`, `server/ticketProcessor.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `type` | `text` | NO | — | Event type: `agent-hired \| agent-fired \| task-started \| task-completed \| status-change \| error` |
| `message` | `text` | NO | — | Human-readable description |
| `metadata` | `jsonb` | YES | `null` | Optional structured payload |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `company_id, created_at DESC` (composite — primary feed query), `agent_id`  
**Retention:** Logs older than 90 days should be archived. No auto-delete currently; see backlog.

---

### 2.7 `tickets`

**Purpose:** Work items on the Kanban board. Created by CEO during delegation, progressed through the pipeline by agents, approved/rejected by humans.

**Referenced in:** `server/index.ts`, `server/agents/ceo.ts`, `server/ticketProcessor.ts`, `server/heartbeatDaemon.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `sprint_id` | `uuid` | YES | `null` | FK → `sprints.id` ON DELETE SET NULL |
| `title` | `text` | NO | — | Short ticket title |
| `description` | `text` | YES | `null` | Longer context / acceptance criteria |
| `status` | `text` | NO | `'awaiting_approval'` | `awaiting_approval \| approved \| in_progress \| completed \| cancelled` |
| `board_column` | `text` | NO | `'backlog'` | `backlog \| todo \| in_progress \| review \| done` |
| `priority` | `text` | NO | `'medium'` | `low \| medium \| high \| critical` |
| `goal_ancestry` | `jsonb` | NO | `'[]'` | Ordered array tracing lineage: `[goal, subtask]` |
| `approved_by` | `text` | YES | `null` | Approver display name (human or auto) |
| `approved_at` | `timestamptz` | YES | `null` | Approval timestamp |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `company_id`, `sprint_id`, `agent_id`, `status`, `board_column`

---

### 2.8 `ticket_comments`

**Purpose:** Threaded comments on tickets. Used for audit trail of approvals, rejections, and agent notes.

**Referenced in:** `server/index.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `ticket_id` | `uuid` | NO | — | FK → `tickets.id` ON DELETE CASCADE |
| `author_type` | `text` | NO | — | `human \| agent \| system` |
| `author_id` | `uuid` | YES | `null` | FK → `agents.id` if author_type = `agent` |
| `content` | `text` | NO | — | Markdown-safe comment body |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `ticket_id, created_at ASC`

---

### 2.9 `audit_log`

**Purpose:** Structured security and compliance event log. Used for approvals, rejections, skill changes, heartbeat pulses. Differs from `activity_log` (human-readable feed) in that audit_log is machine-structured with `event_type`.

**Referenced in:** `server/index.ts`, `server/heartbeatDaemon.ts`, `server/ticketProcessor.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | YES | `null` | FK → `companies.id` ON DELETE CASCADE. NULL = system-level event |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `ticket_id` | `uuid` | YES | `null` | FK → `tickets.id` ON DELETE SET NULL |
| `event_type` | `text` | NO | — | `approval \| rejection \| skill_change \| heartbeat \| budget_exceeded \| agent_throttled` |
| `message` | `text` | NO | — | Human-readable description |
| `metadata` | `jsonb` | YES | `null` | Structured diff / before-after payload |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `company_id, created_at DESC`, `event_type`, `agent_id`  
**Note:** Rows are append-only. Never UPDATE or DELETE audit_log rows.

---

### 2.10 `task_queue`

**Purpose:** Legacy flat task queue. Created alongside tickets for backward compatibility. Will be deprecated in favor of the `tickets` pipeline (see comment in `server/agents/ceo.ts:244`).

**Referenced in:** `server/index.ts`, `server/taskProcessor.ts`, `server/agents/ceo.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `type` | `text` | NO | `'execute_subtask'` | Task type discriminator |
| `payload` | `jsonb` | NO | `'{}'` | Arbitrary task parameters (role, task, goal, priority) |
| `status` | `text` | NO | `'pending'` | `pending \| processing \| completed \| failed` |
| `started_at` | `timestamptz` | YES | `null` | Processing start time |
| `completed_at` | `timestamptz` | YES | `null` | Completion time |
| `result` | `jsonb` | YES | `null` | Output: `{ output, costUsd, inputTokens, outputTokens, sessionId }` |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `company_id`, `status`, `created_at ASC` (FIFO queue query)  
**Deprecation:** New code should write to `tickets` only. `task_queue` preserved for daemon compatibility.

---

### 2.11 `token_usage`

**Purpose:** Per-invocation cost ledger. Every agent LLM call appends one row. Aggregated by `GET /api/costs/:companyId`.

**Referenced in:** `server/agents/agentRunner.ts`, `server/agents/ceo.ts`, `server/agents/worker.ts`, `server/index.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `model` | `text` | NO | — | Model identifier (e.g. `claude-sonnet-4-6`) |
| `input_tokens` | `integer` | NO | `0` | Prompt tokens consumed |
| `output_tokens` | `integer` | NO | `0` | Completion tokens generated |
| `cost_usd` | `numeric(10,6)` | NO | `0.000000` | Computed cost in USD |
| `invoked_at` | `timestamptz` | NO | `now()` | Time of invocation (used for ordering) |

**Indexes:** `company_id, invoked_at DESC`, `agent_id`

---

### 2.12 `agent_sessions`

**Purpose:** Tracks each Claude SDK session (conversation thread). Enables multi-turn memory via `active_session_id`. One row per agent invocation.

**Referenced in:** `server/agents/agentRunner.ts`, `server/agents/ceo.ts`, `server/agents/worker.ts`, `server/index.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE CASCADE |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `system_prompt` | `text` | YES | `null` | System prompt snapshot at invocation time |
| `status` | `text` | NO | `'completed'` | `running \| completed \| failed \| aborted` |
| `last_invoked_at` | `timestamptz` | NO | `now()` | |
| `total_input_tokens` | `integer` | NO | `0` | Cumulative across all turns in session |
| `total_output_tokens` | `integer` | NO | `0` | |
| `total_cost_usd` | `numeric(10,6)` | NO | `0.000000` | |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `agent_id`, `company_id`, `last_invoked_at DESC`

---

### 2.13 `merge_requests`

**Purpose:** Represents a git branch + diff opened by an agent after completing a ticket. Tracks code review state (open → merged / rejected).

**Referenced in:** `server/index.ts`, `server/ticketProcessor.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `ticket_id` | `uuid` | YES | `null` | FK → `tickets.id` ON DELETE SET NULL |
| `agent_id` | `uuid` | YES | `null` | FK → `agents.id` ON DELETE SET NULL |
| `title` | `text` | NO | — | `"{role}: {ticket_title}"` |
| `branch_name` | `text` | NO | — | Git branch (e.g. `agent/frontend/fix-auth`) |
| `target_branch` | `text` | NO | `'main'` | Merge target |
| `status` | `text` | NO | `'open'` | `open \| merged \| rejected` |
| `files_changed` | `integer` | NO | `0` | `git diff --stat` count |
| `insertions` | `integer` | NO | `0` | Lines added |
| `deletions` | `integer` | NO | `0` | Lines removed |
| `diff_summary` | `text` | YES | `null` | Newline-separated changed file paths |
| `merged_at` | `timestamptz` | YES | `null` | |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `company_id`, `ticket_id`, `agent_id`, `status`, `branch_name`

---

### 2.14 `notifications`

**Purpose:** In-app notification bell. Surfaced in the NavBar unread count badge. Created by server-side events (sprint complete, MR opened, plan approved, etc.).

**Referenced in:** `server/index.ts` (extensively — every major event emits a notification)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `type` | `text` | NO | — | `system \| merge_request \| plan_submitted \| sprint_complete \| agent_hired \| budget_alert` |
| `title` | `text` | NO | — | Short notification headline |
| `message` | `text` | NO | — | Body text |
| `link` | `text` | YES | `null` | Relative URL to navigate on click |
| `read` | `boolean` | NO | `false` | Dismissed/read flag |
| `created_at` | `timestamptz` | NO | `now()` | |

**Indexes:** `company_id, read, created_at DESC` (unread count query), `company_id`

---

### 2.15 `sprints`

**Purpose:** Agile sprint containers. Tickets belong to a sprint. Sprint completion triggers auto-creation of next sprint from `project_plans`.

**Referenced in:** `server/index.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `name` | `text` | NO | — | Sprint name (e.g. `Sprint 1 — Auth`) |
| `goal` | `text` | YES | `null` | Sprint goal statement |
| `status` | `text` | NO | `'active'` | `planning \| active \| completed \| cancelled` |
| `start_date` | `date` | YES | `null` | Sprint start |
| `end_date` | `date` | YES | `null` | Sprint end target |
| `velocity` | `integer` | YES | `null` | Story points completed (calculated at close) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `company_id`, `status`, `created_at ASC` (chronological sprint list)

---

### 2.16 `project_plans`

**Purpose:** AI-generated structured plans (hiring plan, roadmap, architecture, etc.). Approved plans trigger autonomous execution (auto-hire, auto-sprint, etc.).

**Referenced in:** `server/index.ts`, `server/agents/ceo.ts`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `type` | `text` | NO | — | `hiring_plan \| roadmap \| architecture \| sprint_plan \| custom` |
| `title` | `text` | NO | — | Plan title |
| `content` | `text` | NO | — | Full Markdown content |
| `status` | `text` | NO | `'draft'` | `draft \| approved \| executing \| completed \| archived` |
| `approved_by` | `text` | YES | `null` | Approver name (human or agent) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `company_id`, `type`, `status`, `created_at DESC`

---

### 2.17 `configs`

**Purpose:** Three-level (global → company → agent) configuration store. Used for MCP tool toggles, model overrides, skill enablement, and runtime flags. Supports key-value with JSON values.

**Referenced in:** `server/index.ts` (GET/POST/PATCH/DELETE configs)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `scope` | `text` | NO | — | `global \| company \| agent` |
| `scope_id` | `uuid` | YES | `null` | NULL if scope=global; company_id or agent_id otherwise |
| `type` | `text` | NO | — | Config category: `mcp_tool \| model \| skill \| rule \| runtime_flag` |
| `key` | `text` | NO | — | Config key within the type namespace |
| `value` | `jsonb` | NO | `'{}'` | Config value (scalar, array, or object) |
| `enabled` | `boolean` | NO | `true` | Can disable without deleting |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `scope, scope_id`, `type, key` (effective config merge query), UNIQUE(`scope`, `scope_id`, `type`, `key`)

---

### 2.18 `project_env_vars` *(alias: `env_vars`)*

**Purpose:** Per-company environment variable store. Injected into agent execution context. Secret values masked in API responses.

**Referenced in:** `server/index.ts` as `project_env_vars` (table name). API endpoints use the alias `env-vars`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `company_id` | `uuid` | NO | — | FK → `companies.id` ON DELETE CASCADE |
| `key` | `text` | NO | — | Environment variable name (e.g. `STRIPE_KEY`) |
| `value` | `text` | NO | — | Value (plaintext stored; encrypt at rest in production) |
| `is_secret` | `boolean` | NO | `false` | If true, value is masked in API GET responses |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Auto-updated by trigger |

**Indexes:** `company_id, key` (UNIQUE constraint), `company_id`  
**⚠ Security:** `is_secret = true` rows must be masked before sending to client. Server-side only: decrypt and inject into agent subprocess environment.

---

## 3. Foreign Key Dependency Graph

```
companies
  ├── agents (company_id)
  │     ├── agents (reports_to → self)
  │     ├── delegations (to_agent_id)
  │     ├── tickets (agent_id)
  │     ├── ticket_comments (author_id)
  │     ├── merge_requests (agent_id)
  │     ├── token_usage (agent_id)
  │     ├── agent_sessions (agent_id)
  │     └── audit_log (agent_id)
  ├── goals (company_id)
  │     ├── goals (parent_id → self)
  │     └── goals (assigned_to → agents)
  ├── delegations (company_id)
  ├── activity_log (company_id)
  ├── audit_log (company_id)
  ├── tickets (company_id)
  │     ├── ticket_comments (ticket_id)
  │     ├── merge_requests (ticket_id)
  │     └── audit_log (ticket_id)
  ├── task_queue (company_id)
  ├── token_usage (company_id)
  ├── agent_sessions (company_id)
  ├── notifications (company_id)
  ├── sprints (company_id)
  │     └── tickets (sprint_id)
  ├── project_plans (company_id)
  ├── configs (scope_id — soft FK, scope-dependent)
  └── project_env_vars (company_id)
```

**Cascade rules:**

| Parent | Child | On Delete |
|--------|-------|-----------|
| `companies` | all child tables | `CASCADE` |
| `agents` | `tickets.agent_id` | `SET NULL` (preserve ticket history) |
| `agents` | `merge_requests.agent_id` | `SET NULL` |
| `agents` | `token_usage.agent_id` | `SET NULL` |
| `agents` | `agent_sessions.agent_id` | `CASCADE` |
| `agents` | `ticket_comments.author_id` | `SET NULL` |
| `agents` | `audit_log.agent_id` | `SET NULL` |
| `agents` | `delegations.to_agent_id` | `SET NULL` |
| `tickets` | `ticket_comments` | `CASCADE` |
| `tickets` | `merge_requests.ticket_id` | `SET NULL` |
| `tickets` | `audit_log.ticket_id` | `SET NULL` |
| `sprints` | `tickets.sprint_id` | `SET NULL` |

---

## 4. Migration File Numbering Convention

### 4.1 Supabase Migrations (`supabase/migrations/`)

**Format:** `{TIMESTAMP}_{snake_case_description}.sql`

```
YYYYMMDDHHMMSS_description.sql
│              │
│              └─ snake_case, max 50 chars, describes what changes
└─ UTC timestamp at time of authoring (from `supabase migration new`)
```

**Examples:**
```
supabase/migrations/
├── 20260101000000_initial_schema.sql
├── 20260115120000_add_sprints_table.sql
├── 20260201093000_add_merge_requests.sql
├── 20260210140000_add_configs_table.sql
├── 20260301090000_add_project_plans.sql
├── 20260315110000_add_agent_sessions.sql
├── 20260320080000_add_project_env_vars.sql
├── 20260401120000_add_notifications_read_index.sql
└── 20260410150000_add_heartbeat_status_to_agents.sql
```

**Rules:**
1. **Never edit** an existing migration file that has been applied to any environment.
2. **Always use** `supabase migration new <description>` to generate the timestamp automatically.
3. Each migration is **idempotent** — use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
4. **One concern per file** — avoid mixing unrelated schema changes.
5. Rollback SQL goes in a matching `{TIMESTAMP}_{description}.down.sql` file (optional but recommended for critical tables).
6. Include comments at the top of each file: `-- Migration: {description} | Author: {agent/human} | Date: {YYYY-MM-DD}`.

### 4.2 Docker Init Scripts (`docker/postgres/init/`)

**Format:** `{NN}-{kebab-case-description}.sql`

```
NN-description.sql
│  │
│  └─ kebab-case, describes the concern
└─ Two-digit zero-padded sequence number (01–99)
```

**Canonical sequence:**

| File | Purpose |
|------|---------|
| `01-extensions.sql` | Install `uuid-ossp`, `pgcrypto` |
| `02-schema.sql` | Full `CREATE TABLE` definitions (all 17 tables) |
| `03-rls-policies.sql` | Row-Level Security policies (see [[Auth-System-Spec]]) |
| `04-functions.sql` | `update_updated_at()` trigger function + stored procedures (`check_stale_agents`) |
| `05-indexes.sql` | Non-PK indexes (performance tuning, separated for clarity) |
| `06-seed-dev.sql` | Dev seed data — only runs when `SEED_DB=true` ARG is set |

**Rules:**
1. Docker init scripts run **once** on first volume creation. They are not incremental.
2. `02-schema.sql` is regenerated from the latest Supabase migration state after each major release (via `pg_dump --schema-only`).
3. Gaps in numbering are acceptable (e.g. `07`, `08` reserved for future use).
4. Max sequence: `99`. If more than 99 files are needed, reconsider consolidation.
5. Never number `00-*.sql` — reserved for pre-flight checks if needed.

### 4.3 Naming Vocabulary

Use these standard verb prefixes for migration descriptions:

| Prefix | Use when |
|--------|----------|
| `create_` | New table |
| `add_` | New columns, indexes, constraints to existing table |
| `drop_` | Remove table, column, or constraint |
| `alter_` | Modify column type, rename column |
| `rename_` | Rename table |
| `seed_` | Insert reference / default data |
| `backfill_` | Data migration on existing rows |
| `add_rls_` | Add Row-Level Security policies |
| `add_index_` | Performance index only (no schema change) |
| `add_trigger_` | Add database trigger |

---

## 5. Shared Patterns

### 5.1 Standard Column Set (apply to all tables)

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

Tables with mutable data also include:
```sql
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
```

### 5.2 Auto `updated_at` Trigger

Applied to: `companies`, `agents`, `goals`, `tickets`, `sprints`, `project_plans`, `configs`, `project_env_vars`, `agent_sessions`

```sql
-- Function (defined once in 04-functions.sql)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied per table (example)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 5.3 UUID Extension

All migrations must assume `uuid-ossp` and `pgcrypto` are installed (handled by `01-extensions.sql` or the Supabase platform).

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 5.4 Stale Agent RPC

The heartbeat daemon calls `supabase.rpc('check_stale_agents')`. This function must exist:

```sql
-- Defined in 04-functions.sql
CREATE OR REPLACE FUNCTION check_stale_agents()
RETURNS void AS $$
BEGIN
  -- Mark agents as stale if last_heartbeat > 5 minutes ago
  UPDATE agents
  SET heartbeat_status = 'stale', lifecycle_status = 'stale'
  WHERE last_heartbeat < now() - interval '5 minutes'
    AND heartbeat_status = 'alive'
    AND status NOT IN ('idle', 'break');

  -- Mark agents as dead if last_heartbeat > 30 minutes ago
  UPDATE agents
  SET heartbeat_status = 'dead', lifecycle_status = 'dead'
  WHERE last_heartbeat < now() - interval '30 minutes'
    AND heartbeat_status != 'dead';
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Supabase vs. PostgreSQL Parity

The following Supabase-specific features are used in code and must have PostgreSQL equivalents for self-hosted deployments:

| Supabase Feature | Used by | Self-hosted Equivalent |
|-----------------|---------|----------------------|
| `supabase.rpc('check_stale_agents')` | `heartbeatDaemon.ts` | `CALL check_stale_agents()` via pg stored proc |
| Realtime subscriptions | `src/hooks/useRealtimeSync.ts` | Polling every 5s (configured in `DatabaseAdapter`) |
| Row-Level Security | All tables | Native PostgreSQL RLS (see [[Auth-System-Spec]]) |
| `gen_random_uuid()` | All PKs | Available natively in PostgreSQL 13+ (no extension needed); `uuid-ossp` as fallback |
| Auth schema (`auth.users`) | [[Auth-System-Spec]] | Custom `users` table in `public` schema |

---

## 7. Migration Backlog (Known Gaps)

These schema changes are needed but not yet implemented:

| Priority | Change | Reason |
|----------|--------|--------|
| 🔴 High | Add `users` table + `user_id` FK on `companies` | Multi-tenant auth (see [[Auth-System-Spec]]) |
| 🔴 High | Add `UNIQUE(company_id, key)` on `project_env_vars` | Prevent duplicate env var keys |
| 🔴 High | Add `UNIQUE(scope, scope_id, type, key)` on `configs` | Prevent config duplication |
| 🟡 Medium | Add `activity_log` retention / archive policy | Log bloat prevention after 90 days |
| 🟡 Medium | Add `task_queue` deprecation marker | Schema comment noting planned removal |
| 🟡 Medium | Add `goals` table Supabase migration | Currently only in 00-Index.md; not confirmed in DB |
| 🟢 Low | Add `sprints.start_date`, `end_date` indexes | Sprint calendar view performance |
| 🟢 Low | Add `notifications` scheduled cleanup | Delete `read=true` notifications older than 30 days |

---

## 8. Table-to-File Reference Matrix

Quick lookup: which source files reference which tables.

| Table | server/index.ts | taskProcessor | ticketProcessor | heartbeatDaemon | agents/ceo.ts | agents/worker.ts | agents/agentRunner.ts |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `companies` | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| `agents` | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| `goals` | — | — | — | — | — | — | — |
| `delegations` | ✅ | ✅ | — | — | ✅ | — | — |
| `activity_log` | ✅ | ✅ | ✅ | — | ✅ | — | — |
| `tickets` | ✅ | — | ✅ | ✅ | ✅ | — | — |
| `ticket_comments` | ✅ | — | — | — | — | — | — |
| `audit_log` | ✅ | — | ✅ | ✅ | — | — | — |
| `task_queue` | ✅ | ✅ | — | — | ✅ | — | — |
| `token_usage` | ✅ | — | — | — | ✅ | ✅ | ✅ |
| `agent_sessions` | ✅ | — | — | — | ✅ | ✅ | ✅ |
| `merge_requests` | ✅ | — | ✅ | — | — | — | — |
| `notifications` | ✅ | — | ✅ | — | — | — | — |
| `sprints` | ✅ | — | — | — | — | — | — |
| `project_plans` | ✅ | — | — | — | ✅ | — | — |
| `configs` | ✅ | — | — | — | — | — | — |
| `project_env_vars` | ✅ | — | — | — | — | — | — |

---

*See also: [[Docker-Deployment-Spec]] § 8 — PostgreSQL init scripts | [[Auth-System-Spec]] — RLS policies | [[Database-Abstraction-Spec]] — adapter interface | [[Factory-Operations-Manual]] — execution SOPs*
