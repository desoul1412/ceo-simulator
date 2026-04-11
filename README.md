# CEO Simulator — Zero-Human Software Factory

A **Paperclip-style AI agent orchestration platform** that manages multiple software projects through autonomous Claude Code agents. Each project connects to its own Git repo. Agents write code in isolated branches, submit merge requests for your review, and track progress on a Scrum board — all from a single pixel-art dashboard.

**Live Demo:** [ceo-simulator-iota.vercel.app](https://ceo-simulator-iota.vercel.app)

---

## Quick Start

### Option A: Local (2 minutes)

```bash
git clone https://github.com/desoul1412/ceo-simulator.git
cd ceo-simulator
npm install

# Configure
cp .env.example .env          # Add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
cp .env.example server/.env   # Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

# Run
npm run dev      # Frontend → http://localhost:5173
npm run server   # Orchestrator → http://localhost:3001
```

### Option B: Docker (self-hosted)

```bash
cd docker
cp .env.docker.example .env   # Edit with your keys
docker compose up -d           # Server + PostgreSQL
```

### Option C: Vercel + Supabase (production)

1. Fork this repo
2. Import to [Vercel](https://vercel.com) — auto-detects `vercel.json`
3. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Run `server/` on any Node 20+ host with `SUPABASE_SERVICE_ROLE_KEY`

### Prerequisites

| Requirement | Notes |
|------------|-------|
| Node.js 22+ | For `tsx` TypeScript runner |
| [Supabase](https://supabase.com) project | Free tier works. Run `supabase/migrations/*.sql` in order |
| [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) | Agents run via `@anthropic-ai/claude-agent-sdk` — uses your local Claude Code auth (no API key needed) |
| Git | For worktree-based agent isolation |

---

## What This Does

CEO Simulator is the **control plane for a Zero-Human Software Factory**. You set business goals. The system handles delegation, coding, testing, and deployment.

```
1. Create a project → connect a Git repo
2. CEO agent reviews codebase → generates Project Overview
3. CEO proposes: Summary, Master Plan, Hiring Plan
4. You review + approve the plan
5. Agents are hired per plan → Sprint 1 created
6. Each agent works in their own branch → commits → pushes → creates MR
7. You review MRs on the Scrum Board → merge to main
8. Repeat. Scrum Master posts daily summaries.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)        │
│  PixelOfficeCanvas ─ ScrumBoard ─ CeoChat ─ Audit   │
│  AuthGate ─ Clipmart ─ AgentDetail ─ MasterDashboard │
└───────────────────────┬─────────────────────────────┘
                        │ REST + SSE
┌───────────────────────┴─────────────────────────────┐
│                Express Orchestrator (server/)         │
│                                                       │
│  Routes (15 modules)     Middleware                    │
│  ├─ auth.ts              ├─ auth.ts (JWT + RLS)      │
│  ├─ companies.ts         ├─ errorHandler.ts          │
│  ├─ agents.ts            └─ validate.ts              │
│  ├─ tickets.ts                                        │
│  ├─ sprints.ts          Providers                     │
│  ├─ plans.ts            ├─ anthropicProvider.ts      │
│  ├─ planning.ts         ├─ openrouterProvider.ts     │
│  ├─ mergeRequests.ts    └─ registry.ts (failover)    │
│  ├─ configs.ts                                        │
│  ├─ notifications.ts    Pipeline                      │
│  ├─ audit.ts            ├─ plan → exec → verify      │
│  ├─ ceoChat.ts          └─ fix → done (circuit break)│
│  ├─ clipmart.ts                                       │
│  ├─ daemon.ts           Sandbox                       │
│  └─ misc.ts             ├─ none (worktree)           │
│                          ├─ docker (container)        │
│  DAL (12 repos)          └─ e2b (cloud VM stub)      │
│  ├─ companyRepo                                       │
│  ├─ agentRepo           Tools                         │
│  ├─ ticketRepo          ├─ Core (7) / Std (11) / All │
│  ├─ sprintRepo          ├─ Path traversal blocking   │
│  ├─ planRepo            └─ Secret detection           │
│  ├─ mergeRequestRepo                                  │
│  ├─ notificationRepo    Audit                         │
│  ├─ configRepo          ├─ HMAC-SHA256 proof chain   │
│  └─ auditRepo           └─ per-tool-call logging     │
│                                                       │
│  Replay (JSONL)         ReasoningBank                 │
│  └─ session recording   └─ trajectory retrieval       │
└───────────────────────┬─────────────────────────────┘
                        │
              ┌─────────┴──────────┐
              │   Supabase / PG    │
              │   15+ tables + RLS │
              └────────────────────┘
```

### Multi-Provider LLM Routing

```bash
# server/.env
LLM_PROVIDER=auto        # Claude Agent SDK → OpenRouter failover
# LLM_PROVIDER=anthropic  # Claude Agent SDK only (default, uses local CLI auth)
# LLM_PROVIDER=openrouter # OpenRouter only (requires OPENROUTER_API_KEY)
```

**Default:** Agents use `@anthropic-ai/claude-agent-sdk` which authenticates through your local [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) session. No API key env var needed.

**Fallback:** When `LLM_PROVIDER=auto`, if Claude SDK is unavailable, routes to OpenRouter (OpenAI-compatible API).

3-tier model routing: CEO → Opus, PM/Dev → Sonnet, QA/Scrum → Haiku.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Project** | One server, unlimited projects, each with its own Git repo |
| **Multi-Provider** | Anthropic (default) + OpenRouter failover. Env-driven. |
| **Staged Pipeline** | plan → exec → verify → fix → done (SP-based complexity routing) |
| **Sandbox Isolation** | None (worktree), Docker (container-per-company), E2B (cloud VM) |
| **Auth + RLS** | Supabase Auth, JWT middleware, row-level security per company |
| **Audit Trail** | HMAC-SHA256 proof chain on every tool call. Tamper-evident. |
| **CEO Chat** | SSE-streaming direct line to the CEO agent |
| **Clipmart** | Company template marketplace — export/import with secret scrubbing |
| **Session Replay** | JSONL recording of every agent session for debugging |
| **ReasoningBank** | Stores successful trajectories, injects into future similar tasks |
| **Per-Agent Branches** | Every agent works in isolated `agent/{role}-{task}` branches |
| **Scrum Board** | 5-column Kanban (Backlog → Todo → In Progress → Review → Done) |
| **Approval Gates** | Nothing executes without your approval |
| **20 Agent Roles** | Engineering, Data & AI, Business — each with dedicated skills |
| **3-Level Config** | Global → Project → Agent cascade for skills, rules, MCP servers |
| **Tool Provisioning** | Tiered loading (Core 7 / Standard 11 / Full + MCP) per role |
| **Pixel Office** | Canvas 2D animated RPG office with sprite state machines |

---

## Environment Variables

### Frontend (`.env`)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001   # optional, defaults to localhost:3001
```

### Server (`server/.env`)

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Claude Agent SDK auth
# Agents use @anthropic-ai/claude-agent-sdk which authenticates through
# your local Claude Code CLI session. No ANTHROPIC_API_KEY needed.
# Just ensure `claude` CLI is installed and authenticated.

# Optional
SUPABASE_ANON_KEY=your-anon-key              # For auth features
LLM_PROVIDER=auto                             # anthropic | openrouter | auto
OPENROUTER_API_KEY=sk-or-...                  # For OpenRouter fallback
SANDBOX_MODE=none                             # none | docker | e2b
AUDIT_HMAC_SECRET=change-me-in-production     # For audit proof chain
```

---

## Database Setup

Run the SQL migrations in order against your Supabase project:

```bash
# Via Supabase Dashboard → SQL Editor, or via CLI:
ls supabase/migrations/
# 002_provider_tracking.sql
# 003_pipeline_stages.sql
# 005_reasoning.sql
# 006_auth_rls.sql
# 007_tool_audit.sql
# 008_sandbox.sql
# 009_ceo_chat.sql
# 010_clipmart.sql
```

The base schema is created via the Supabase dashboard (companies, agents, tickets, sprints, etc.). These migrations add v2.0 columns and tables.

---

## Routes (19)

| Route | Page |
|-------|------|
| `/` | Master Dashboard — all projects with usage stats |
| `/clipmart` | Template marketplace — browse/import company templates |
| `/company/:id` | Office — live pixel office + agent panels |
| `/company/:id/agents` | Agents — hire (20 roles), configure, fire |
| `/company/:id/agents/:id` | Agent Detail — memory, skills, sessions |
| `/company/:id/goals` | Goals — goal tree + delegation progress |
| `/company/:id/board` | Scrum Board — 5-column Kanban with sprints |
| `/company/:id/documents` | Documents — Obsidian vault browser |
| `/company/:id/costs` | Costs — token usage, per-agent breakdown |
| `/company/:id/org-chart` | Org Chart — CEO → reports hierarchy |
| `/company/:id/merge-requests` | Merge Requests — diff review, merge/reject |
| `/company/:id/audit` | Audit Trail — tool call log with HMAC verification |
| `/company/:id/chat` | CEO Chat — streaming conversation with CEO agent |
| `/company/:id/settings` | Project Config — repo, skills, MCP, rules |
| `/settings` | Global Settings — connection status, config cascade |

---

## Project Structure

```
ceo-simulator/
├── src/                              # React 19 frontend
│   ├── components/                   # 30+ components (pixel RPG style)
│   │   ├── AuthGate.tsx              # Auth wrapper (pass-through if offline)
│   │   ├── LoginPage.tsx             # Pixel RPG login screen
│   │   ├── MasterDashboard.tsx       # Project grid
│   │   ├── CeoChat.tsx               # SSE streaming chat
│   │   ├── AuditTrailPage.tsx        # Tool call audit viewer
│   │   ├── ClipmartPage.tsx          # Template marketplace
│   │   ├── ScrumBoard.tsx            # Kanban board
│   │   └── PixelOfficeCanvas.tsx     # Canvas 2D game loop
│   ├── engine/                       # Canvas renderer + pathfinding
│   │   ├── SpriteAtlas.ts            # Spritesheet slicing
│   │   ├── CharacterSprite.ts        # RPG character state machine
│   │   └── canvasRenderer.ts         # Tile + furniture renderer
│   ├── hooks/                        # useAuth, useRealtimeSync, useAgentPolling
│   ├── store/                        # Zustand state (dashboard, planning)
│   └── lib/                          # Supabase + orchestrator API clients
├── server/                           # Express orchestrator
│   ├── index.ts                      # Entry point (~72 lines)
│   ├── routes/                       # 15 route modules
│   ├── dal/                          # 12 data access repos
│   ├── middleware/                    # auth, errorHandler, validate
│   ├── providers/                    # LLM provider registry (Anthropic + OpenRouter)
│   ├── tools/                        # Tool provisioning (tiered, validated)
│   ├── pipeline/                     # Staged execution (plan→exec→verify→fix)
│   ├── sandbox/                      # Execution isolation (none/docker/e2b)
│   ├── audit/                        # HMAC proof chain audit trail
│   ├── replay/                       # JSONL session recording
│   ├── reasoning/                    # ReasoningBank trajectory storage
│   ├── clipmart/                     # Template marketplace logic
│   ├── agents/                       # Agent runners (Claude, HTTP, Bash)
│   ├── helpers/                      # Brain helpers, sprint logic
│   └── constants.ts                  # Roles, colors, desk positions
├── docker/                           # Self-hosting
│   ├── Dockerfile                    # Multi-stage (node:22-alpine)
│   ├── docker-compose.yml            # Server + PostgreSQL
│   └── .env.docker.example           # Template env vars
├── supabase/
│   └── migrations/                   # 8 SQL migration files (v2.0)
├── brain/                            # Obsidian vault
│   ├── library/skills/               # 61 skill files (15 role dirs)
│   ├── wiki/                         # Architecture specs
│   └── {project-name}/               # Per-project plans + docs
├── public/assets/                    # Pixel art sprites + tiles
├── CLAUDE.md                         # Autonomy engine directives
└── vercel.json                       # SPA deployment config
```

---

## Agent Roles (20)

### Engineering
| Role | Model | Focus |
|------|-------|-------|
| CEO | Opus | Strategic delegation, goal decomposition |
| PM | Sonnet | Requirements, specs, sprint planning |
| Frontend | Sonnet | React 19, Tailwind, pixel art UI |
| Backend | Sonnet | APIs, Supabase, database |
| DevOps | Sonnet | CI/CD, Vercel, infrastructure |
| QA | Haiku | Tests, validation, regressions |
| Full-Stack | Sonnet | End-to-end features |

### Data & AI
| Role | Model | Focus |
|------|-------|-------|
| Data Architect | Opus | Schemas, data modeling, migrations |
| Data Scientist | Opus | ML pipelines, experiments |
| AI Engineer | Opus | LLM integration, prompts, RAG |
| Automation | Sonnet | Workflows, ETL, webhooks |
| Scrum Master | Haiku | Daily summaries, velocity |

### Business
| Role | Model | Focus |
|------|-------|-------|
| Marketer | Sonnet | Growth, SEO, launches |
| Content Writer | Haiku | Copy, docs, blog |
| Sales | Sonnet | Pricing, funnels |
| Operations | Haiku | SOPs, compliance |
| Data Analyst | Sonnet | KPIs, dashboards |
| Finance | Sonnet | Financial models |
| SEO | Sonnet | Audits, keywords |
| Growth | Sonnet | A/B tests, referrals |

---

## Scripts

```bash
npm run dev        # Frontend (Vite → :5173)
npm run server     # Orchestrator + heartbeat daemon (→ :3001)
npm run build      # Production build
npm run test       # Vitest tests
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes + ensure `npx tsc --noEmit` and `npm run build` pass
4. Submit a PR

### Development tips

- Server auto-restarts with `tsx --watch` (via `npm run server`)
- Frontend HMR via Vite
- All server code is TypeScript — no compile step needed (tsx runs it directly)
- SQL migrations are idempotent (`IF NOT EXISTS` everywhere)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand |
| Canvas | 2D pixel-art office, BFS pathfinding, RPG sprite animation |
| Backend | Express 5 + TypeScript (tsx) |
| Database | Supabase (PostgreSQL + Realtime + RLS) or self-hosted PostgreSQL |
| LLM | Claude Agent SDK (primary) + OpenRouter (fallback) |
| Auth | Supabase Auth + JWT + Row-Level Security |
| Deployment | Vercel (frontend) + Docker or any Node host (server) |
| Brain | Obsidian vault for specs, plans, agent memory |

---

## License

MIT
