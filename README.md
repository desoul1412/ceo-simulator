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

CEO Simulator is the **control plane for a Zero-Human Software Factory**. You type a directive. The AI CEO plans it. Agents execute it.

```
1. Create a project → connect a Git repo
2. Type a CEO directive: "Add dark mode" / "Build auth system" / anything
3. CEO Planning Terminal generates a 7-tab plan:
   Overview → Findings → Research → Tech Stack → Architecture → Hiring Plan → Implementation Plan
4. You review each tab, edit if needed, then Approve & Execute
5. System auto-hires agents + creates Sprint with tickets + dependency DAG
6. Agents pick up tickets via heartbeat → read code → make changes → commit → push → create MR
7. You review MRs on the Scrum Board → merge to main
8. Blocked tickets auto-unblock when dependencies complete → next agents start
9. Repeat with new directives. Each builds on the last.
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
│  Routes (17 modules)     Middleware                    │
│  ├─ auth.ts              ├─ auth.ts (JWT + RLS)      │
│  ├─ companies.ts         ├─ errorHandler.ts          │
│  ├─ agents.ts            └─ validate.ts              │
│  ├─ tickets.ts                                        │
│  ├─ sprints.ts          Providers (4)                 │
│  ├─ plans.ts            ├─ anthropicProvider.ts      │
│  ├─ planning.ts         ├─ openaiProvider.ts         │
│  ├─ mergeRequests.ts    ├─ geminiProvider.ts         │
│  ├─ providers.ts        ├─ openrouterProvider.ts     │
│  ├─ marketplace.ts      └─ registry.ts (failover)    │
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
LLM_PROVIDER=auto        # Claude → OpenAI → Gemini → OpenRouter (priority chain)
# LLM_PROVIDER=anthropic  # Claude Agent SDK only (default, uses local CLI auth)
# LLM_PROVIDER=openai     # OpenAI API (requires OPENAI_API_KEY)
# LLM_PROVIDER=gemini     # Google Gemini API (requires GEMINI_API_KEY)
# LLM_PROVIDER=openrouter # OpenRouter (requires OPENROUTER_API_KEY)
```

| Provider | Auth | Models |
|----------|------|--------|
| **Anthropic** (default) | Claude Code CLI session (no API key needed) | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 |
| **OpenAI** | `OPENAI_API_KEY` | o1, GPT-4o, GPT-4o-mini |
| **Gemini** | `GEMINI_API_KEY` | Gemini 2.5 Pro, 2.0 Flash |
| **OpenRouter** | `OPENROUTER_API_KEY` | Any model on OpenRouter |

**Auto-failover:** When `LLM_PROVIDER=auto`, providers are tried in priority order. If one fails, the next is used automatically.

**Custom models:** Override default model names per tier in Settings > LLM Providers, or set per-agent in the agent config panel.

**3-tier routing:** CEO → Opus-tier, PM/Dev → Sonnet-tier, QA/Scrum → Haiku-tier. Budget and effort auto-scaled by story points.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Project** | One server, unlimited projects, each with its own Git repo |
| **Multi-Provider** | Anthropic, OpenAI, Gemini, OpenRouter — auto-failover with custom model names |
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
| **Skill Marketplace** | Browse and install skills from [claudemarketplaces.com](https://claudemarketplaces.com/) — one-click install |
| **MCP Server Management** | Add/remove/test MCP servers from Settings — agents use them as tools |
| **E2E Testing** | 39 Playwright tests covering dashboard, board, agents, planning, API health |
| **Smart Token Optimization** | Model/effort/budget auto-selected per role + story points. Prompt caching via static system prompts |

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
LLM_PROVIDER=auto                             # anthropic | openai | gemini | openrouter | auto
OPENAI_API_KEY=sk-...                         # For OpenAI provider
GEMINI_API_KEY=AI...                          # For Google Gemini provider
OPENROUTER_API_KEY=sk-or-...                  # For OpenRouter provider
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
| `/settings/providers` | LLM Providers — configure Anthropic/OpenAI/Gemini/OpenRouter, custom model names |
| `/settings/marketplace` | Skill Marketplace — browse/install skills from claudemarketplaces.com |

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
│   ├── providers/                    # LLM provider registry (Anthropic, OpenAI, Gemini, OpenRouter)
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
├── e2e/                              # Playwright E2E tests (10 suites)
│   ├── 01-dashboard.spec.ts         # Navigation, company cards
│   ├── 04-scrum-board.spec.ts       # Kanban, tickets, sprints
│   ├── 07-api-health.spec.ts        # API endpoint tests
│   ├── 09-planning-execution-flow.spec.ts  # Full pipeline test
│   └── 10-monitor-agents.spec.ts    # Live agent monitoring
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
npm run dev            # Frontend (Vite → :5173)
npm run server         # Orchestrator + heartbeat daemon (→ :3001)
npm run dev:all        # Both frontend + server (concurrently)
npm run build          # Production build
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright E2E tests (39 tests)
npm run test:e2e:headed    # E2E with visible browser
npm run test:e2e:ui        # Playwright interactive UI
npm run test:e2e:api       # API health tests only (fast)
npm run test:e2e:pipeline  # Full planning → execution pipeline test (headed)
npm run test:all       # Unit + E2E combined
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
| LLM | Claude Agent SDK + OpenAI + Gemini + OpenRouter (auto-failover) |
| E2E Testing | Playwright (39 tests — dashboard, board, agents, planning, API) |
| Auth | Supabase Auth + JWT + Row-Level Security |
| Deployment | Vercel (frontend) + Docker or any Node host (server) |
| Brain | Obsidian vault for specs, plans, agent memory |

---

## License

MIT
