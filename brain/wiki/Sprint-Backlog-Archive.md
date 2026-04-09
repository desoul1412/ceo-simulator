---
tags: [archive, sprint, backlog, roadmap, offboarding]
date: 2026-04-08
status: archived
---

# Sprint Backlog Archive — CEO Simulator

> **Archived:** 2026-04-08 as part of PM offboarding  
> **Reference:** [[Offboarding-Handover-Report]]

This document consolidates all sprint work, roadmap phases, and backlogs from the project lifetime.

---

## Roadmap Overview

The project was delivered in three phases (Waves), each targeting a set of Paperclip feature gaps.

```
Wave 1 — Core Orchestration        ✅ COMPLETE (2026-04-08)
Wave 2 — Enterprise Features       ✅ COMPLETE (2026-04-08)
Wave 3 — Polish                    🟡 PARTIAL  (2026-04-08)
Canvas Engine                      🔴 OUTSTANDING
Auth                               🔴 OUTSTANDING
```

---

## Wave 1 Sprint — Core Orchestration

**Goal:** Replace flat task_queue with production-grade execution pipeline.  
**Delivered:** 2026-04-08  
**Status:** ✅ COMPLETE

### Backlog Items (all completed)

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| W1.1 | As CEO, I want the system to process tasks automatically every 30s without me polling | Server daemon runs on boot; `/api/daemon/status` returns `active` | ✅ Done |
| W1.2 | As CEO, I need each agent to stay within a monthly budget cap | Agents auto-throttle when `budget_spent >= budget_limit`; can be reset via PATCH | ✅ Done |
| W1.3 | As CEO, I want work organized as threaded tickets not a flat queue | `tickets` table with parent_ticket_id, goal_ancestry, atomic claim function | ✅ Done |
| W1.4 | As CEO, I want to approve agent tasks before they execute | Tasks default to `awaiting_approval`; ApprovalPanel UI with ✓/× buttons | ✅ Done |
| W1.B | As CEO, I want to pause/throttle/terminate individual agents | `lifecycle_status` field; PATCH endpoint; ticket processor skips non-active | ✅ Done |

### Files Delivered
- `server/heartbeatDaemon.ts`
- `server/ticketProcessor.ts`
- `src/components/ApprovalPanel.tsx`
- Supabase migration: `wave1_tickets_budgets_approvals`

---

## Wave 2 Sprint — Enterprise Features

**Goal:** Make the agent runtime pluggable; add session resume and skill injection.  
**Delivered:** 2026-04-08  
**Status:** ✅ COMPLETE

### Backlog Items (all completed)

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| W2.1 | As CEO, I can hire HTTP services and Bash scripts as agents | `AgentRunner` interface; `claude_sdk | http_endpoint | bash_script | custom` runtime types | ✅ Done |
| W2.2 | As CEO, agents resume their conversation context on next heartbeat | `active_session_id` stored; `resume: sessionId` passed to Claude SDK | ✅ Done |
| W2.3 | As CEO, I can inject new skills into running agents without restart | `POST /api/agents/:id/inject-skill` updates skills + memory immediately | ✅ Done |
| W2.4 | As CEO, I can monitor agents from my phone | CSS media queries at 768px; sidebar stacks; touch-friendly tap targets | ✅ Done |

### Files Delivered
- `server/agents/agentRunner.ts`
- `server/agents/claudeRunner.ts`
- `server/agents/httpRunner.ts`
- `server/agents/bashRunner.ts`
- Supabase migration: `wave2_agent_runtime_types`

---

## Wave 3 Sprint — Polish

**Goal:** Harden infrastructure; atomic DB operations; full context chain; mobile QA.  
**Delivered:** 2026-04-08 (partial)  
**Status:** 🟡 PARTIAL

### Backlog Items

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| W3.1 | Atomic task checkout (no race conditions) | `claim_next_ticket()` PG function with `FOR UPDATE SKIP LOCKED` | ✅ Done |
| W3.2 | Goal ancestry context chain | `goal_ancestry text[]` on tickets; worker prompt includes full chain | ✅ Done |
| W3.3 | Full tool-call audit trail | `PostToolUse` hook → `audit_log` for every tool invocation | 🔴 Not done |
| W3.4 | Mobile QA (device testing) | Tested on iOS Safari + Android Chrome; no layout breaks | 🟡 Partial |

---

## Phase 5b/5c Sprint — Config System

**Goal:** Three-level config hierarchy (global → company → agent) for skills, MCP servers, rules.  
**Delivered:** 2026-04-08  
**Status:** ✅ COMPLETE

### Backlog Items (all completed)

| ID | Story | Acceptance Criteria | Status |
|----|-------|---------------------|--------|
| C1 | Global skill/MCP/rule defaults via Settings page | `/settings` shows ConfigManager for all 3 types at `scope=global` | ✅ Done |
| C2 | Per-company config overrides | `/company/:id/settings` shows company-level overrides | ✅ Done |
| C3 | Per-agent config overrides | AgentDetail shows agent-level configs; cascade displayed | ✅ Done |
| C4 | Config CRUD API | GET/POST/PATCH/DELETE `/api/configs`; GET `/api/configs/effective/:agentId` | ✅ Done |

---

## Phase 4 Sprint — Dynamic Agent Hiring

**Goal:** Full hire/fire flow with auto and manual configuration modes.  
**Delivered:** 2026-04-08  
**Status:** ✅ COMPLETE

### Backlog Items (all completed)

| ID | Story | Status |
|----|-------|--------|
| H1 | Quick Hire: one-click agent creation with role defaults | ✅ Done |
| H2 | Custom Hire: full name/prompt/skills/model config | ✅ Done |
| H3 | Fire agent endpoint with activity log | ✅ Done |
| H4 | Auto desk assignment (9 positions) | ✅ Done |

---

## Icebox / Future Backlog

Items that were scoped but never started. CEO to decide priority.

| ID | Story | Notes |
|----|-------|-------|
| ICE-1 | Canvas 2D engine: BFS pathfinding + sprite animation + game loop | See [[Office-Simulator-Architecture]] §2 — all design complete, zero code |
| ICE-2 | Supabase Auth — user accounts + per-user company isolation | No RLS policies, no login flow |
| ICE-3 | `/approvals` dedicated route/page | `ApprovalPanel.tsx` exists; needs own page |
| ICE-4 | `/routines` — heartbeat schedule management UI | Daemon works; no UI |
| ICE-5 | `/inbox` — task inbox with delegation | Architecture doc §3 references it |
| ICE-6 | ISO tile assets (7 remaining: wall, meeting, kitchen, CEO/PM/DevOps/Frontend sprites) | `brain/raw/asset-TODO.md` |
| ICE-7 | Isometric projection (was deprioritized in v3 architecture decision) | Stretch goal; significant effort |
| ICE-8 | Global monthly token budget cap + enforcement | Risk item — no ceiling on total API spend |
| ICE-9 | Custom domain for Vercel deployment | Cosmetic but needed for professional use |
| ICE-10 | Tool-call audit trail (`PostToolUse` hook wiring) | ~0.5 day; completes immutable audit trail |

---

## Definition of Done (Reference)

For any story to be marked ✅ Done it must:
1. Code merged to `main` (not a worktree branch)
2. All existing tests pass (39/39 as of this archive)
3. Spec document in `brain/wiki/` updated with YAML frontmatter
4. Changelog entry in `brain/changelog.md` appended
5. No hallucinated API calls — Context7 used for framework syntax, Tavily for external facts

---

## Meeting Notes Archive

> No formal meeting notes were generated during this project. All decisions were made by the CEO (human operator) and communicated via Claude session context. Key architectural decisions are recorded in:
>
> - [[Office-Simulator-Architecture]] §8 — Key Technical Decisions (Canvas 2D over CSS, top-down vs isometric, Zustand, React Router rationale)
> - [[Paperclip-Gap-Analysis]] — all feature prioritization decisions
> - [[Factory-Operations-Manual]] §3 — SOPs that governed agent behavior

---

*Archive complete. See [[Offboarding-Handover-Report]] for full handover context.*
