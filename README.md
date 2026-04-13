# CEO Simulator — Zero-Human Software Factory

A **multi-LLM agent orchestration platform** that manages multiple software projects through autonomous AI agents. Each project connects to its own Git repo. Agents write code in isolated branches, submit merge requests for your review, and track progress on a Scrum board — all from a single pixel-art dashboard.

Supports **Claude SDK, Claude API, OpenRouter, Gemini, QwenCode** — with per-agent priority-based model routing and automatic fallback chains.

**Live Demo:** [ceo-simulator-iota.vercel.app](https://ceo-simulator-iota.vercel.app)

---

## What This Tool Does

CEO Simulator is the **control plane for a Zero-Human Software Factory**. You manage high-level business goals across multiple projects. The system handles delegation, coding, testing, and deployment — across any LLM provider.

### The Flow

```
1. Create a project → connect a Git repo (public or private via PAT)
2. Enter a CEO directive → select project size (S/M/L)
3. CEO agent analyzes the codebase → generates architecture, hiring plan, implementation plan
4. You review, edit → approve the plan
5. Agents are auto-hired per the approved plan
6. Sprint 1 is created with tickets assigned to agents by role
7. Each agent works in their own branch → commits → pushes → creates a Merge Request
8. You review MRs on the Board → approve → merge to main
9. When a sprint completes → next sprint auto-creates from the master plan
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-LLM Router** | 5 providers (Claude SDK, Claude API, OpenRouter, Gemini, QwenCode) with priority-based fallback per agent |
| **Multi-Project** | One server manages unlimited projects, each connected to its own Git repo |
| **Planning v2** | CEO generates structured plans (architecture, hiring, implementation) with interactive review |
| **21 Department Roles** | Engineering, Marketing, Data, Design, Finance, Legal, and more — each with preset skills |
| **4-Layer Memory** | Semantic (pgvector), Episodic (JSONB), Structured (SQL), Working (in-process) |
| **Semantic Search** | pgvector embeddings on brain docs — agents retrieve relevant past work via ANN similarity search |
| **Token Budget Manager** | Caps context injection at ~4000 tokens, deduplicates across memory layers, smart sentence-boundary truncation |
| **Agent-to-Agent Queries** | Active mid-task communication — agents can ask other agents questions and get responses |
| **Per-Agent Branches** | Every agent works in an isolated `agent/{role}-{task}` branch |
| **Merge Requests** | Review diffs, approve, merge to main — or reject |
| **Scrum Board** | 4-column Kanban (Todo → In Progress → Review → Done) with sprint selector |
| **Sprint Auto-Transition** | When all tickets done, next sprint auto-creates from master plan phases |
| **Dependency DAG** | Task dependency graph with cycle detection — agents wait for upstream work |
| **Approval Gates** | Nothing executes without your approval |
| **Per-Agent Budgets** | USD caps calibrated to Team Premium ($5.86/day, $41/week Sonnet reference) |
| **Heartbeat Daemon** | Auto-processes approved tickets every 30s |
| **Circuit Breaker** | Auto-detects failing agents, prevents infinite retry loops |
| **Cross-Device Ready** | PostgreSQL-primary brain, runtime orchestrator URL, MCP config sync on startup |
| **Pixel Office** | Canvas 2D animated office with BFS pathfinding and heartbeat visuals |
| **E2E Test Suite** | 10 Playwright specs covering dashboard, agents, board, planning, API |

---

## Quick Start

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

### 1. Clone & Install

```bash
git clone https://github.com/desoul1412/ceo-simulator.git
cd ceo-simulator
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key

# Server env:
cp .env.example server/.env
# Edit server/.env:
#   SUPABASE_URL=https://your-project.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Migrations

Run these SQL files in the Supabase SQL Editor (in order):

1. `supabase/planning-flow-setup.sql` — planning sessions, dependencies
2. `supabase/migrations/011_agent_presets.sql` — department roles + skills
3. `supabase/migrations/013_llm_providers.sql` — LLM providers, models, routing
4. `supabase/migrations/014_brain_documents.sql` — brain docs + pgvector
5. `supabase/migrations/015_brain_search_function.sql` — semantic search RPC

### 4. Start

```bash
# Terminal 1: Frontend
npm run dev          # → http://localhost:5173

# Terminal 2: Orchestrator (real agents)
npm run server       # → http://localhost:3001

# Or run both:
npm run dev:all      # Concurrent frontend + server
```

On startup, the orchestrator automatically:
- Seeds department role presets (21 roles, 120+ skills)
- Seeds default LLM provider (Claude SDK + 3 models)
- Syncs MCP configs from Supabase → local `.claude/settings.json`
- Syncs brain documents to local filesystem (if `BRAIN_SYNC_ENABLED=true`)
- Auto-clones missing company Git repos
- Resets stale tickets/agents from previous crashes

### 5. Optional: Orchestrator Auth (recommended for LAN/cross-device)

By default the orchestrator is open (local dev). To require authentication:

```bash
# Generate a secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# server/.env
ORCHESTRATOR_SECRET=your-generated-secret

# .env (frontend) — or set via Settings UI at runtime
VITE_ORCHESTRATOR_SECRET=your-generated-secret
```

When `ORCHESTRATOR_SECRET` is set, every API request must include the header `X-Orchestrator-Secret: <value>`. The frontend `orchFetch()` wrapper sends it automatically. `/api/health` is always open for connectivity checks.

You can also set the secret at runtime in the browser without rebuilding:
```js
// Browser console or Settings page
import { setOrchestratorSecret } from './lib/orchestratorApi';
setOrchestratorSecret('your-generated-secret'); // stored in localStorage
```

### 6. Optional: Embedding Provider (semantic memory search)

Without embeddings the system falls back to ILIKE text search — everything still works, agents just can't do "find docs similar to this task" style retrieval.

**Recommended: Ollama (local, free, no API key)**

```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull the model (~274 MB)
ollama pull nomic-embed-text
```

```env
# server/.env
EMBEDDING_API_URL=http://localhost:11434/v1/embeddings
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMS=768
# No EMBEDDING_API_KEY needed for Ollama
```

**Alternatives:**

| Provider | Model | Dims | Key required |
|----------|-------|------|-------------|
| OpenAI | `text-embedding-3-small` | 1536 | Yes |
| Voyage AI (free tier) | `voyage-3-lite` | 512 | Yes |
| Ollama | `nomic-embed-text` | 768 | No |

> If using a non-768-dim model, update the `embedding vector(768)` column in migration 014 to match.

Brain documents are auto-embedded on write (fire-and-forget, non-blocking). Agents retrieve relevant past work via ANN similarity search before each task.

---

## Multi-LLM Architecture

```
Settings > LLM Models
  ├── Claude SDK (Local)     → haiku, sonnet, opus     [SDK — filesystem access]
  ├── Claude API (Direct)    → any Claude model         [HTTP — text only]
  ├── OpenRouter             → 100+ models              [HTTP — text only]
  ├── Gemini                 → flash, pro               [HTTP — text only]
  └── QwenCode               → qwen-coder-32b, etc.     [HTTP — text only]

Per-Agent Routing (priority order):
  Agent "Frontend" → 1. QwenCode  2. Claude Sonnet  3. Gemini Pro
  Agent "PM"       → 1. Gemini Pro  2. Claude Haiku
  Global default   → 1. Claude Sonnet

Role-Based Constraint:
  Code tasks (Frontend/Backend/DevOps/QA) → SDK providers only (filesystem access)
  Planning/writing (PM/CEO/Content)       → any provider
```

The LLM Router (`server/llm/router.ts`) tries models in priority order. On failure, it automatically falls back to the next model. If no routing rules are configured, it falls back to the existing `taskClassifier.selectModel()` behavior.

---

## 4-Layer Memory Architecture

| Layer | Storage | What | How |
|-------|---------|------|-----|
| **Semantic** | `brain_documents.embedding` (pgvector) | Past work, docs, plans | ANN similarity search on task start |
| **Episodic** | `agents.memory` JSONB | Completed tasks, learned skills | Auto-promotes recurring themes to long-term |
| **Structured** | SQL tables | Agents, tickets, configs, deps | Exact FK lookups |
| **Working** | In-process Zustand + prompt | Current session context | Token-budgeted injection (~4000 tokens cap) |

The **Token Budget Manager** (`contextBudget.ts`) controls context injection:
- Messages: 40% (upstream dependency context)
- Brain semantic: 25% (pgvector search results)
- Episodic memory: 15% (completed tasks, skills)
- Skill context: 15% (department role skills)
- Deduplicates across all layers, smart sentence-boundary truncation

---

## Cross-Device Architecture

```
Device A (laptop)                    Device B (desktop)
  Browser → Vercel SPA                 Browser → Vercel SPA
       ↓                                    ↓
  localhost:3001 (orchestrator)        localhost:3001 (orchestrator)
       ↓                                    ↓
       └──── both read/write ────→ Supabase (shared) ←────┘
```

- **Brain documents** stored in PostgreSQL (Supabase) — primary source of truth
- **Local filesystem mirror** optional (`BRAIN_SYNC_ENABLED=true` for Obsidian viewing)
- **Orchestrator URL** configurable at runtime (Settings > General, stored in localStorage)
- **MCP configs** synced from `shared_configs` table → local `.claude/settings.json` on startup
- **Company repos** auto-cloned on startup if missing locally

---

## Navigation (12 Routes)

| Route | Tab | Description |
|-------|-----|-------------|
| `/` | Dashboard | All projects with usage %, working/idle status |
| `/company/:id` | Office | Pixel office canvas + 3x3 agent card grid + CEO directive |
| `/company/:id/agents/:id` | Agent Detail | Memory, skills, sessions, model routing |
| `/company/:id/goals` | Goals | Master plan progress, delegation tree, sprint history |
| `/company/:id/board` | Board | 4-column Kanban, sprints, velocity |
| `/company/:id/merge-requests` | MRs | Agent PRs — review diffs, merge, reject |
| `/company/:id/documents` | Docs | Brain documents from PostgreSQL |
| `/company/:id/org-chart` | Org & Costs | Org chart + budget + per-agent cost cards |
| `/company/:id/settings` | Config | Repo, skills, MCP, rules, env vars |
| `/settings` | Global Settings | Connection, orchestrator URL, config cascade |
| `/settings/llm` | LLM Models | Provider CRUD, model management, global routing |
| `/settings/:tab` | Settings Tab | skills, mcp, rules |

Plus: **Inbox** (bell icon) for notifications across all projects.

---

## Department Roles (21)

| # | Department | Model | Budget | Focus |
|---|-----------|-------|--------|-------|
| 1 | Engineering | sonnet | $15 | Frontend, backend, DevOps, QA, AI integration |
| 2 | Paid Media | sonnet | $10 | Ad campaigns, ROAS, retargeting, media buying |
| 3 | Analytics | sonnet | $10 | KPI dashboards, A/B testing, attribution, CLV |
| 4 | Design | sonnet | $12 | UI/UX, pixel art, design systems, prototyping |
| 5 | Consulting | opus | $20 | Strategy, competitive analysis, go-to-market |
| 6 | Content | haiku | $5 | Copywriting, blog, email, technical writing |
| 7 | Education | haiku | $5 | Tutorials, onboarding, knowledge base |
| 8 | E-commerce | sonnet | $10 | Product catalog, checkout, inventory |
| 9 | Email & CRM | sonnet | $10 | Drip campaigns, segmentation, deliverability |
| 10 | Events | haiku | $5 | Webinars, conferences, community events |
| 11 | Finance | sonnet | $5 | Financial models, P&L, forecasts |
| 12 | People & HR | haiku | $5 | Hiring, culture, performance reviews |
| 13 | Industry Ops | sonnet | $10 | Domain-specific operations |
| 14 | Customer Success | sonnet | $10 | Onboarding, retention, support |
| 15 | Legal | opus | $15 | Compliance, contracts, IP |
| 16 | Community | haiku | $5 | Forums, Discord, user advocacy |
| 17 | Operations | haiku | $5 | SOPs, compliance, budgets |
| 18 | SEO | sonnet | $5 | Audits, keywords, link building |
| 19 | Sales | sonnet | $10 | Pricing, funnels, retention |
| 20 | Social Media | sonnet | $8 | Content calendar, engagement, analytics |
| 21 | Strategy | opus | $20 | Vision, roadmap, market positioning |

Skills are stored in Supabase `department_roles` + `agent_skills` tables (seeded on startup, 120+ skills).

---

## Project Structure

```
ceo-simulator/
├── src/                          # React 19 frontend (40 components)
│   ├── components/
│   │   ├── MasterDashboard.tsx   # Project grid with usage %, working/idle
│   │   ├── CompanyDetail.tsx     # Pixel office + 3x3 agent grid + CEO directive
│   │   ├── AgentCard.tsx         # Compact card + detail modal (config, routing, tickets)
│   │   ├── PixelOfficeCanvas.tsx # Canvas 2D game loop with BFS pathfinding
│   │   ├── ScrumBoard.tsx        # 4-column Kanban with sprints
│   │   ├── GoalsPage.tsx         # Master plan progress + delegation tree
│   │   ├── OrgChartPage.tsx      # Org chart + budget + agent cost cards
│   │   ├── DocumentsPage.tsx     # Brain documents from PostgreSQL
│   │   ├── LLMSettings.tsx       # Provider CRUD, model management, routing editor
│   │   ├── PlanningPopup.tsx     # Interactive plan review overlay
│   │   ├── HireAgentDialog.tsx   # 21 dept roles, auto/manual hire
│   │   └── ...
│   ├── lib/
│   │   ├── orchestratorApi.ts    # 60+ API client functions
│   │   ├── budgetConfig.ts       # Team Premium budget caps + calcUsage()
│   │   └── supabase.ts           # Supabase client with offline fallback
│   ├── store/                    # Zustand (dashboard, planning, presets)
│   └── engine/                   # Canvas renderer + pathfinding
├── server/                       # Orchestrator (Express, 123 endpoints)
│   ├── index.ts                  # Main routes + startup sync
│   ├── routes/                   # Modular: agents, planning, presets, llm
│   ├── llm/                      # Multi-LLM router
│   │   ├── router.ts             # Priority fallback, role-based constraints
│   │   ├── registry.ts           # Provider/model cache from Supabase
│   │   ├── embeddings.ts         # OpenAI-compatible embedding API
│   │   └── adapters/             # claude-sdk, claude-api, openrouter, gemini, qwen-code
│   ├── agents/
│   │   ├── agentRunner.ts        # Universal dispatcher (router → legacy fallback)
│   │   ├── claudeRunner.ts       # Claude Agent SDK (filesystem access)
│   │   ├── ceoPlannerV2.ts       # Structured planning engine
│   │   ├── taskClassifier.ts     # Model tier + effort + budget selection
│   │   ├── worker.ts             # Task execution with budgeted context
│   │   └── ceo.ts                # CEO reasoning + delegation
│   ├── contextBudget.ts          # Token budget manager (4000 token cap)
│   ├── brainSync.ts              # PG-primary brain, optional local mirror
│   ├── brainSearch.ts            # pgvector semantic search
│   ├── agentQuery.ts             # Agent-to-agent active queries
│   ├── agentMessenger.ts         # Inter-agent messaging (dependency chain)
│   ├── dependencyManager.ts      # Task DAG with cycle detection
│   ├── circuitBreaker.ts         # Failure detection + dead letter queue
│   ├── ticketProcessor.ts        # Worktree → execute → commit → push → MR
│   ├── memoryManager.ts          # Episodic memory (short/long-term + skills)
│   ├── env.ts                    # Zod env validation (fail-fast startup)
│   └── presets/                  # 21 dept roles, 120+ skills
├── e2e/                          # Playwright E2E tests (10 specs)
├── supabase/migrations/          # 4 SQL migrations
│   ├── 011_agent_presets.sql     # Department roles + skills tables
│   ├── 013_llm_providers.sql     # LLM provider/model/routing tables
│   ├── 014_brain_documents.sql   # Brain docs + pgvector + user_settings
│   └── 015_brain_search_function.sql # Semantic search RPC
├── brain/                        # Local mirror (PG is primary)
│   ├── 00-Index.md, changelog.md
│   ├── wiki/                     # Architecture specs
│   └── {project-slug}/           # Agent brains, plans, sprints
├── public/assets/                # Pixel art sprites, tiles, furniture
├── .company-repos/               # Cloned project repos (gitignored)
├── CLAUDE.md                     # Autonomy engine directives
└── playwright.config.ts          # E2E test config
```

---

## API Reference (123 Endpoints)

All endpoints (except `/api/health`) require `X-Orchestrator-Secret` when `ORCHESTRATOR_SECRET` is configured.

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status (no auth required) |
| `POST` | `/api/assign-goal` | CEO reasons + delegates |
| `POST` | `/api/process-queue` | Process next approved ticket |

### LLM Providers & Routing
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST/PATCH/DELETE` | `/api/llm/providers` | CRUD providers |
| `GET/POST/PATCH/DELETE` | `/api/llm/models` | CRUD models per provider |
| `GET/PUT` | `/api/llm/routing/global` | Global default routing chain |
| `GET/PUT` | `/api/llm/routing/company/:id` | Company default chain |
| `GET/PUT` | `/api/llm/routing/agent/:id` | Per-agent routing chain |

### Planning (v2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/companies/:id/plan` | Start planning session |
| `GET` | `/api/plan-sessions/:id` | Get session status + results |
| `POST` | `/api/plan-sessions/:id/approve` | Approve plan |
| `POST` | `/api/plan-sessions/:id/regenerate` | Regenerate with feedback |
| `GET` | `/api/plan-sessions/:id/dependency-graph` | Task dependency graph |

### Brain & Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/brain/documents` | List brain docs (filter by company, type) |
| `GET` | `/api/brain/documents/:id` | Read document |
| `POST` | `/api/brain/search` | Semantic similarity search (pgvector) |
| `POST` | `/api/companies/:id/brain/update-summary` | Update project summary |
| `POST` | `/api/companies/:cid/agents/:aid/brain/init` | Init agent brain |

### Agent-to-Agent
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agents/query` | Ask an agent a question (by ID or role) |
| `POST` | `/api/agents/query-team` | Broadcast question to all agents |

### Merge Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/:id/merge-requests` | List MRs |
| `POST` | `/api/merge-requests/:id/merge` | Merge branch to main |
| `POST` | `/api/merge-requests/:id/reject` | Reject MR |
| `GET` | `/api/merge-requests/:id/diff` | Get diff summary |

### Sprints & Board
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/:id/sprints` | List sprints |
| `POST` | `/api/companies/:id/sprints` | Create sprint |
| `POST` | `/api/sprints/:id/complete` | Complete sprint (auto-transition) |
| `PATCH` | `/api/tickets/:id/column` | Move ticket on board |

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hire-agent` | Create agent (21 dept roles) |
| `PATCH` | `/api/agents/:id` | Update agent config |
| `DELETE` | `/api/agents/:id` | Fire agent |
| `PATCH` | `/api/agents/:id/lifecycle` | Pause/resume/terminate |

### Shared Configs
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/shared-configs/:key` | Read shared config (MCP, CLAUDE.md) |
| `PUT` | `/api/shared-configs/:key` | Write shared config |

---

## Budget (Team Premium)

Based on Claude Team Premium subscription (6.25x Pro):

| Model | Cost per 1% Weekly | Daily Cap | Weekly Cap |
|-------|-------------------|-----------|------------|
| Haiku 4.5 | $0.14 | $2.00 | $14 |
| **Sonnet 4.6** | **$0.41** | **$5.86** | **$41** |
| Opus 4.6 | $0.69 | $9.86 | $69 |

Weekly token budget: ~9.24M tokens. Override via `VITE_DAILY_BUDGET_CAP` / `VITE_WEEKLY_BUDGET_CAP`.

---

## Scripts

```bash
npm run dev          # Frontend (Vite :5173)
npm run server       # Orchestrator + heartbeat daemon (:3001)
npm run dev:all      # Both concurrently
npm run build        # Production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests (10 specs)
npm run test:all     # Unit + E2E
```

---

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand
- **Canvas:** 2D pixel-art office, BFS pathfinding, sprite animation
- **Database:** Supabase (PostgreSQL + pgvector + Realtime + RLS)
- **Orchestrator:** Express + multi-LLM router (5 providers, priority fallback)
- **Memory:** 4-layer (semantic/pgvector, episodic/JSONB, structured/SQL, working/in-process)
- **Testing:** Vitest (unit) + Playwright (E2E, 10 specs)
- **Validation:** Zod (server env), token budget manager (context cap)
- **Deployment:** Vercel (frontend) + local/any server (orchestrator)

---

## License

MIT
