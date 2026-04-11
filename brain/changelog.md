---
tags: [changelog, meta]
date: 2026-04-10
status: active
---

# Changelog

## 2026-04-10 — Agent Framework Optimization: Smart Models, Prompt Caching, Parallel Execution

### Phase 1+2: Smart Model/Effort Selection + Prompt Caching
- **NEW** `server/agents/taskClassifier.ts` — `selectModel()`, `selectEffort()`, `allocateBudget()` functions
- CEO planner uses `opus` + `effort: 'high'` for strategic planning (was: sonnet/medium)
- QA/PM/Designer simple tasks (SP ≤ 2) use `haiku` + `effort: 'low'` (~50% cost reduction)
- Complex tasks (SP 8+ or architect/refactor keywords) use `sonnet` + `effort: 'high'`
- **Prompt caching**: System prompts now static per role (memory context moved to user prompt), enabling Anthropic's automatic prefix caching (90% cheaper reads)
- Token usage now records actual model used (was hardcoded `claude-sonnet-4-6`)

### Phase 3: Parallel Ticket Execution
- **NEW** `processMultipleTickets()` in `ticketProcessor.ts` — fires up to 3 concurrent `processNextTicket` calls
- Heartbeat daemon now processes N tickets per company per heartbeat (was: 1)
- Safe: atomic DB claims prevent double-dispatch, agents use separate branches

### Phase 4: Universal Memory Injection
- CEO planner phases now receive CEO agent's accumulated memory context
- `buildRelevantMemoryContext()` already used in claudeRunner + worker; now also in ceoPlannerV2

### Phase 5: Role-Based Tool Filtering
- Added `CEO` to ROLE_TOOLS with read-only tools (`Read`, `Glob`, `Grep`) — reduces prompt overhead

### Phase 6: Session Reuse
- Expanded session resume: agents reuse sessions for sequential tickets if session < 150K tokens
- Previously only explicit `continuation_of` tickets could resume sessions

### Expected Impact
- ~30-40% token cost reduction on simple tasks (haiku model)
- ~3x throughput improvement (parallel ticket processing)
- Better CEO planning quality (opus model + memory context)
- Automatic prompt caching across same-role executions

---

## 2026-04-10 — Full Codebase QA + UI/UX Audit & Fix Pass

### Critical Bug Fixes
- **worker.ts**: Removed no-op `supabase.rpc('', {})` placeholder; added null check on company fetch
- **circuitBreaker.ts**: Fixed broken retry logic — consolidated two-step retry_count increment into single atomic update
- **ceoPlannerV2.ts**: Added null check + early return when planning session not found; added 5-minute timeout per phase iterator to prevent indefinite hangs
- **ScrumBoard.tsx**: Wrapped `approveTicket`, `rejectTicket`, `removeTicketDependency` in try-catch to prevent state desync on API failure
- **PlanningPopup.tsx**: Added try-finally to `handleApprove` (prevents stuck approving state); added catch to `handleReplan`

### Medium Bug Fixes
- **ticketProcessor.ts**: Fixed race condition in worktree removal — now checks `in_progress` status too; added agent fetch error logging
- **budgetUtils.ts**: Extracted shared `usdToUnits()` helper — replaced 3 independent `* 100000` calculations in agentRunner, ceo, worker
- **agentMessenger.ts**: Replaced N+1 sequential `markRead()` loop with single batch `.in('id', ids)` update
- **index.ts**: Added graceful shutdown handler (SIGINT/SIGTERM) to stop heartbeat daemon and close server
- **planningStore.ts**: Added 120-attempt (5-min) max to polling interval, auto-stops with error on timeout
- **CompanyDetail.tsx**: Budget caps now read from `VITE_DAILY_BUDGET_CAP` / `VITE_WEEKLY_BUDGET_CAP` env vars

### Low Bug Fixes
- Replaced silent `.catch(() => {})` with `console.warn` in AgentCard, NavBar
- **memoryManager.ts**: Replaced `writeFileSync`/`mkdirSync` with async `fs/promises` equivalents

### UI/UX Improvements
- **Design tokens**: Added spacing scale (`--space-xs` to `--space-2xl`), font scale (`--font-2xs` to `--font-3xl`), glow scale, animation timing vars, role/status color vars, focus ring var
- **Accessibility**: Added global `:focus-visible` ring styles, `button:disabled` cursor, `aria-label` on icon buttons (close, approve, remove dependency), `role="dialog"` on modals, `role="alert"` on error banners, `.sr-only` utility class
- **Animations**: Added `fadeIn` + `slideUp` keyframes for modal overlay/content, `.modal-overlay`/`.modal-content` classes
- **Responsive**: Changed all fixed-width modals (HireAgentDialog 540px, AgentCard 560px, ScrumBoard 520px) to `width: 95vw; max-width: Npx`
- **Empty states**: Improved ScrumBoard column empty state (now visible with column name); added dismiss button to PlanningPopup error banner
- **Mobile**: Added `--space-lg`/`--space-xl` overrides for 768px breakpoint

---

## 2026-04-10 — CEO Planning Flow Overhaul: Multi-Tab Planner, Dependency DAG, Agent Communication

### Multi-Tab Planning Popup (Part 1)
- New `PlanningPopup.tsx` — full-screen modal with 7 tabs: Overview, Findings, Research, Tech Stack, Architecture, Hiring Plan, Implementation Plan
- `PlanningTabContent.tsx` — view/edit toggle per tab with generating animation
- `PlanningProgress.tsx` — phase diamond indicators
- `planningStore.ts` — Zustand store for planning state with polling (2.5s interval)
- `planningApi.ts` — API client for all new planning/dependency/messaging endpoints
- `ceoPlannerV2.ts` — multi-phase CEO planner, each phase is a separate Claude Agent SDK call
- CEO Directive input in Office view now triggers the planning flow instead of old CeoPlanFlow
- Project size selector (S/M/L) gates which phases/tabs are generated
- Tabs are editable, support re-planning from any tab (cascades to downstream tabs)
- Approval-to-execution bridge: parses hiring plan → auto-hires agents, implementation plan → creates sprints/tickets with dependencies

### Task Dependency DAG (Part 2)
- `ticket_dependencies` table with `blocker_ticket_id` → `blocked_ticket_id` edges
- `dependencyManager.ts` — add/remove deps, cycle detection, propagation on completion/failure
- `claim_next_ticket_v2` RPC — only claims tickets where ALL dependencies are satisfied
- `propagate_dependency_satisfaction` / `propagate_dependency_failure` RPC functions
- Auto-inferred dependencies from role ordering: PM → Frontend+Backend → QA → DevOps
- ScrumBoard enhanced: blocked/partial ticket indicators, dependency section in ticket detail modal

### Inter-Agent Communication (Part 3)
- `agent_messages` table for structured messaging between agents
- `agentMessenger.ts` — send messages, broadcast completion signals, inject upstream context into agent prompts
- When a ticket completes, downstream agents receive artifact context (files, branch, output summary)
- Messages prepended to agent task prompt before execution

### Anti-Loop & Anti-Silent-Failure (Part 4)
- `circuitBreaker.ts` — retry with exponential backoff, dead letter queue, execution timeout detection
- `dead_letter_queue` table for permanently failed tickets
- Fixed 4 silent `catch {}` blocks in heartbeatDaemon.ts and ticketProcessor.ts
- Heartbeat daemon now sweeps for execution timeouts
- Tickets get `retry_count`, `max_retries`, `started_at`, `max_execution_ms` fields

### Documentation & Brain Integration (Part 5)
- Planning sessions persisted to `brain/{company}/plans/{session-id}/` as markdown files
- Dependency graphs exported as Mermaid diagrams to `brain/{company}/sprints/{sprint}/dependency-graph.md`
- Dead letter failures logged to `brain/changelog.md`
- New DB tables: `planning_sessions`, `planning_tabs`, `ticket_dependencies`, `agent_messages`, `dead_letter_queue`
- New server modules: `circuitBreaker.ts`, `dependencyManager.ts`, `agentMessenger.ts`, `ceoPlannerV2.ts`
- ~12 new API endpoints for planning sessions, dependencies, messages, dead letter queue

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

### Canvas Heartbeat Visuals
- `renderHeartbeat()` in `canvasRenderer.ts` — pulsing glow ring under each agent
  - **alive** (green): smooth 0.5Hz pulse, bright glow
  - **stale** (orange): slow dim pulse
  - **dead** (red): static dim ring
- Status dot rendered below each character's feet
- Heartbeat state derived from employee status + time since last activity change

### Activity Feed Component
- `src/components/ActivityFeed.tsx` — real-time scrollable log panel
- Loads initial history from `activity_log` table via API
- Subscribes to Supabase Realtime INSERT events for live updates
- Generates local activity entries from employee status transitions
- Typed icons + neon colors per activity type (goal-assigned, task-started, task-completed, etc.)
- Shows timestamp for each entry

### Heartbeat Ping System
- `CompanyDetail` sends heartbeat pings every 10s for working/meeting agents
- `checkStaleAgents()` called alongside to mark inactive agents
- `api.ts` exports `sendHeartbeat()` and `checkStaleAgents()` functions

### Files Created
- `src/components/ActivityFeed.tsx`

### Files Modified
- `src/engine/canvasRenderer.ts` — heartbeat field on CharacterRenderState, renderHeartbeat(), integrated into renderFrame()
- `src/components/PixelOfficeCanvas.tsx` — heartbeat + lastHeartbeatTime in AgentState, status-based heartbeat logic
- `src/components/CompanyDetail.tsx` — heartbeat ping interval, ActivityFeed panel added
- `src/lib/api.ts` — sendHeartbeat(), checkStaleAgents()

### Test Results
- 39/39 passing
- Build: 410kB JS, 11kB CSS

---

## 2026-04-08 — Paperclip Backend: Supabase + Vercel Integration

### Supabase Schema (migration: `create_core_schema`)
- 5 tables: `companies`, `agents`, `goals`, `delegations`, `activity_log`
- UUID primary keys, foreign key cascades, CHECK constraints for enums
- Row Level Security enabled (permissive anon policies for single-player mode)
- `updated_at` trigger on companies
- Realtime enabled on companies, agents, delegations, activity_log

### New Files
- `src/lib/supabase.ts` — Supabase client with offline fallback (graceful degradation when env vars missing)
- `src/lib/database.types.ts` — TypeScript types matching Supabase schema
- `src/lib/api.ts` — Full CRUD API layer: `fetchCompanies`, `createCompany`, `assignGoal`, `tickCompany`, `fetchActivityLog`
- `src/hooks/useRealtimeSync.ts` — Supabase Realtime subscriptions → Zustand store → pixel canvas auto-update
- `vercel.json` — Vite SPA deployment config with rewrites
- `.env.example` — Template for `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

### Modified Files
- `src/store/dashboardStore.ts` — **Major rewrite**: store now starts empty, loads from Supabase via `loadFromBackend()`, falls back to local mock data when offline. Optimistic updates for `assignGoal` and `tickCompany` keep canvas responsive while syncing to DB in background.
- `src/App.tsx` — Added `useEffect` to call `loadFromBackend()` on mount + `useRealtimeSync()` hook
- `src/components/CompanyDashboard.tsx` — Added loading screen ("CONNECTING TO MAINFRAME..."), online/offline status indicator in header
- `src/store/dashboardStore.test.ts` — Mock `supabase` module to force offline mode in tests; `beforeEach` now calls `loadFromBackend()` for mock data
- `.env` — Renamed `SUPABASE_URL` → `VITE_SUPABASE_URL`, `SUPABASE_ANON_KEY` → `VITE_SUPABASE_ANON_KEY` (Vite requires `VITE_` prefix)

### Dependencies Added
- `@supabase/supabase-js` — Supabase client for DB + Realtime

### Architecture Decisions
1. **Optimistic local updates + background sync** — Canvas stays responsive (60fps) while DB operations happen asynchronously. Local Zustand state is source of truth for rendering; Supabase is source of truth for persistence.
2. **Offline-first fallback** — If Supabase creds are missing, app runs with local mock data (same as v3 behavior). No hard dependency on backend.
3. **Untyped Supabase client** — Used untyped `createClient()` instead of `createClient<Database>()` to avoid strict generic inference issues with `.update()` calls. Our own `database.types.ts` provides type safety at the API layer.
4. **Auto-seed on first run** — When Supabase has no companies, `loadFromBackend()` seeds 2 demo companies (Acme Corp, Globex Inc) with 4 agents each.
5. **Realtime for multi-tab** — Supabase Realtime subscriptions on agents + companies tables push changes to all open tabs.

### Test Results
- 39/39 passing (`npm test`)
- Build: ✓ (`npm run build` — 405kB JS, 9.4kB CSS)

---

## 2026-04-08 — Office Agents Simulator — Phase 1 Complete

### Step 1 — Asset & Design System
- Created `brain/wiki/UI-Design-System.md` — full Pixel Art / HUD design system: color tokens, typography, grid spec, CRT scanline pattern, component rules, status color map
- Generated SVG placeholder assets (game-assets MCP unavailable):
  - `public/assets/tiles/server-floor.svg` — dark sci-fi floor tile with circuit traces
  - `public/assets/tiles/desk.svg` — top-down cyberpunk desk with monitor + keyboard
  - `public/assets/sprites/agent-1.svg` — top-down cyborg worker
- Created `brain/raw/asset-TODO.md` — PNG generation queue with 6 prompts

### Step 2 — Architecture Blueprint
- Created `brain/wiki/Office-Simulator-Architecture.md` with:
  - ASCII map of 15×15 office grid (W/F/D/M/K zones, coordinates)
  - React Agent state shape + `useAgentPolling` contract
  - CSS Grid tile layout + absolute-position agent animation strategy
  - Component tree diagram
  - TDD test target table

### Step 3 — Engineering Execution
**Files created:**
- `src/hooks/useAgentPolling.ts` — simulation tick engine; 3–5 s jitter via recursive `setTimeout`; picks random status + zone-appropriate grid position per tick; exports `INITIAL_AGENTS`
- `src/components/AgentSprite.tsx` — absolutely positioned, CSS-transition animated sprite with status dot badge; hue-rotation tint per agent color
- `src/components/OfficeFloorPlan.tsx` — 15×15 CSS Grid tile renderer; `TileCell` sub-component with `data-cell-type` attrs; agent sprites layered at `z-index: 10`
- `src/components/HudPanel.tsx` — KPI sidebar with productivity bar, agent status rows, live tick counter
- `src/App.tsx` — rewritten; mounts `useAgentPolling`, renders `OfficeFloorPlan` + `HudPanel`
- `src/index.css` — rewritten; HUD CSS vars, `sim-root/header/main` layout, CRT scanline `.crt-overlay::after`
- `src/test-setup.ts` — vitest + jest-dom setup
- `src/hooks/useAgentPolling.test.ts` — 6 unit tests
- `src/components/OfficeFloorPlan.test.tsx` — 9 component tests

**Test results:** 15/15 passing (`npm test`)

**Dependencies added:**
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`

**Known gaps / next sprint:**
- SVG → PNG asset swap (see [[asset-TODO]])
- Sprite sheet walk-cycle animation (needs 4-frame PNG)
- Git worktree workflow deferred (no initial commit at project start)
- Pathfinding / collision avoidance
- `<Architecture>` stub spec needs content

---

## 2026-04-08 — Architecture v3: Paperclip + Pixel Agents Hybrid

### Decision
Pivoted from CSS 3D isometric to **Canvas 2D pixel art** (Pixel Agents style) embedded in a **Paperclip-style management dashboard**. The v2 CSS isometric approach was technically functional but visually wrong for the target aesthetic.

### References researched
- [Paperclip](https://github.com/paperclipai/paperclip) — React 19 + Vite + Tailwind + Express + PostgreSQL. 45+ pages, 24+ API routes. Companies, agents, goals (cascading delegation), budgets, org charts, approvals, activity feeds.
- [Pixel Agents](https://github.com/pablodelucca/pixel-agents) — VS Code extension. Canvas 2D game loop, BFS pathfinding, 32×48px sprite sheets, speech bubbles, activity-driven animations, persistent office layouts.

### Key changes in `Office-Simulator-Architecture.md` (v2 → v3)
1. **Rendering**: CSS 3D transforms → Canvas 2D with `requestAnimationFrame` game loop
2. **View**: Isometric 2.5D → top-down pixel art (matches Pixel Agents style)
3. **Pathfinding**: random teleport → BFS on walkable tile grid
4. **Sprites**: CSS div characters → sprite sheet animation (32×48px, 32 frames)
5. **Management UI**: minimal sidebar → full Paperclip parity (agents, goals, costs, org chart, settings pages via React Router)
6. **Data model**: expanded with Agent CRUD, Goal hierarchy (parent→child), OfficeLayout (tiles + furniture + seats), ActivityLog
7. **Speech bubbles**: agents show what they're working on above their heads
8. **Office layout**: configurable tile grid with placeable furniture (desks, plants, whiteboards, server racks)

### v2 components to replace
- `IsometricOffice` → `PixelOfficeCanvas` (Canvas 2D)
- `IsometricCharacter` → Canvas sprite renderer
- `CompanyDashboard` → `NavBar` + `Sidebar` + React Router
- `CompanyDetail` → `Dashboard` route (canvas + panels)

---

## 2026-04-08 — Isometric 2.5D Dashboard Build (Step 3)

Built via `feature/isometric-dashboard` worktree → merged to master.

### Engine (CSS 3D Isometric)
- `transform: rotateX(60deg) rotateZ(-45deg)` on grid wrapper → 2.5D illusion
- Reverse transforms on `IsometricCharacter` sprites → face camera
- 8×6 tile grid with 7 zone types (CEO/PM/DevOps/Frontend desks, meeting, kitchen, floor)
- `isoProjection.ts`: tile definitions, `sortByDepth()` painter's algorithm, role desks

### State Management (Zustand)
- `dashboardStore.ts`: root store with `Company[]`, `selectedCompanyId`
- Actions: `addCompany`, `selectCompany`, `assignGoal`, `tickCompany`
- CEO delegation flow: goal → 3 `Delegation` records → employee status changes → budget burn
- 2 mock companies: Acme Corp ($120k), Globex Inc ($80k)
- Per-company tick: recursive setTimeout 3–5s jitter in `CompanyDetail`

### Components
- `CompanyDashboard` → sidebar company list + main content area
- `CompanyCard` → status badge, budget, active count, current goal preview
- `CompanyDetail` → iso office + title bar (budget/status) + side panels
- `IsometricOffice` → CSS Grid + 3D transform wrapper + zone tiles + agent sprites
- `IsometricCharacter` → CSS pixel-art body with role color, reverse-transform billboard
- `CeoGoalPanel` → text input → `assignGoal()`, disabled while goal active
- `DelegationFeed` → per-delegation progress bars, role colors, task text

### Tests
- 32/32 passing: v1 legacy (15) + v2 iso projection (7) + store (10)
- Coverage: grid generation, depth sort, company CRUD, goal delegation, tick progress, budget

---

## 2026-04-08 — game-asset-mcp Repair & Registration

- Identified root cause: package name `@mubarakhalketbi/game-asset-mcp` doesn't exist on npm; repo is GitHub-only
- Cloned to `~/game-asset-mcp` and installed deps (`--ignore-scripts` to bypass `canvas` native build failure on Windows)
- Patched `src/clients.js`: 3D Gradio model space connection failure is now non-fatal — server degrades gracefully to 2D-only mode (`generate_2d_asset` available, `generate_3d_asset` disabled)
- Updated `.claude/settings.json`: command changed from `npx @mubarakhalketbi/game-asset-mcp` → `node C:/Users/CPU12062/game-asset-mcp/src/index.js`
- Server confirmed starting cleanly: `[INFO] MCP Game Asset Generator running with stdio transport`
- **Restart Claude Code** to load the live MCP tool

---

## 2026-04-08 — Isometric Asset Generation (v2)

`game-assets` MCP package (`@mubarakhalketbi/game-asset-mcp`) confirmed non-existent on npm (404).
Assets generated via HuggingFace FLUX.1-schnell router API per CLAUDE.md fallback directive.

| Asset | Path | Size | Method |
|-------|------|------|--------|
| ISO floor tile (wood, seamless) | `public/assets/tiles/iso-floor.png` | 64×32 | HF FLUX → PIL NEAREST |
| ISO desk (dual monitors, neon) | `public/assets/tiles/iso-desk.png` | 64×64 | HF FLUX → PIL NEAREST |
| ISO worker sprite (cyborg) | `public/assets/sprites/iso-worker-1.png` | 64×64 | HF FLUX → PIL NEAREST |

Sizes match isometric tile spec from [[Office-Simulator-Architecture]] §6:
- Floor tile: 64×32 (2:1 diamond ratio)
- Desk / character: 64×64

---

## 2026-04-08 — Architecture Pivot: Isometric Dashboard (v2)

### Decision
Pivoted from flat top-down office simulator to a full **isometric Habbo Hotel-style management dashboard** containing multiple companies.

### Updated: `brain/wiki/Office-Simulator-Architecture.md` (v1 → v2)

Key architectural changes documented:

**Data Model**
- Root state: `DashboardState` → `companies[]` + `selectedCompanyId`
- `Company`: has `name`, `budget`, `budgetSpent`, `status`, a `CeoAgent`, and `Employee[]`
- `CeoAgent`: holds user-assigned `goal`, generates `Delegation[]` (one per sub-agent role)
- `Employee`: `PM | DevOps | Frontend` — receives task from CEO delegation, renders in iso office
- `IsoCoord { tileX, tileY }` — logical grid coords, projected to screen via `isoToScreen()`

**Isometric Projection**
- 2:1 dimetric: `left = originX + (tileX - tileY) * 32`, `top = originY + (tileX + tileY) * 16`
- Grid: 20×12 tiles; canvas ~900×500 px
- Zones: CEO Corner, PM Zone, DevOps Zone, Frontend Zone, Meeting Island, Kitchen/Break
- Painter's algorithm: sort agents by `tileX + tileY` before render

**UI Layout**
- Two-pane: left = company card list, right = selected company detail (iso office + panels)
- Navigation: pure state (`selectedCompanyId: string | null`) — no URL routing in v1

**State Management**
- Zustand store: `dashboardStore` (companies, selectedCompanyId, addCompany, assignGoal, tickCompany)
- Per-company hook: `useCompanySimulation(companyId)` — replaces `useAgentPolling`
- CEO delegation flow: goal → 3 Delegations (PM/DevOps/Frontend) → employees animate at desks → progress 0→100 → budget decrements

**Component Tree**
- `GlobalDashboard` → `CompanyCard × N` + `AddCompanyButton`
- `CompanyDetail` → `IsometricOffice` + `CeoGoalPanel` + `DelegationFeed` + `CompanyHud`
- `IsometricOffice` → `IsoTile × 240` + `IsoAgent × 4` (CEO + 3 employees)

**v1 → v2 migration table** documented; v1 code on master @ `1bfff5e` retained as reference.

### Updated: `brain/00-Index.md`
- v2 feature checklist added
- v1 items marked complete and archived

---

## 2026-04-08 — PNG Asset Generation + Sprite Sheet Animation

### Assets
- Generated 6 pixel art PNGs via HuggingFace FLUX.1-schnell router API (256×256 → resized with PIL NEAREST):
  - `public/assets/tiles/server-floor.png` (32×32)
  - `public/assets/tiles/desk.png` (32×32)
  - `public/assets/tiles/kitchen.png` (32×32)
  - `public/assets/tiles/meeting.png` (32×32)
  - `public/assets/tiles/indicator.png` (16×16)
  - `public/assets/sprites/agent-1.png` (128×32 — 4-frame walk-cycle sheet)
- Registered `game-assets` MCP in `.claude/settings.json` (restart Claude Code to use)

### Components (via `feature/png-assets` worktree → merged)
- `OfficeFloorPlan.tsx`: replaced SVG tile icons with `TILE_ASSET` PNG map; floor/desk/kitchen/meeting all use real PNG textures
- `AgentSprite.tsx`: replaced `<img>` with CSS `background-image` sprite sheet; `@keyframes walk-cycle steps(4)` injected into `<head>` once; animation active when `status !== 'idle'`

### Process
- Initial commit created to enable git worktrees
- Worktree: `feature/png-assets` → committed → merged to `master` → worktree removed
- 15/15 tests still passing post-merge
- `brain/raw/asset-TODO.md` queue fully cleared (all items ✅)

---

## 2026-04-08 — Project Initialization
- Scaffolded React 19 + TypeScript + Vite project
- Installed Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Created folder structure: `brain/`, `public/assets/sprites/`, `public/assets/tiles/`
- Created `CLAUDE.md` autonomy engine
- Initialized Obsidian vault at `./brain/`
- Configured Tavily MCP and Context7 MCP

- [2026-04-11T05:31:21.981Z] DEAD LETTER: Ticket a5451c3b-169d-48fc-b971-a6347fc6fb27 failed permanently. Error: Execution timeout: exceeded 600000ms
- [2026-04-11T05:38:29.076Z] DEAD LETTER: Ticket 7daebc6b-77a0-4129-a2c7-16d63e53f9e7 failed permanently. Error: Claude Code returned an error result: Reached maximum number of turns (10)