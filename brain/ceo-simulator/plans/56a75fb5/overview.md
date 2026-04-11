---
tags: [plan, overview]
date: 2026-04-11
status: active
---

# Overview

> Directive: "Review this project, this is a multi agents framework that can help me work with any project, it still in testing but I want it to be an open-source ready product that uses can use with their own server, databases and LLM models. Please start planning with this approach"
> Size: medium | Cost: $4.8351

Now I have a thorough understanding of the entire codebase. Let me compile the comprehensive project overview.

---

# 📋 PROJECT OVERVIEW — CEO Simulator

## 1. Project Name & Description

**Name:** CEO Simulator — Zero-Human Software Factory  
**Repo:** `https://github.com/desoul1412/ceo-simulator.git`  
**Live Instance:** [ceo-simulator-iota.vercel.app](https://ceo-simulator-iota.vercel.app)  
**License:** MIT  
**Version:** `0.0.0` (pre-release, `package.json` line 4: `"private": true`)

### What It Is

A **multi-agent orchestration framework** that lets a human operator (the "CEO") manage autonomous AI agents working across real Git repositories. You connect any project repo, the system's CEO agent reviews the codebase, proposes a plan, and — upon human approval — delegates work to specialized agents (Frontend, Backend, DevOps, QA, PM, etc.). Each agent executes in an isolated Git worktree, commits to its own branch, and creates merge requests for human review.

Think of it as **"Jira meets Claude Code"** — a Scrum board where the workers are LLM agents, isolated by branches, governed by approval gates, and tracked with real USD cost accounting.

### Core Value Proposition

| For | Value |
|-----|-------|
| Solo developers | Multiply your output — agents handle parallel tasks across branches |
| Small teams | Automate boilerplate: tests, docs, refactors, CI config |
| OSS maintainers | Manage multiple repos from a single dashboard with cost caps |
| AI researchers | Pluggable runtime architecture (Claude SDK / HTTP / Bash) — swap models freely |

---

## 2. Current State (What Exists, What Works)

### ✅ Fully Implemented & Functional

| Subsystem | Key Files | Status |
|-----------|-----------|--------|
| **Express Orchestrator (50+ endpoints)** | `server/index.ts` (550+ lines) | Working |
| **3 Agent Runtimes** | `server/agents/claudeRunner.ts`, `httpRunner.ts`, `bashRunner.ts` | Working |
| **Universal Agent Dispatcher** | `server/agents/agentRunner.ts` — routes `claude_sdk`/`http_endpoint`/`bash_script`/`custom` | Working |
| **CEO Agent (Project Review + Goal Delegation)** | `server/agents/ceo.ts` — `executeCeoGoal()` + `executeCeoProjectReview()` | Working |
| **Ticket Processor with Git Isolation** | `server/ticketProcessor.ts` — claim → worktree → execute → commit → push → create MR | Working |
| **Heartbeat Daemon** | `server/heartbeatDaemon.ts` — 30s polling loop across all companies | Working |
| **Git Worktree Manager** | `server/worktreeManager.ts` — branch isolation per agent | Working |
| **Per-Company Repo Manager** | `server/repoManager.ts` — clone/sync/PAT auth | Working |
| **Agent Memory System** | `server/memoryManager.ts` — short-term, long-term, skill extraction, Obsidian sync | Working |
| **React 19 Frontend (14 routes)** | `src/router.tsx` — MasterDashboard, ScrumBoard, ProjectOverview, etc. | Working |
| **Zustand State + Supabase Sync** | `src/store/dashboardStore.ts` — optimistic local + background persist | Working |
| **Orchestrator API Client** | `src/lib/orchestratorApi.ts` (470+ lines, 40+ functions) | Working |
| **Supabase Client (offline fallback)** | `src/lib/supabase.ts` — graceful `null` if env missing | Working |
| **Realtime Sync** | `src/hooks/useRealtimeSync.ts` | Working |
| **Skills Library** | `brain/library/skills/` — 61 skill markdown files across 15+ role directories | Content complete |
| **Agent Presets** | `brain/library/agent-presets/` — 20 agent preset configs | Content complete |
| **Rule Definitions** | `brain/library/rules/` — 6 rules (TDD circuit breaker, pre-flight, post-flight, etc.) | Content complete |
| **Pixel Office Canvas** | `src/components/PixelOfficeCanvas.tsx` + `src/engine/` (pathfinding, canvas renderer) | Working (visual layer) |
| **Obsidian Brain Vault** | `brain/` — full vault with index, wiki specs, changelog, agent memory | Structured |

### ⚠️ Outstanding / Incomplete

| Item | Evidence | Risk |
|------|----------|------|
| **No Authentication** | `brain/00-Index.md` line 51: `Auth (user accounts + per-user companies) — OUTSTANDING` | **Critical for OSS** — anyone can access all data |
| **Canvas Game Loop** | `brain/00-Index.md` line 55: `useCompanySimulation.ts — OUTSTANDING` | Visual polish only, not blocking |
| **Hardcoded Supabase Project** | `CLAUDE.md` line 5: `project: paperclip (qdhengvarelfdtmycnti)` + `supabaseAdmin.ts` uses env vars, but no schema migration scripts in repo | Users can't self-provision |
| **No Database Migrations** | No `supabase/migrations/` directory, no SQL schema files in repo | **Critical for OSS** — users can't create tables |
| **Single LLM Provider (Claude)** | `claudeRunner.ts` imports `@anthropic-ai/claude-agent-sdk`; no OpenAI/Ollama/etc. runner | Limits audience |
| **No Docker / Docker Compose** | No containerization — relies on local Node + Supabase cloud | Barrier to self-hosting |
| **Missing Test Coverage** | `package.json` line 17: `npm run test` = 36 vitest tests; but `ticketProcessor.ts`, `agentRunner.ts`, `ceo.ts` have 0 tests | Regression risk |
| **Pixel Art Asset TODOs** | `brain/00-Index.md` lines 65-67: sprites/tiles referenced but some marked as needed | Visual incomplete |

### Code Metrics

| Metric | Value |
|--------|-------|
| Frontend Components | 25+ TSX files in `src/components/` |
| Server Modules | 14 TypeScript files in `server/` |
| API Endpoints | 50+ (REST, Express) |
| Agent Runtimes | 3 (Claude SDK, HTTP, Bash) + custom fallback |
| Agent Role Presets | 20 |
| Skill Definitions | 61 |
| Frontend Routes | 14 |
| Database Tables | 12+ (companies, agents, goals, delegations, tickets, ticket_comments, sprints, merge_requests, project_plans, notifications, token_usage, agent_sessions, audit_log, activity_log, task_queue, env_vars, agent_configs) |
| Test Count | 36 (vitest) |

---

## 3. Scope Classification

### **🔴 LARGE**

**Rationale:**

1. **Dual-process architecture** — separate frontend (Vite SPA) and backend (Express orchestrator) that must be packaged, documented, and deployable independently
2. **Database dependency with no migration story** — Supabase schema with 12+ tables, RLS policies, and stored procedures (e.g., `claim_next_ticket` RPC) that need to be exportable
3. **Multi-provider LLM abstraction** — current architecture hardcodes Claude SDK; adding OpenAI/Ollama/local models requires a provider abstraction layer
4. **Self-hosting infrastructure** — Docker, env config, database provisioning, secrets management
5. **Auth system from scratch** — zero auth exists; needs user accounts, API keys, RBAC
6. **61-file skills library** — content that needs documentation, versioning, and user extensibility
7. **Git integration complexity** — worktrees, branch strategies, merge flow, PAT auth — all need hardening for arbitrary user repos

**Estimated Effort:** 6–10 weeks for a small team (2-3 engineers), or 12–16 weeks solo.

---

## 4. Stakeholders & Users

| Stakeholder | Role | Interest |
|-------------|------|----------|
| **Project Owner (You)** | CEO / Product Owner | Transform internal tool into polished OSS product |
| **Self-Hosting Developers** | Primary users | Deploy on own infra with own DB and LLM keys |
| **Solo Developers / Indie Hackers** | Power users | Automate coding tasks across personal projects |
| **Team Leads** | Managers | Orchestrate multi-agent workflows for team repos |
| **OSS Contributors** | Community | Extend with new agent runtimes, skills, UI themes |
| **Enterprise Evaluators** | Future users | Assess for internal deployment (need auth, audit, SSO) |

### User Personas

1. **"Self-Hoster Sam"** — Wants to `docker compose up`, point at own Postgres + OpenAI key, and start managing agents. No Supabase cloud dependency.
2. **"Plugin Pete"** — Wants to write a custom agent runtime (e.g., Ollama local) by implementing a simple interface, drop skills into `brain/library/skills/`, and have the system pick them up.
3. **"Manager Maya"** — Non-technical. Uses the dashboard to set goals, review MRs, approve plans. Needs clear UI, notifications, and cost visibility.

---

## 5. Business Objectives

### Definition of Success

| Objective | Metric | Target |
|-----------|--------|--------|
| **Deployable by strangers** | Time from `git clone` to working system | < 15 minutes |
| **Database-agnostic** | Supported backends | ≥ 2 (Supabase + raw Postgres + SQLite for local dev) |
| **LLM-agnostic** | Supported providers | ≥ 3 (Claude, OpenAI, Ollama/local) |
| **Self-hosting story** | Docker Compose + single `.env` | 1-command deploy |
| **GitHub stars** | Community traction | 500+ in 3 months (aspirational) |
| **Contributor onboarding** | First PR from external contributor | < 30 days after launch |
| **Documentation completeness** | Setup guide, architecture, API docs | 100% of critical paths |

### Open Source Readiness Checklist

- [ ] **README rewrite** — Quick start that doesn't assume Supabase cloud
- [ ] **Database migrations** — SQL files or Drizzle/Prisma schema
- [ ] **Docker Compose** — frontend + server + Postgres in one stack
- [ ] **Provider abstraction** — `LLMProvider` interface with Claude/OpenAI/Ollama implementations
- [ ] **Auth system** — At minimum: API key auth for server, session auth for dashboard
- [ ] **Configuration documentation** — All 50+ env vars documented
- [ ] **CONTRIBUTING.md** — PR process, code style, testing requirements
- [ ] **LICENSE file** — MIT (referenced in README but no `LICENSE` file found in repo root)
- [ ] **CI/CD** — GitHub Actions for lint + test + build
- [ ] **Security audit** — `supabaseAdmin.ts` uses service role key (bypasses RLS); token handling in `repoManager.ts` needs review

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Current State | Target |
|-------------|---------------|--------|
| Heartbeat loop | 30s interval (`heartbeatDaemon.ts` line 12) | Configurable; < 10s for real-time feel |
| Concurrent agents | Sequential per company (line 33-39 of `ticketProcessor.ts` — one ticket per agent at a time) | Parallel execution with queue management |
| Frontend load time | SPA with Vite — likely fast | < 2s initial load, < 100ms route transitions |
| Dashboard real-time updates | Supabase Realtime subscriptions (`useRealtimeSync.ts`) | < 1s latency for status changes |

### Security

| Requirement | Current State | Priority |
|-------------|---------------|----------|
| **Authentication** | ❌ None | **P0 — Blocker** |
| **Authorization / RBAC** | ❌ None — all data accessible | **P0** |
| **API key management** | Git PATs stored in `git_token_encrypted` column (naming suggests encryption, but `repoManager.ts` line 39 uses it as plaintext in URL) | **P0** — actual encryption needed |
| **Service role key exposure** | `supabaseAdmin.ts` bypasses RLS; if server is exposed, all data is accessible | **P1** |
| **Env var injection** | Env vars stored per-company; need encryption at rest | **P1** |
| **Agent sandboxing** | Agents run `execSync` commands (`bashRunner.ts`); worktrees provide Git isolation but not process isolation | **P2** |
| **Rate limiting** | No rate limiting on 50+ API endpoints | **P1** |

### Scalability

| Requirement | Current State | Target |
|-------------|---------------|--------|
| Multi-user | Single-user (no auth) | Multi-user with isolated data |
| Multi-instance | Single Express process | Stateless server; queue-based for horizontal scale |
| Database | Supabase cloud only | Self-hosted Postgres (or SQLite for local dev) |
| Agent concurrency | 1 agent per company at a time | Configurable parallelism with backpressure |

### Reliability

| Requirement | Current State | Target |
|-------------|---------------|--------|
| Error handling | `ticketProcessor.ts` catches + marks ticket as `failed` | Structured error types, retry policy |
| Budget enforcement | ✅ Agent auto-throttle on budget exhaust (line 63-77 of `ticketProcessor.ts`) | Keep — this is good |
| TDD circuit breaker | Referenced in `brain/library/rules/tdd-circuit-breaker.md` | Enforce in agent runner |
| Daemon resilience | Single `setInterval` loop; `isRunning` flag prevents overlap | Needs watchdog / process manager |

---

## 7. System Context (External Integrations & APIs)

```
┌──────────────────────────────────────────────────────────┐
│                    CEO SIMULATOR                          │
│                                                          │
│  ┌─────────────┐    REST API    ┌─────────────────────┐  │
│  │  React SPA  │◄──────────────►│  Express Server     │  │
│  │  (Vite)     │    :3001       │  (Orchestrator)     │  │
│  │  :5173      │                │                     │  │
│  └──────┬──────┘                └──┬──────┬──────┬────┘  │
│         │                          │      │      │       │
│         │ Supabase                 │      │      │       │
│         │ Realtime                 │      │      │       │
│         │ (websocket)              │      │      │       │
└─────────┼──────────────────────────┼──────┼──────┼───────┘
          │                          │      │      │
          ▼                          ▼      ▼      ▼
   ┌──────────────┐  ┌───────────┐ ┌──┐  ┌──┐  ┌────────┐
   │  Supabase    │  │ Claude    │ │  │  │  │  │ Target  │
   │  (Postgres + │  │ Agent SDK │ │H │  │B │  │ Git     │
   │   Realtime + │  │           │ │T │  │a │  │ Repos   │
   │   RLS)       │  │ @anthropic│ │T │  │s │  │         │
   │              │  │ /ai/claude│ │P │  │h │  │ GitHub/ │
   │ 12+ tables   │  │ -agent-sdk│ │  │  │  │  │ GitLab  │
   └──────────────┘  └───────────┘ │A │  │R │  └────────┘
                                   │g │  │u │
                                   │e │  │n │
                                   │n │  │n │
                                   │t │  │e │
                                   │s │  │r │
                                   └──┘  └──┘
```

### External Dependencies

| Dependency | Current Binding | Required for OSS |
|------------|----------------|------------------|
| **Supabase** (PostgreSQL + Realtime + RLS) | Hard dependency — `@supabase/supabase-js` in frontend (`src/lib/supabase.ts`) and server (`server/supabaseAdmin.ts`) | Must abstract to support raw Postgres / SQLite |
| **Anthropic Claude Agent SDK** | `@anthropic-ai/claude-agent-sdk` v0.2.96 (`server/agents/claudeRunner.ts`) | Must add provider abstraction for OpenAI, Ollama, etc. |
| **Git (CLI)** | `execSync('git ...')` throughout `worktreeManager.ts`, `repoManager.ts`, `ticketProcessor.ts` | Hard requirement — Git must be installed on host |
| **GitHub/GitLab** | PAT-based auth for private repos (`repoManager.ts` line 39) | Keep — but document supported Git hosts |
| **Vercel** | Frontend deployment (`vercel.json`) | Optional — users can deploy anywhere |
| **Obsidian Vault** | `brain/` directory structure with `.obsidian/` config | Soft dependency — works as plain markdown too |
| **Node.js 20+** | Runtime for both frontend (Vite) and server (Express + tsx) | Hard requirement |

### Supabase Tables (Inferred from Code)

| Table | Referenced In | Purpose |
|-------|--------------|---------|
| `companies` | Throughout | Project definitions, budget, repo config |
| `agents` | Throughout | Agent instances, status, memory, budget |
| `goals` | `database.types.ts` | Goal hierarchy |
| `delegations` | `ceo.ts`, `ticketProcessor.ts` | CEO → agent task assignments |
| `tickets` | `ticketProcessor.ts` | Work items (Scrum) |
| `ticket_comments` | `ticketProcessor.ts` | Threaded discussion |
| `sprints` | `server/index.ts` | Sprint definitions |
| `merge_requests` | `ticketProcessor.ts` | Branch → main merge tracking |
| `project_plans` | `ceo.ts` | CEO-generated plans |
| `notifications` | Throughout | Inbox items |
| `token_usage` | `agentRunner.ts` | Per-agent cost tracking |
| `agent_sessions` | `agentRunner.ts`, `claudeRunner.ts` | Session persistence |
| `audit_log` | `ticketProcessor.ts`, `heartbeatDaemon.ts` | System audit trail |
| `activity_log` | Throughout | Real-time activity feed |
| `task_queue` | `ceo.ts` (legacy compat) | Legacy task queue |
| `env_vars` | `orchestratorApi.ts` | Per-project environment variables |
| `agent_configs` | `orchestratorApi.ts` | 3-level config cascade |
| **RPC: `claim_next_ticket`** | `ticketProcessor.ts` line 17 | Atomic ticket claiming (FOR UPDATE SKIP LOCKED) |
| **RPC: `check_stale_agents`** | `heartbeatDaemon.ts` line 47 | Mark unresponsive agents |

---

## 8. Risk Register (Initial)

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | No auth = data leak if server exposed | **Critical** | High (any network exposure) | Implement auth before public launch |
| R2 | No DB migration scripts = users can't set up | **Critical** | Certain | Export Supabase schema; create migration files |
| R3 | Claude-only = limits 80%+ of potential users | **High** | High | Provider abstraction layer |
| R4 | Git PAT stored as plaintext in DB | **High** | Medium | Encrypt at rest + in transit |
| R5 | `execSync` in bashRunner = code injection risk | **High** | Medium | Sandbox agent execution |
| R6 | No CI/CD = regressions on contributions | **Medium** | High | GitHub Actions pipeline |
| R7 | 0 server-side tests = refactor risk | **Medium** | High | Add integration tests for ticket processor + agent runner |

---

## 9. Recommended OSS Transformation Phases

> *High-level roadmap to be refined during Planning phase*

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| **Phase 0: Extractable** | Make it run anywhere | DB migrations, Docker Compose, `.env` documentation |
| **Phase 1: Provider Agnostic** | LLM + DB abstraction | `LLMProvider` interface, OpenAI runner, SQLite option for local dev |
| **Phase 2: Secure** | Auth + secrets | User auth, API keys, encrypted secrets, RLS enforcement |
| **Phase 3: Developer Experience** | Contributor-ready | CONTRIBUTING.md, CI/CD, test coverage, architecture docs |
| **Phase 4: Community** | Launch | README rewrite, demo video, GitHub release, social announcement |

---

**Assessment:** This is a **remarkably feature-complete** internal tool — the agent runner architecture (`agentRunner.ts` dispatching to `claudeRunner`, `httpRunner`, `bashRunner`), the ticket-based execution pipeline with Git worktree isolation, and the 3-level config cascade are production-quality patterns. The primary gap is **portability**: the system currently assumes a specific Supabase instance, a specific LLM provider, and zero authentication. Closing those gaps transforms this from a personal power tool into a legitimate open-source platform.
