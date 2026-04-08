---
tags: [architecture, gap-analysis, paperclip, roadmap]
date: 2026-04-08
status: active
---

# Paperclip Gap Analysis — CEO Simulator vs Production Paperclip

## Summary

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 1 | Agent-Agnostic Integration | **DONE** (Wave 2 — Claude/HTTP/Bash/custom) | — |
| 2 | Heartbeat-Driven Execution (cron) | **DONE** (Wave 1) | — |
| 3 | Persistent State / Session Resume | **DONE** (Wave 2 — active_session_id) | — |
| 4 | Per-Agent Token Budgets | **DONE** (Wave 1) | — |
| 5 | Atomic Task Checkout | **DONE** (Wave 1 — FOR UPDATE SKIP LOCKED) | — |
| 6 | Goal Ancestry / Context Chain | **DONE** (Wave 1 — goal_ancestry[]) | — |
| 7 | Ticket System (threaded work) | **DONE** (Wave 1) | — |
| 8 | Immutable Audit Trail | **DONE** (Wave 1 — audit_log table) | — |
| 9 | Approval Gates | **DONE** (Wave 1) | — |
| 10 | Runtime Skill Injection | **DONE** (Wave 2 — inject-skill API) | — |
| 11 | Multi-Company Isolation | **DONE** | — |
| 12 | Mobile-Ready UI | **DONE** (Wave 2 — responsive breakpoints) | — |
| 13 | Scheduled Heartbeats / Cron | **DONE** (Wave 1) | �� |
| 14 | Agent Lifecycle (pause/throttle) | **DONE** (Wave 1) | �� |

**Score: 14/14 Paperclip features implemented.**

---

## Detailed Gaps

### 1. Agent-Agnostic Integration (MISSING)
**Paperclip**: Hire any agent — Claude, Codex, Cursor, HTTP endpoints, Bash scripts. "If it can receive a heartbeat, it can be hired."
**Us**: Hard-coded to Claude Agent SDK only. `worker.ts` calls `query()` directly.
**Fix**: Add `agent_type` field (claude_sdk | http_endpoint | bash_script | custom). Create an `AgentRunner` interface that each type implements. The hire dialog already has a role selector — add a runtime selector.

### 2. Heartbeat-Driven Execution (MISSING)
**Paperclip**: Agents wake on schedule (heartbeats) and event triggers (@-mentions, task assignments). Execute → sleep.
**Us**: Queue only processed when frontend polls `/api/process-queue`. No server-side scheduler.
**Fix**: Add `node-cron` or `setInterval` in server that auto-processes queue every 30s. Add event triggers (Supabase Realtime on task_queue INSERT → auto-process).

### 3. Persistent State / Resume (PARTIAL)
**Paperclip**: Agents resume exact context across heartbeats. No from-scratch restarts.
**Us**: Agent memory (shortTerm, longTerm) injected into prompts. But each task starts a fresh Agent SDK session — no conversation resume.
**Fix**: Store `session_id` from Agent SDK. On next heartbeat for same agent, use `resume: sessionId` option to continue the conversation.

### 4. Per-Agent Token Budgets (MISSING)
**Paperclip**: Strict monthly per-agent budget. Auto-throttle when threshold hit.
**Us**: Only company-level budget. `agents.monthly_cost` exists but isn't enforced.
**Fix**: Add `agents.budget_limit` and `agents.budget_spent` columns. Check before each `query()` call. If exceeded → set agent status to 'throttled', skip task.

### 5. Atomic Task Checkout (PARTIAL)
**Paperclip**: Task checkout + budget enforcement handled atomically. No duplicate work.
**Us**: In-memory `isProcessing` flag. No DB-level lock. Multi-instance race possible.
**Fix**: Use Supabase `UPDATE ... WHERE status = 'pending' RETURNING *` pattern (atomic claim). Or add `FOR UPDATE SKIP LOCKED` via RPC function.

### 6. Goal Ancestry / Context Chain (PARTIAL)
**Paperclip**: Tasks carry full goal ancestry. Worker always knows the overarching "why."
**Us**: Worker gets `payload.goal` (parent goal title) but not the full chain.
**Fix**: Add `goal_ancestry` field to task_queue payload: `["Build #1 AI note app → $1M MRR", "Define auth requirements", "Write login spec"]`. Worker prompt includes full chain.

### 7. Ticket System (MISSING)
**Paperclip**: Work organized as tickets with threaded conversations, sub-agent decisions explained, tool calls recorded.
**Us**: Flat `task_queue` + `activity_log`. No threading, no comments, no sub-tickets.
**Fix**: Create `tickets` table with: `id, parent_ticket_id, company_id, agent_id, title, description, status, comments JSONB[]`. Replace task_queue with ticket-based workflow. Each delegation = a ticket. Each sub-task = a child ticket.

### 8. Immutable Audit Trail (PARTIAL)
**Paperclip**: Every tool call, decision, communication recorded.
**Us**: High-level events only (goal assigned, task started/completed). No tool-call logging.
**Fix**: Use Agent SDK `hooks.PostToolUse` to capture each tool invocation. Write to `audit_log` table: `{ agent_id, tool_name, tool_input, tool_output, timestamp }`.

### 9. Approval Gates (MISSING)
**Paperclip**: Human "board" approves strategies before execution. Approval gates at delegation boundaries.
**Us**: Tasks auto-execute after CEO delegates. No human review.
**Fix**: Add `requires_approval` flag to delegations/tickets. New status: `awaiting_approval`. UI shows pending approvals. `POST /api/approve/:taskId` endpoint. Tasks with approval gate wait for human click before processing.

### 10. Runtime Skill Injection (MISSING)
**Paperclip**: Agents dynamically learn new project contexts without hard reset.
**Us**: Skills static at task start. Changed only post-task via auto-extraction.
**Fix**: Add `POST /api/agents/:id/inject-skill` endpoint. Updates `agents.skills` + `agents.memory` immediately. Next heartbeat/task picks up new skills.

### 11. Multi-Company Isolation (DONE) ✓

### 12. Mobile-Ready UI (MISSING)
**Paperclip**: Full mobile-ready design. Monitor/approve from phone.
**Us**: Fixed-width CSS, hardcoded pixel values, no media queries.
**Fix**: Add Tailwind responsive classes. Collapsible sidebar. Stack layout on mobile. Touch-friendly tap targets. Meta viewport tag.

### 13. Scheduled Heartbeats / Cron (MISSING)
**Paperclip**: Scheduled heartbeats + event triggers.
**Us**: No background scheduler.
**Fix**: Add heartbeat daemon in server: `setInterval(() => processNextTask(), 30_000)`. Add Supabase trigger: on INSERT to task_queue, fire webhook to orchestrator.

### 14. Agent Lifecycle (PARTIAL)
**Paperclip**: Pause, terminate, throttle agents independently.
**Us**: Only hire/fire. No pause/resume/throttle.
**Fix**: Add `PATCH /api/agents/:id/status` with states: `active | paused | throttled | terminated`. Task processor skips paused/throttled agents. UI controls on AgentDetail page.

---

## Implementation Priority

### Wave 1 — Core Orchestration (Critical for production)
- **#2 + #13**: Heartbeat daemon (server-side cron)
- **#9**: Approval gates
- **#7**: Ticket system (replace flat task_queue)
- **#4**: Per-agent budgets

### Wave 2 — Enterprise Features
- **#1**: Agent-agnostic runtime (HTTP/Bash/custom)
- **#3**: Session resume across heartbeats
- **#8**: Full audit trail (tool-call logging)
- **#14**: Agent lifecycle controls (pause/throttle)

### Wave 3 — Polish
- **#5**: Atomic task checkout (DB-level locks)
- **#6**: Goal ancestry context chain
- **#10**: Runtime skill injection API
- **#12**: Mobile-responsive UI
