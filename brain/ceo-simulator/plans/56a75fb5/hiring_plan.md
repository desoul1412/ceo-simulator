---
tags: [plan, hiring_plan]
date: 2026-04-11
status: active
---

# Hiring Plan

> Directive: "Review this project, this is a multi agents framework that can help me work with any project, it still in testing but I want it to be an open-source ready product that uses can use with their own server, databases and LLM models. Please start planning with this approach"
> Size: medium | Cost: $4.8351

Now I have a comprehensive understanding of the entire codebase. Let me finalize my analysis.

---

# 🏗️ Hiring Plan — Open-Source Multi-Agent Framework

## Project Assessment

After reviewing the full codebase — **14 server modules**, **37 React components**, **50+ API endpoints**, **61 skill files**, **20 agent presets**, and the Obsidian brain system — this is a **substantial, functional prototype** that needs hardening, abstraction, and documentation to become an open-source product.

### What Exists Today (Strengths)
- Working CEO → Agent delegation pipeline (`server/agents/ceo.ts`)
- Multi-runtime agent execution: Claude SDK, HTTP, Bash (`server/agents/agentRunner.ts`)
- Git worktree isolation per agent (`server/worktreeManager.ts`)
- Ticket-based task execution with atomic claims (`server/ticketProcessor.ts`)
- Heartbeat daemon with 30s auto-processing (`server/heartbeatDaemon.ts`)
- Merge request workflow with diff review
- 3-level config cascade (Global → Company → Agent)
- Agent memory system with Obsidian sync (`server/memoryManager.ts`)
- 50+ Express endpoints, Zustand frontend store, Supabase Realtime

### What's Missing for OSS (Gaps)
1. **Hard-coded Supabase dependency** — `server/supabaseAdmin.ts` + `src/lib/supabase.ts` are the only DB adapter; no abstraction layer for MySQL/Postgres/SQLite
2. **Hard-coded Claude Agent SDK** — `claudeRunner.ts` imports `@anthropic-ai/claude-agent-sdk`; no LLM provider abstraction (OpenAI, Ollama, etc.)
3. **No authentication** — `00-Index.md:51` explicitly marks Auth as OUTSTANDING
4. **No Docker/self-hosting** — no Dockerfile, no docker-compose, no setup wizard
5. **No database migrations** — schema exists only in Supabase dashboard, not in code
6. **Minimal test coverage** — only `pathfinding.test.ts`, `dashboardStore.test.ts`, `OfficeFloorPlan.test.tsx`, `useAgentPolling.test.ts`
7. **No API documentation** — README lists endpoints but no OpenAPI/Swagger spec
8. **No plugin/extension system** — custom runtimes fall through to `httpRunner`
9. **Frontend tightly coupled to Supabase** — `src/lib/api.ts` calls Supabase client directly

---

## Hiring Plan

| # | Role | Model | Monthly Budget | Skills | Justification |
|---|------|-------|---------------|--------|---------------|
| 1 | **PM** | sonnet | $15 | requirements, specs, user-stories, roadmap, OSS-governance | **First hire.** Must decompose the OSS transformation into phased sprints. Writes specs for provider abstraction layers, auth system, Docker setup, and migration scripts. References: the entire Architecture doc needs sprint-level tickets with acceptance criteria. No spec → no code (per `CLAUDE.md` §1 PRE-FLIGHT). |
| 2 | **Backend** | sonnet | $15 | TypeScript, Express, Supabase, PostgreSQL, abstraction-layers, DI | **Critical path.** Builds the **Database Provider Interface** to replace hard-coded `supabaseAdmin.ts` with a pluggable adapter (Supabase / raw Postgres / SQLite / MySQL). Builds the **LLM Provider Interface** to wrap `claudeRunner.ts` behind a strategy pattern supporting OpenAI, Ollama, Mistral. Adds auth middleware to all 50+ endpoints in `server/index.ts`. |
| 3 | **Data Architect** | opus | $25 | data-modeling, migrations, PostgreSQL, schema-design, RLS | **Critical path.** Extracts the implicit Supabase schema (currently only in `src/lib/database.types.ts` and scattered RPCs like `claim_next_ticket`, `check_stale_agents`) into versioned SQL migration files. Designs the `users` table for multi-tenancy. Ensures RLS policies are portable. Produces `migrations/001_initial.sql` through `migrations/00N_*.sql`. |
| 4 | **DevOps** | sonnet | $10 | Docker, docker-compose, CI/CD, GitHub-Actions, self-hosting | **Critical path.** Creates `Dockerfile` + `docker-compose.yml` for one-command self-hosting. Sets up GitHub Actions CI pipeline (lint + test + build). Writes the setup wizard that generates `.env` from user input. Currently there's only `vercel.json` — no containerization exists. |
| 5 | **Frontend** | sonnet | $15 | React-19, TypeScript, Tailwind-v4, Zustand, API-client-refactor | Refactors `src/lib/api.ts` and `src/lib/orchestratorApi.ts` to hit a unified backend API instead of directly calling Supabase. Adds auth UI (login/register/API-key management). Builds a **Setup Wizard** component for first-run configuration. Fixes the 37 components to work with the new abstracted backend. |
| 6 | **AI Engineer** | opus | $25 | LLM-integration, prompt-engineering, Agent-SDK, provider-abstraction, RAG | Builds the **LLM Provider Abstraction** — the most OSS-critical piece. Currently `claudeRunner.ts` line 1: `import { query } from '@anthropic-ai/claude-agent-sdk'` is a hard dependency. Must create `server/providers/llm/` with adapters for Claude, OpenAI, Ollama, and a generic HTTP adapter. Also refactors `ceo.ts` prompt engineering to be model-agnostic. |
| 7 | **QA** | haiku | $5 | vitest, testing-library, integration-tests, E2E, coverage | Currently only 4 test files exist. Must write: unit tests for all 6 server modules (`agentRunner`, `ticketProcessor`, `heartbeatDaemon`, `memoryManager`, `repoManager`, `worktreeManager`), integration tests for the API layer, and frontend component tests. Target: 80%+ coverage before OSS release. |
| 8 | **Full-Stack** | sonnet | $12 | end-to-end-features, React, Express, TypeScript, plugin-system | Builds the **Plugin/Extension System** — users should be able to register custom agent runtimes, custom skill definitions, and MCP servers via config instead of code changes. Currently `agentRunner.ts:59` has a `case 'custom'` that just falls through to HTTP. Also implements the config cascade testing. |
| 9 | **Content Writer** | haiku | $5 | technical-writing, OSS-docs, README, contributing-guide, API-docs | Writes: comprehensive README for OSS (current one is good but internal-facing), `CONTRIBUTING.md`, `docs/self-hosting-guide.md`, `docs/provider-setup.md` (one per LLM/DB provider), OpenAPI spec from the 50+ endpoints, and inline JSDoc across all server modules. |
| 10 | **Automation** | haiku | $5 | CI/CD-workflows, release-automation, npm-publish, changelog | Sets up GitHub Release workflow, semantic versioning, automated changelog generation from commits, npm package publishing pipeline, and the `npx create-agent-factory` scaffolding tool for new users. |

---

### **Total Monthly Budget: $132**

| Category | Agents | Budget |
|----------|--------|--------|
| Engineering | PM, Backend, Frontend, Full-Stack | $57 |
| Data & AI | Data Architect, AI Engineer | $50 |
| Infrastructure | DevOps, Automation | $15 |
| Quality & Docs | QA, Content Writer | $10 |
| **Total** | **10 agents** | **$132/mo** |

---

## Team Structure

```
                    ┌──────────────┐
                    │  CEO (You)   │
                    │  Human Owner │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴────┐ ┌────┴──────┐
        │    PM      │ │ DevOps │ │  Content  │
        │ (sonnet)   │ │(sonnet)│ │  Writer   │
        │ Sprint Lead│ │Infra   │ │  (haiku)  │
        └─────┬──────┘ └───┬────┘ └───────────┘
              │            │
    ┌─────────┼──────────┐ │
    │         │          │ │
┌───┴──┐ ┌───┴───┐ ┌────┴─┴──────┐
│Back- │ │Front- │ │ Full-Stack  │
│end   │ │end    │ │  (sonnet)   │
│(son.)│ │(son.) │ │ Plugin Sys. │
└──┬───┘ └───────┘ └─────────────┘
   │
┌──┴───────────┐
│              │
┌┴──────┐  ┌──┴──────────┐
│Data   │  │ AI Engineer │
│Arch.  │  │   (opus)    │
│(opus) │  │ LLM Abstrac.│
└───────┘  └─────────────┘

Parallel tracks:
┌──────────┐  ┌────────────┐
│   QA     │  │ Automation │
│ (haiku)  │  │  (haiku)   │
│ Tests    │  │  CI/CD     │
└──────────┘  └────────────┘
```

### Reporting Lines
| Agent | Reports To | Rationale |
|-------|-----------|-----------|
| PM | CEO (You) | Sprint planning requires human approval per `CLAUDE.md` §1 |
| Backend | PM | Task assignments flow through sprint tickets |
| Frontend | PM | Same — ticket-driven work |
| Full-Stack | PM | Cross-cutting features need PM coordination |
| Data Architect | PM + Backend | Schema work feeds directly into Backend's provider abstraction |
| AI Engineer | PM + Backend | LLM providers are consumed by `agentRunner.ts` |
| DevOps | CEO (You) | Infrastructure decisions need direct CEO oversight |
| QA | PM | Tests validate acceptance criteria from PM's specs |
| Content Writer | PM | Docs track spec completions |
| Automation | DevOps | CI/CD pipelines depend on infra decisions |

---

## Communication Protocol

| Channel | Purpose | Frequency | Mechanism |
|---------|---------|-----------|-----------|
| **Ticket System** | All task assignments | Per-task | `tickets` table → agent picks up via `claim_next_ticket` RPC |
| **Merge Requests** | Code review & integration | Per-completion | Agent commits → pushes → creates MR → CEO reviews |
| **Ticket Comments** | Intra-task coordination | As needed | `ticket_comments` table — agents post progress, blockers |
| **Notifications** | Escalations & approvals | Real-time | `notifications` table → Inbox panel |
| **Sprint Reviews** | Phase completion check-ins | Per-sprint | PM writes summary → CEO approves next sprint |
| **Brain/Wiki** | Persistent knowledge | Post-task | `brain/wiki/` specs updated per `CLAUDE.md` §1 POST-FLIGHT |
| **Activity Log** | Audit trail | Continuous | `activity_log` table — every state change logged |

### Conflict Avoidance Protocol
Per existing code in `ticketProcessor.ts:126-141`, agents already check for open MRs on other branches before working. This is enforced for all new hires.

---

## Priority Hiring — Phased Rollout

### 🔴 Phase 1: Foundation (Week 1–2) — Hire First
| Order | Role | Why First |
|-------|------|-----------|
| **1** | **PM** | Nothing moves without specs. Must produce: `Provider-Abstraction-Spec.md`, `Auth-System-Spec.md`, `Migration-Spec.md`, `Docker-Spec.md` before any code starts. Enforced by `CLAUDE.md` §1: "If a feature lacks a spec document in `/wiki/`, you MUST write it first." |
| **2** | **Data Architect** | Schema extraction is the bottleneck. Currently the schema exists only in Supabase's dashboard — no `migrations/` folder. Every other agent depends on knowing the exact table structure. Must produce: `migrations/001_initial.sql` capturing all tables (`companies`, `agents`, `goals`, `delegations`, `activity_log`, `tickets`, `ticket_comments`, `audit_log`, `agent_sessions`, `token_usage`, `sprints`, `merge_requests`, `project_plans`, `plan_comments`, `notifications`, `configs`, `env_vars`, `task_queue`). |
| **3** | **Backend** | Immediately after schema is extracted, starts building the **Database Adapter Interface** (`server/providers/db/`) and **Auth middleware**. These are blocking for all downstream work. |

### 🟡 Phase 2: Core Abstraction (Week 2–3)
| Order | Role | Why Second |
|-------|------|------------|
| **4** | **AI Engineer** | Builds `server/providers/llm/` — the LLM Provider Interface. Can start in parallel with Backend since the contract is well-defined by `AgentRunResult` in `agentRunner.ts:9-15`. |
| **5** | **DevOps** | Starts Docker + CI once Backend has the DB adapter working. Needs stable server structure before containerizing. |
| **6** | **Frontend** | Can begin auth UI and API client refactor once Backend's new endpoints stabilize. |

### 🟢 Phase 3: Quality & Polish (Week 3–4)
| Order | Role | Why Third |
|-------|------|-----------|
| **7** | **QA** | Needs stable code to test against. Writes test suites for the new provider layers + existing untested modules. |
| **8** | **Full-Stack** | Plugin system is an enhancement layer — needs the provider interfaces to be stable first. |
| **9** | **Content Writer** | Docs should reflect the final architecture, not a moving target. Starts once APIs are frozen. |
| **10** | **Automation** | Release pipeline is the last piece — needs passing CI, versioned migrations, and a stable build. |

---

### Budget Summary vs. Work Scope

| Work Package | Primary Agent(s) | Est. Tickets | Critical Files Affected |
|---|---|---|---|
| Database Provider Abstraction | Backend + Data Architect | 8–12 | `server/supabaseAdmin.ts` → `server/providers/db/`, new `migrations/` |
| LLM Provider Abstraction | AI Engineer + Backend | 6–10 | `server/agents/claudeRunner.ts` → `server/providers/llm/`, `agentRunner.ts` |
| Auth System | Backend + Frontend | 8–12 | New `server/auth/`, `src/lib/supabase.ts`, all 50+ endpoints |
| Self-Hosting (Docker) | DevOps | 4–6 | New `Dockerfile`, `docker-compose.yml`, `scripts/setup.sh` |
| Test Coverage (4→80%) | QA | 15–20 | New test files across `server/` and `src/` |
| Plugin System | Full-Stack | 6–8 | `server/agents/agentRunner.ts`, new `server/plugins/` |
| OSS Documentation | Content Writer | 8–10 | `README.md`, new `docs/`, `CONTRIBUTING.md`, OpenAPI spec |
| CI/CD + Release | Automation + DevOps | 4–6 | `.github/workflows/`, `package.json` scripts |

**Estimated total: 59–84 tickets across 4 sprints → ~1 month to OSS-ready MVP.**
