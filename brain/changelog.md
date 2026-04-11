---
tags: [changelog, meta]
date: 2026-04-11
status: active
---

# Changelog

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

## 2026-04-10 — UI Overhaul: Compact Agent Grid, Goals+Costs Merge, Office Fill

### Office Layout v2
- Canvas now takes ~65% width (flex: 2), agent grid ~35% — fills all available space
- Agent cards redesigned: compact 3-column grid showing pixel avatar + role + status + pending badge
- Click any card to open full-detail modal with scrollable activity, ticket approvals, edit buttons
- `AgentCard.tsx` exports `PixelAvatar` component (reusable CSS sprite renderer)
- Empty grid slots show "+ Hire" placeholder up to 9 agents

### Goals + Costs Merge
- `GoalsPage.tsx` now includes: Active Goal, Master Plan Progress (moved from Board), Delegation Tree, Agent Cost Cards, Sprint History
- Agent Cost Cards: 3-column grid with pixel avatar, role, daily/weekly usage %, cost bar
- Removed "Costs" tab from NavBar (route still exists for deep links)

### Board Cleanup
- Removed master plan progress panel from ScrumBoard (now in Goals)
- Board is pure kanban: sprint selector, agent filter, 5-column drag-drop, burndown

---

## 2026-04-10 — Unified Office+Agents, Sprint Auto-Transition, Brain Directories, Board Checklist, Custom Requirements

### Unified Agent + Office View (Feature 6)
- New `AgentCard.tsx` component — pixel avatar (CSS sprite from char_N.png), status dot, real-time activity feed, pending ticket approvals
- Redesigned `CompanyDetail.tsx` layout: Office canvas (left 50%) + Agent cards (right 50%) + CEO directive (bottom)
- Removed separate "Agents" tab from NavBar — merged into "Office" tab
- Each agent card expands to show activity stream and approval buttons
- Hire button integrated into agent cards header

### Custom Requirements for Project Regeneration (Feature 5)
- `ProjectOverview.tsx` — toggle-able requirements textarea before "Regenerate with CEO"
- Requirements passed to `POST /api/companies/:id/review` body
- `server/agents/ceo.ts` — `executeCeoProjectReview()` accepts optional `customRequirements` param, injected into CEO prompt

### Master Plan Checklist on Board (Feature 4)
- `ScrumBoard.tsx` — collapsible "Master Plan Progress" panel between top bar and kanban columns
- Parses approved master_plan markdown into phases with task checklists
- Each phase shows progress bar + task completion (cross-referenced with done tickets)
- Overall progress bar with percentage
- Current sprint phase highlighted
- "Complete Sprint" button when burndown >= 90%
- `completeSprint(sprintId)` API client function

### Feature 1: Sprint Auto-Transition
- `checkSprintCompletion(sprintId)` helper — detects when all tickets in a sprint are done/cancelled
- Auto-marks sprint as completed, then parses master_plan phases to create the next sprint + tickets
- `parseMasterPlanPhases(content)` parser for `### Phase N:` headers and `- [ ] Task` checklist items
- Hooked into: `PATCH /api/tickets/:id/column`, `PATCH /api/tickets/:id`, `POST /api/tickets/:id/reject`
- New endpoint: `POST /api/sprints/:id/complete` for manual sprint completion with auto-transition

### Feature 2: Per-Company Brain Directory
- `updateCompanyBrainSummary(companyId)` helper — writes `brain/{company-slug}/summary.md`
- Summary includes YAML frontmatter, current sprint, agent count, ticket progress, completed sprints list
- New endpoint: `POST /api/companies/:id/brain/update-summary`
- Auto-triggered on sprint completion

### Feature 3: Per-Agent Brain Directory
- `initAgentBrain(companyId, agentId)` helper — creates `brain/{company-slug}/{agent-slug}/` with soul.md, context.md, memory.md
- `updateAgentMemory(companyId, agentId, ticketTitle)` helper — appends completed ticket entries to memory.md
- New endpoints: `POST /api/companies/:companyId/agents/:agentId/brain/init`, `POST /api/companies/:companyId/agents/:agentId/brain/update-memory`
- Hooked into: `POST /api/hire-agent` (auto-init), hiring_plan approval (auto-init), ticket column move to done (memory update)

### Hooks Summary
- `PATCH /api/tickets/:id/column` (done) -> checkSprintCompletion + updateAgentMemory
- `PATCH /api/tickets/:id` (board_column=done) -> checkSprintCompletion + updateAgentMemory
- `POST /api/tickets/:id/reject` -> checkSprintCompletion
- `POST /api/hire-agent` -> initAgentBrain
- `POST /api/plans/:id/approve` (hiring_plan) -> initAgentBrain per auto-hired agent
- Sprint completion -> updateCompanyBrainSummary

## 2026-04-08 — Wave 2: Agent-Agnostic Runtimes + Session Resume + Skill Injection + Mobile UI

### Agent-Agnostic Runtime Abstraction (W2.1)
- `server/agents/agentRunner.ts` — Universal `executeAgent()` dispatcher with `AgentRunner` interface
- `server/agents/claudeRunner.ts` — Claude Agent SDK runner (extracted from worker.ts)
  - Supports session resume via `options.resume = sessionId`
  - Per-agent memory injection, budget awareness
- `server/agents/httpRunner.ts` — HTTP endpoint runner
  - POST task JSON to any URL, parse JSON response
  - Config: `{ url, method, headers, timeout }`
  - Any service that accepts a POST = a hireable agent
- `server/agents/bashRunner.ts` — Bash/script runner
  - Executes any shell command, passes task as AGENT_TASK env var
  - Parses JSON stdout or falls back to plain text
  - Config: `{ command, args, cwd, env, timeout }`
- `agents.runtime_type` column: `claude_sdk | http_endpoint | bash_script | custom`
- `agents.runtime_config` JSONB: runtime-specific configuration
- Hire dialog updated with runtime selector (Claude SDK / HTTP / Bash)

### Session Resume Across Heartbeats (W2.2)
- `agents.active_session_id` column stores last Claude session ID
- `claudeRunner.ts` passes `options.resume = activeSessionId` when available
- Agent picks up exact conversation context from previous heartbeat
- No from-scratch restarts — persistent agent state across executions

### Runtime Skill Injection API (W2.3)
- `POST /api/agents/:id/inject-skill` — adds skill to agent immediately
- Updates `agents.skills[]` + adds to `agents.memory.shortTerm`
- Logged to `audit_log` with event_type: 'system'
- Next heartbeat/task automatically uses the new skill in its prompt

### Mobile-Responsive UI (W2.4)
- Added CSS media queries for `max-width: 768px`
- Sidebar stacks below content on mobile
- Header collapses (subtitle hidden)
- Content padding reduced
- Pulse animation keyframes for CEO thinking state

### HireAgentDialog Updated
- Runtime type selector: Claude SDK / HTTP / Bash
- HTTP: URL input field
- Bash: command input field
- Budget cap input (USD, default $10, auto-throttle)
- Model selector only shown for Claude SDK runtime

### Ticket Processor Updated
- Now uses `executeAgent()` instead of `executeWorkerTask()`
- Fetches full agent row including `runtime_type`, `runtime_config`, `active_session_id`
- Passes `AgentContext` with all fields to universal dispatcher

### New Files
- `server/agents/agentRunner.ts` — universal dispatcher
- `server/agents/claudeRunner.ts` — Claude SDK runner with session resume
- `server/agents/httpRunner.ts` — HTTP endpoint runner
- `server/agents/bashRunner.ts` — Bash/script runner

### Modified Files
- `server/ticketProcessor.ts` — uses agentRunner instead of worker.ts
- `server/index.ts` — added `/api/agents/:id/inject-skill` endpoint, hire accepts runtime params
- `src/components/HireAgentDialog.tsx` — runtime selector, budget input
- `src/index.css` — mobile breakpoints, pulse animation

### Supabase Migration: `wave2_agent_runtime_types`
- `agents.runtime_type`, `agents.runtime_config`, `agents.active_session_id`

### Gap Analysis: 14/14 Paperclip features now covered
- All MISSING → DONE
- Remaining partial: session resume (implemented but untested in production)

### Test Results: 39/39 passing, 558kB JS

---

## 2026-04-08 — Wave 1: Heartbeat Daemon + Tickets + Approvals + Per-Agent Budgets

### Heartbeat Daemon (W1.1)
- `server/heartbeatDaemon.ts` — `setInterval` every 30s, auto-processes approved tickets
- Checks all active companies, claims + executes next approved ticket per company
- Marks stale agents via `check_stale_agents()` RPC
- Logs heartbeat pulses to `audit_log`
- Auto-starts on server boot, controllable via `/api/daemon/start|stop|status`

### Ticket System (W1.3)
- New `tickets` table: replaces flat task_queue with hierarchical threaded work
  - `parent_ticket_id` — nested sub-tickets
  - `goal_ancestry text[]` — full context chain (CEO goal → delegation → subtask)
  - `status`: open → awaiting_approval → approved → in_progress → completed/failed/cancelled
  - `approved_by`, `approved_at` — approval audit trail
- `ticket_comments` table: threaded conversations per ticket (agent/system/human authors)
- `audit_log` table: detailed tool-call level logging (event_type, tool_name, tool_input)
- `claim_next_ticket()` PG function: atomic claim with `FOR UPDATE SKIP LOCKED` — no race conditions
- `server/ticketProcessor.ts` — ticket-based executor with budget checks, goal ancestry injection, comment threading

### Approval Gates (W1.4)
- CEO delegates → tickets created as `awaiting_approval` (unless `auto_approve` is on)
- `POST /api/approve/:ticketId` — approve single ticket, logs to audit_log
- `POST /api/reject/:ticketId` — reject with reason
- `POST /api/approve-all/:companyId` — bulk approve all pending
- `ApprovalPanel.tsx` — shows pending tickets with ✓ APPROVE / × REJECT buttons
- Approve All button when multiple pending
- Active + completed tickets shown below

### Per-Agent Budgets (W1.2)
- `agents.budget_limit` (default $10) + `agents.budget_spent` columns
- Ticket processor checks budget before execution
- If budget exhausted → agent auto-throttled, ticket released back to queue
- Budget logged to audit_log with `event_type: 'budget_check'`
- `PATCH /api/agents/:agentId/budget` — adjust budget (unthrottles agent)

### Agent Lifecycle Controls (W1.bonus)
- `agents.lifecycle_status`: active | paused | throttled | terminated
- `PATCH /api/agents/:agentId/lifecycle` — control agent state
- Ticket processor skips paused/throttled/terminated agents
- Logged to audit_log

### Server Startup
- Heartbeat daemon auto-starts on `npm run server`
- Console shows: `Heartbeat: ● daemon active (30s interval)`

### New Files
- `server/heartbeatDaemon.ts`, `server/ticketProcessor.ts`
- `src/components/ApprovalPanel.tsx`

### Modified Files
- `server/index.ts` — 10+ new endpoints (tickets, approvals, lifecycle, budget, daemon)
- `server/agents/ceo.ts` — creates tickets with approval gates instead of flat tasks
- `src/lib/orchestratorApi.ts` — ticket, approval, lifecycle, daemon API client
- `src/components/CompanyDetail.tsx` — added ApprovalPanel

### Supabase Migration: `wave1_tickets_budgets_approvals`
- `tickets`, `ticket_comments`, `audit_log` tables
- `agents.budget_limit`, `agents.budget_spent`, `agents.lifecycle_status`
- `companies.heartbeat_interval_ms`, `companies.auto_approve`
- `claim_next_ticket()` atomic function

### Test Results: 39/39 passing, 556kB JS

---

## 2026-04-08 — Phase 5b/5c: Three-Level Config System (Skills, MCP, Rules)

### Config CRUD API
- `GET /api/configs?scope=&scope_id=&type=` — list configs with filters
- `GET /api/configs/effective/:agentId` — merged config (global → company → agent cascade)
- `POST /api/configs` — create config entry
- `PATCH /api/configs/:id` — update value/enabled/key
- `DELETE /api/configs/:id` — remove config

### ConfigManager Component (reusable at all 3 levels)
- `src/components/ConfigManager.tsx` — used by Settings, ProjectSettings, and AgentDetail
- Template quick-add: 8 skill templates, 3 MCP templates, 5 rule templates
- Custom add: name + value text input → creates new config
- Toggle enable/disable (disabling at lower level removes inherited entry)
- Delete button per entry
- Shows scope context ("Global defaults", "Project overrides", "Agent-specific")

### Settings Page (rewritten)
- `/settings/skills` → `<ConfigManager type="skill" scope="global" />`
- `/settings/mcp` → `<ConfigManager type="mcp_server" scope="global" />`
- `/settings/rules` → `<ConfigManager type="rule" scope="global" />`
- General tab: shows config cascade explanation

### ProjectSettings Page (new)
- `/company/:id/settings` → company-level overrides for skills, MCP, rules
- "Config" tab added to NavBar company tabs
- Links to Global Settings from sidebar

### AgentDetail (enhanced)
- Agent-specific config sections for each type (skill, mcp_server, rule)
- Uses same ConfigManager component at `scope="agent"`

### Files
- `server/index.ts` — 5 new config CRUD endpoints
- `src/components/ConfigManager.tsx` (new)
- `src/components/ProjectSettings.tsx` (new)
- `src/components/SettingsPage.tsx` (rewritten)
- `src/components/AgentDetail.tsx` (added agent-level configs)
- `src/components/NavBar.tsx` (added Config tab)
- `src/router.tsx` (added /company/:id/settings route)
- `src/lib/orchestratorApi.ts` (added fetchConfigs, createConfig, updateConfig, deleteConfig, fetchEffectiveConfigs)

### Test Results: 39/39 passing, 552kB JS

---

## 2026-04-08 — Phase 4: Dynamic Agent Hiring (Auto + Manual)

### Server Endpoints
- `POST /api/hire-agent` — creates agent with auto-generated or custom config:
  - Auto mode: picks name from pool, assigns role defaults (skills, prompt, color, sprite, desk)
  - Manual mode: accepts custom name, systemPrompt, skills[], model selection
  - Auto-assigns desk position (picks next available from 9 positions)
  - Sets `reports_to` to CEO agent
  - Logs hire to activity_log
- `DELETE /api/agents/:agentId` — fires agent, logs to activity_log

### HireAgentDialog Component
- Two modes: **Quick Hire** (one-click) and **Custom Hire** (full config)
- Quick Hire: select role → auto-generates name, skills, prompt, model
- Custom Hire:
  - Role selector (6 predefined + custom text input)
  - Name input (auto if empty)
  - System prompt textarea with role-default placeholder
  - Skills picker (18 skill checkboxes)
  - Model selector (haiku / sonnet / opus)
- Preview shows effective config before hiring

### AgentsPage Updated
- "Hire Agent" card opens HireAgentDialog
- After hire: reloads company data from Supabase to show new agent
- Shows "◆ Claude-powered hiring" when orchestrator connected

### Files
- `server/index.ts` — added `/api/hire-agent`, `/api/agents/:agentId` endpoints
- `src/components/HireAgentDialog.tsx` (new)
- `src/components/AgentsPage.tsx` (rewritten with hire integration)
- `src/lib/orchestratorApi.ts` — added `hireAgent()`, `fireAgent()`

### Test Results: 39/39 passing, 544kB JS

---

## 2026-04-08 — Phase 3: Real Cost Tracking + Heartbeats + Agent Memory

### Real Cost Tracking
- `CostsPage.tsx` — fully rewritten with live Claude API token data:
  - Total cost, input/output tokens, invocation count from `token_usage` table
  - Per-invocation log with agent role, token counts, cost, timestamp
  - Per-agent cost breakdown aggregated from real data
  - Auto-polls every 15s for live updates when orchestrator connected
  - Budget bar with remaining % (existing, now backed by real data)

### Enhanced Realtime Sync
- `useRealtimeSync.ts` — expanded to subscribe to:
  - `agents` table UPDATE (status, position, task, progress)
  - `companies` table UPDATE (budget, status, goal)
  - `delegations` table UPDATE + DELETE (progress changes + cleanup)
  - All changes push to canvas/UI instantly via Supabase Realtime

### Agent Memory System
- `server/memoryManager.ts` — full memory lifecycle:
  - `loadMemory()` / `saveMemory()` — JSONB in Supabase `agents.memory`
  - `recordTaskCompletion()` — adds to shortTerm (last 10) + completedTasks (last 20)
  - Auto-promotes recurring themes from shortTerm → longTerm (word frequency ≥ 3)
  - `extractSkills()` — pattern-matches task output for React, TypeScript, Database, etc.
  - `syncMemoryToObsidian()` — writes `brain/agents/{name}/memory.md` with frontmatter
- Integrated into `worker.ts` — called after every task completion
- Skills auto-detected and saved to both `agents.memory.skills` and `agents.skills[]`

### AgentDetail Page (fully built)
- `AgentDetail.tsx` — now shows real data from Supabase:
  - **Skills**: tag badges, auto-populated from completed tasks
  - **Memory**: short-term, long-term, completed tasks timeline
  - **Session History**: all Claude sessions with token counts + cost
  - **Total Cost**: per-agent cumulative spend
  - Status badge + current task + progress

### Test Results
- 39/39 passing
- Build: 536kB JS, 11kB CSS

---

## 2026-04-08 — Phase 2: Worker Agents + Task Queue + Worktree Management

### Worker Agent System
- `server/agents/worker.ts` — Role-specific Claude agents with:
  - **6 role prompts**: PM (specs), DevOps (infra), Frontend (React), Backend (API), QA (tests), Designer (UI)
  - **Per-role tool permissions**: PM gets Read/Write; Frontend gets Read/Edit/Write/Bash; QA gets Read/Bash
  - **Memory injection**: agent's `shortTerm`, `skills`, `rules` from JSONB injected into system prompt
  - **Budget-aware**: caps per agent based on company remaining budget
  - **Heartbeat updates**: pings `last_heartbeat` on each assistant message during execution
  - **Auto-memory extraction**: saves last 10 task summaries to `agents.memory.shortTerm`

### Task Queue Processor
- `server/taskProcessor.ts` — Sequential task execution:
  - Picks oldest `pending` task from `task_queue`
  - Marks `processing` → executes via `executeWorkerTask` → marks `completed`/`failed`
  - On task completion: updates `delegations.progress` to 100%
  - When ALL delegations complete: sets company to `scaling`, clears goal, CEO to idle
  - On failure: marks agent `idle`, logs error to activity_log
  - Single-task-at-a-time lock prevents concurrent execution

### Worktree Manager
- `server/worktreeManager.ts` — Git isolation for agents:
  - `createWorktree(cwd, branchName)` — creates git worktree at `.agent-worktrees/`
  - `removeWorktree()` — cleanup after task completion
  - `taskBranchName(role, task)` — generates `agent/frontend-build-auth-ui` style branches
  - Graceful fallback to main cwd if git operations fail

### Orchestrator Endpoints
- `POST /api/process-queue` — triggers next pending task execution
- `GET /api/queue-status/:companyId` — returns pending/processing/completed/failed counts
- `GET /api/worktrees` — lists active git worktrees

### Frontend Updates
- `CompanyDetail.tsx` — polls queue every 8s when orchestrator connected + goal active:
  - Fetches queue status → triggers `processQueue()` if pending tasks exist
  - Reloads company data from Supabase to show updated progress
  - Shows QUEUE indicator in status bar (▶ processing, ◇ pending)
- `orchestratorApi.ts` — added `processQueue()`, `fetchQueueStatus()`

### The Full Flow (Real Mode)
1. User assigns goal → CEO agent reasons via Claude → creates delegation plan
2. CEO creates `task_queue` entries for each subtask
3. Frontend polls `/api/queue-status` → triggers `/api/process-queue`
4. Worker agent executes task via Agent SDK (reads code, writes files, runs tests)
5. On completion: delegation → 100%, agent → break, activity logged, memory saved
6. When all delegations done: company → scaling, goal cleared

### Test Results
- 39/39 passing
- Build: 529kB JS, 11kB CSS

---

## 2026-04-08 — Phase 5a: Full Navigation System + Master Dashboard

### React Router Integration
- Installed `react-router-dom` v7
- Created `src/router.tsx` with all 13 routes
- Replaced single-page state navigation with URL-based routing

### New Components (12 pages)

| Route | Component | Status |
|-------|-----------|--------|
| `/` | `MasterDashboard` | Full — company grid with mini pixel canvases, stats bar, new company button |
| `/company/:id` | `CompanyView` → `CompanyDetail` | Full — pixel office + goal panel + feeds (refactored from old root) |
| `/company/:id/agents` | `AgentsPage` | Full — agent card grid with status, role, tasks + hire button |
| `/company/:id/agents/:id` | `AgentDetail` | Shell — status + placeholders for system prompt, skills, MCP, memory, history |
| `/company/:id/goals` | `GoalsPage` | Full — active goal display + delegation tree with progress bars |
| `/company/:id/documents` | `DocumentsPage` | Shell — brain/ vault tree sidebar + document viewer placeholder |
| `/company/:id/costs` | `CostsPage` | Full — budget overview bar, remaining %, per-agent cost breakdown |
| `/company/:id/org-chart` | `OrgChartPage` | Full — CEO → reports visual hierarchy with status badges |
| `/settings` | `SettingsPage` | Full — tabbed: General, Skills, MCP, Rules |
| `/settings/skills` | Skills tab | Full — global skill list with enable/disable toggles |
| `/settings/mcp` | MCP tab | Full — server list with connection status indicators |
| `/settings/rules` | Rules tab | Full — CLAUDE.md directives with enable/disable toggles |

### AppLayout + NavBar
- `AppLayout.tsx` — root layout with NavBar + Outlet, handles loading state + realtime sync
- `NavBar.tsx` — top nav with: CEO.SIM logo, Dashboard tab, company-context tabs (Office/Agents/Goals/Docs/Costs/Org), Settings gear, CLAUDE + ONLINE status indicators

### Refactored
- `App.tsx` — now just `<RouterProvider router={router} />`
- `CompanyDetail.tsx` — removed back button + old header (NavBar handles navigation), simulation tick only runs in mock mode (not when orchestrator connected)
- `vercel.json` — SPA catch-all rewrite for React Router history mode

### Build
- 39/39 tests passing
- 528kB JS (React Router added ~115kB), 11kB CSS
- Deployed to Vercel

---

## 2026-04-08 — Phase 0+1: Real Claude Agent Orchestration via Agent SDK

### Architecture
- **Local Orchestrator Server** (`server/`) — Express on port 3001, uses `@anthropic-ai/claude-agent-sdk`
- **Supabase Backend** — 4 new tables: `agent_sessions`, `task_queue`, `token_usage`, `configs`
- **Three-level config cascade** — Global → Project → Agent (skills, MCP servers, rules)
- **Frontend auto-detects orchestrator** — shows "CLAUDE" badge when connected, falls back to mock sim

### New Files (Server)
- `server/index.ts` — Express API: `/api/health`, `/api/assign-goal`, `/api/tasks/:id`, `/api/costs/:id`
- `server/agents/ceo.ts` — CEO agent: builds dynamic system prompt from company/team context, calls `query()` from Agent SDK, parses delegation plan JSON, creates task_queue entries
- `server/supabaseAdmin.ts` — Server-side Supabase client (service role key)
- `server/.env` — Server secrets (gitignored)

### New Files (Frontend)
- `src/lib/orchestratorApi.ts` — Client for local orchestrator (`isOrchestratorOnline`, `assignGoalToOrchestrator`, `fetchTaskQueue`, `fetchCosts`)

### Modified Files
- `src/store/dashboardStore.ts` — Added `orchestratorConnected`, `processingGoal` state. `assignGoal` now routes to orchestrator (real Claude) when connected, falls back to mock simulation when offline. `loadFromBackend` checks orchestrator health.
- `src/components/CeoGoalPanel.tsx` — "CEO is thinking via Claude..." state, CLAUDE badge when connected
- `src/components/CompanyDashboard.tsx` — "◆ CLAUDE" indicator in header when orchestrator is online
- `.gitignore` — Added `server/.env`
- `package.json` — Added `server`, `dev:all` scripts; deps: `@anthropic-ai/claude-agent-sdk`, `express`, `cors`, `tsx`, `dotenv`

### Supabase Migration: `add_orchestration_tables`
- `agent_sessions` — Claude conversation state, token totals, cost tracking
- `task_queue` — Async work items (pending/processing/completed/failed)
- `token_usage` — Per-invocation real USD cost tracking
- `configs` — Three-level cascade config (scope: global/company/agent, type: skill/mcp_server/rule)
- Extended `agents` table: `session_id`, `system_prompt`, `skills[]`, `memory JSONB`, `total_cost_usd`

### How It Works
1. User assigns goal in CeoGoalPanel
2. If orchestrator is running: POST `/api/assign-goal` → CEO agent calls Claude → gets delegation plan → creates task_queue entries → updates Supabase → Realtime pushes to canvas
3. If orchestrator is offline: falls back to mock simulation (random progress)
4. CEO's real reasoning is logged to `activity_log` → visible in ActivityFeed

### Dependencies Added
- `@anthropic-ai/claude-agent-sdk` — Anthropic's official agent orchestration SDK
- `express`, `cors` — Local orchestrator server
- `tsx` — TypeScript execution for server
- `dotenv` — Server environment loading
- `@types/express`, `@types/cors` — Type definitions

### Test Results
- 39/39 passing
- Build: 412kB JS, 11kB CSS

---

## 2026-04-08 — Agent Heartbeats + Activity Feed + Vercel Deploy

### Vercel Deployment
- Deployed to production: `https://ceo-simulator-iota.vercel.app`
- Env vars configured: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Auto-redeploy with heartbeat + activity feed changes

### Supabase Migration: `add_agent_heartbeat`
- Added `last_heartbeat` (timestamptz) and `heartbeat_status` (alive/stale/dead) to agents table
- `agent_heartbeat(agent_id)` function — updates heartbeat timestamp
- `check_stale_agents()` function — marks agents stale after 30s, dead after 120s
