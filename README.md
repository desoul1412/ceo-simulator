# CEO Simulator — Zero-Human Software Factory

A **Paperclip-style AI agent orchestration platform** that manages multiple software projects through autonomous Claude Code agents. Each project connects to its own Git repo. Agents write code in isolated branches, submit merge requests for your review, and track progress on a Scrum board — all from a single pixel-art dashboard.

**Live Demo:** [ceo-simulator-iota.vercel.app](https://ceo-simulator-iota.vercel.app)

---

## What This Tool Does

CEO Simulator is the **control plane for a Zero-Human Software Factory**. You manage high-level business goals across multiple projects. The system handles delegation, coding, testing, and deployment.

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
| **Multi-Project** | One server manages unlimited projects, each connected to its own Git repo |
| **Planning v2** | CEO generates structured plans (architecture, hiring, implementation) with interactive review |
| **Agent-Agnostic** | Hire Claude, HTTP endpoints, or Bash scripts as agents |
| **21 Department Roles** | Engineering, Marketing, Data, Design, Finance, Legal, and more — each with preset skills |
| **Per-Agent Branches** | Every agent works in an isolated `agent/{role}-{task}` branch |
| **Merge Requests** | Review diffs, approve, merge to main — or reject |
| **Scrum Board** | 4-column Kanban (Todo → In Progress → Review → Done) with sprint selector |
| **Sprint Auto-Transition** | When all tickets in a sprint are done, next sprint auto-creates from master plan phases |
| **Approval Gates** | Nothing executes without your approval |
| **Inbox Notifications** | New MRs, plan submissions, agent blockers, sprint completions |
| **Per-Agent Budgets** | USD caps with auto-throttle on exhaust |
| **Heartbeat Daemon** | Auto-processes approved tickets every 30s |
| **Ticket System** | Threaded work items with comments, role-based assignment, approval flow |
| **Agent Memory** | Short-term + long-term + skills → persisted to Obsidian brain directories |
| **Per-Agent Brain** | `brain/{project}/{agent}/soul.md`, `context.md`, `memory.md` — auto-created on hire |
| **3-Level Config** | Global → Project → Agent cascade for skills, rules, MCP servers |
| **Cost Tracking** | Real Claude API token usage per agent, daily/weekly %, merged into Org & Costs view |
| **Circuit Breaker** | Auto-detects failing agents, prevents infinite retry loops |
| **Dependency Manager** | Manages task dependencies and execution ordering |
| **Agent Messaging** | Inter-agent communication for coordination |
| **Env Var Management** | Per-project, encrypted, injected into agent execution |
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

### 3. Start

```bash
# Terminal 1: Frontend
npm run dev          # → http://localhost:5173

# Terminal 2: Orchestrator (real Claude agents)
npm run server       # → http://localhost:3001 (heartbeat daemon auto-starts)

# Or run both:
npm run dev:all      # Concurrent frontend + server
```

### 4. Connect a Project

1. Open `http://localhost:5173`
2. Click **+ New Company** → enter project name
3. Paste Git repo URL (e.g. `https://github.com/org/project.git`)
4. Optionally add GitHub PAT for private repos
5. Enter a CEO directive in the Office view → agents start planning
6. Review and approve the plan → agents start working

---

## Multi-Project Architecture

```
CEO Simulator (1x server, 1x frontend)
         │
    ┌────┼────┬────┐
    ↓    ↓    ↓    ↓
 Project A    Project B    Project C
 repo: github/org/app-a    repo: github/org/app-b    repo: github/org/app-c
 agents → own branches     agents → own branches     agents → own branches
 scrum board               scrum board               scrum board
 merge requests             merge requests             merge requests
```

Each project gets:
- Its own cloned repo at `.company-repos/{id}/`
- Its own agents, sprints, tickets, merge requests
- Its own environment variables (encrypted)
- Its own brain directory at `brain/{project-name}/`
- Per-agent brain directories with soul, context, and memory files
- Complete data isolation

---

## Navigation (12 Routes)

| Route | Tab | Description |
|-------|-----|-------------|
| `/` | Dashboard | All projects with usage %, working/idle status |
| `/company/:id` | Office | Pixel office canvas + 3x3 agent card grid + CEO directive |
| `/company/:id/agents/:id` | Agent Detail | Memory, skills, sessions, configs |
| `/company/:id/goals` | Goals | Master plan progress, delegation tree, sprint history |
| `/company/:id/board` | Board | 4-column Kanban (Todo/In Progress/Review/Done), sprints, velocity |
| `/company/:id/merge-requests` | MRs | Agent PRs — review diffs, merge, reject |
| `/company/:id/documents` | Docs | Obsidian vault browser |
| `/company/:id/org-chart` | Org & Costs | Org chart + budget overview + per-agent cost cards + API call log |
| `/company/:id/settings` | Config | Repo, skills, MCP, rules, env vars |
| `/settings` | Global Settings | Connection status, config cascade |
| `/settings/:tab` | Settings Tab | skills, mcp, rules sub-pages |

Plus: **Inbox** (bell icon) for notifications across all projects.

---

## Department Roles (21)

The preset system provides 21 department roles, each with default skills, system prompts, model tiers, and budget limits:

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

Plus **20 legacy agent presets** in `brain/library/agent-presets/` for backward compatibility.

---

## Skills Library

`brain/library/skills/` — 61 skill files across 18 role directories:

```
_shared/ (5)          — quality-engineering, systematic-debugging, context7, tavily, git-worktree
ceo/ (5)              — strategic-delegation, business-reasoning, budget, team-orchestration, ...
planner/ (4)          — discovery, project-planning, writing-plans, risk-assessment
frontend-designer/ (5)— ui-ux-pro-max, react, tailwind, canvas, tdd
backend/ (2)          — api-design, database
full-stack/ (2)       — end-to-end, rapid-prototyping
devops/ (3)           — ci/cd, infrastructure, deployment-verification
qa/ (3)               — test-strategy, automated-testing, data-validation
designer/ (3)         — pixel-art-hud, responsive-design, design-tokens
marketer/ (5)         — launch, seo, analytics, social, brand
content-writer/ (3)   — copywriting, content-strategy, technical-writing
sales/ (2)            — pricing, customer-success
operations/ (2)       — process-finance, compliance
data-engineer/ (3)    — pipeline-debugging, pandas, data-quality
data-architect/ (3)   — data-modeling, etl, migration-safety
data-scientist/ (3)   — ml-pipelines, experiment-design, statistics
ai-engineer/ (5)      — llm, prompts, orchestration, rag, sdk
automation/ (3)       — n8n, pipelines, webhooks
```

---

## Project Structure

```
ceo-simulator/
├── src/                          # React 19 frontend
│   ├── components/               # 39 React components
│   │   ├── MasterDashboard.tsx   # Project grid with usage %, working/idle
│   │   ├── CompanyDetail.tsx     # Pixel office + 3x3 agent grid + CEO directive
│   │   ├── AgentCard.tsx         # Compact card + detail modal (activity, tickets, config)
│   │   ├── PixelOfficeCanvas.tsx # Canvas 2D game loop with BFS pathfinding
│   │   ├── ScrumBoard.tsx        # 4-column Kanban with sprints
│   │   ├── GoalsPage.tsx         # Master plan progress + delegation tree + sprints
│   │   ├── OrgChartPage.tsx      # Org chart + budget + agent cost cards
│   │   ├── MergeRequestsPanel.tsx# MR review with merge/reject
│   │   ├── InboxPanel.tsx        # Notification bell + dropdown
│   │   ├── PlanningPopup.tsx     # Interactive plan review overlay
│   │   ├── PlanningProgress.tsx  # Live planning status indicator
│   │   ├── HireAgentDialog.tsx   # Role browser, auto/manual hire
│   │   ├── DeptRoleBrowser.tsx   # Browse 21 department presets
│   │   ├── ConfigManager.tsx     # 3-level config CRUD
│   │   └── ...
│   ├── engine/                   # Canvas renderer + pathfinding
│   ├── store/                    # Zustand (dashboard, planning, presets)
│   ├── lib/                      # Supabase + orchestrator + planning API clients
│   └── hooks/                    # Realtime sync + polling
├── server/                       # Local orchestrator (Express, 78+ endpoints)
│   ├── index.ts                  # Main API routes
│   ├── routes/                   # Modular route files (agents, planning, presets)
│   ├── ticketProcessor.ts        # Worktree → execute → commit → push → MR
│   ├── repoManager.ts            # Per-company Git repo management
│   ├── heartbeatDaemon.ts        # 30s auto-processor
│   ├── worktreeManager.ts        # Git worktree isolation
│   ├── memoryManager.ts          # Agent memory → Obsidian
│   ├── circuitBreaker.ts         # Failure detection + auto-recovery
│   ├── dependencyManager.ts      # Task dependency resolution
│   ├── agentMessenger.ts         # Inter-agent communication
│   ├── presets/                   # 21 department role presets + seeder
│   │   ├── presetRegistry.ts     # Runtime preset lookup
│   │   ├── presetSeeder.ts       # DB seeding (21 roles, 120+ skills)
│   │   └── types.ts              # DepartmentRole, AgentSkill types
│   └── agents/
│       ├── agentRunner.ts        # Universal runtime dispatcher
│       ├── claudeRunner.ts       # Claude Agent SDK
│       ├── ceoPlannerV2.ts       # Structured planning engine
│       ├── taskClassifier.ts     # Auto-classify task complexity
│       ├── httpRunner.ts         # HTTP endpoint agents
│       ├── bashRunner.ts         # Bash script agents
│       ├── worker.ts             # Agent task execution loop
│       └── ceo.ts                # CEO reasoning + delegation
├── e2e/                          # Playwright E2E tests (10 specs)
│   ├── 01-dashboard.spec.ts      # Master dashboard
│   ├── 02-company-view.spec.ts   # Office view
│   ├── 03-agent-card.spec.ts     # Agent cards + modals
│   ├── 04-scrum-board.spec.ts    # Kanban board
│   ├── 05-planning.spec.ts       # Planning flow
│   ├── 07-api-health.spec.ts     # API health checks
│   ├── 09-planning-execution-flow.spec.ts # Full pipeline
│   └── ...
├── brain/                        # Obsidian vault
│   ├── library/
│   │   ├── skills/               # 61 skill files (18 role dirs)
│   │   ├── agent-presets/        # 20 agent preset configs
│   │   ├── rules/                # 6 rule definitions
│   │   └── mcp-servers/          # 3 MCP server configs
│   ├── wiki/                     # Architecture specs
│   └── {project-name}/           # Per-project plans, agent brains, sprint docs
├── supabase/                     # Database migrations
├── public/assets/                # Pixel art sprites, tiles, furniture
├── .company-repos/               # Cloned project repos (gitignored)
├── CLAUDE.md                     # Autonomy engine directives
├── playwright.config.ts          # E2E test config
└── vercel.json                   # SPA deployment config
```

---

## API Reference (100+ Endpoints)

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status |
| `POST` | `/api/assign-goal` | CEO reasons + delegates |
| `POST` | `/api/process-queue` | Process next approved ticket |

### Planning (v2)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/companies/:id/plan` | Start planning session |
| `GET` | `/api/plan-sessions/:id` | Get session status + results |
| `POST` | `/api/plan-sessions/:id/approve` | Approve plan |
| `POST` | `/api/plan-sessions/:id/regenerate` | Regenerate with feedback |
| `GET` | `/api/plan-sessions/:id/dependency-graph` | Task dependency graph |

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
| `POST` | `/api/sprints/:id/complete` | Complete sprint (triggers auto-transition) |
| `PATCH` | `/api/tickets/:id/column` | Move ticket on board |
| `PATCH` | `/api/tickets/:id` | Update ticket |

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hire-agent` | Create agent (21 dept roles) |
| `PATCH` | `/api/agents/:id` | Update agent config |
| `DELETE` | `/api/agents/:id` | Fire agent |
| `PATCH` | `/api/agents/:id/lifecycle` | Pause/resume/terminate |
| `PATCH` | `/api/agents/:id/budget` | Adjust budget |
| `POST` | `/api/agents/:id/inject-skill` | Add skill at runtime |
| `GET` | `/api/agents/:id/messages` | Agent message history |
| `POST` | `/api/agents/:id/messages` | Send message to agent |

### Presets
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/presets/departments` | List 21 department roles |
| `GET` | `/api/presets/departments/:slug` | Get department details |
| `GET` | `/api/presets/skills` | List all preset skills |
| `POST` | `/api/presets/seed` | Seed presets to DB |

### Brain (Agent Memory)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/companies/:id/brain/update-summary` | Update project brain summary |
| `POST` | `/api/companies/:cid/agents/:aid/brain/init` | Init agent brain directory |
| `POST` | `/api/companies/:cid/agents/:aid/brain/update-memory` | Append to agent memory |

### Project Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/:id/plans` | List plans |
| `POST` | `/api/companies/:id/plans` | Create plan |
| `PATCH` | `/api/plans/:id` | Edit plan content |
| `POST` | `/api/plans/:id/approve` | Approve plan (triggers sprint/hiring) |
| `POST` | `/api/plans/:id/comments` | Add comment |

### Repository
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/companies/:id/repo` | Connect Git repo |
| `POST` | `/api/companies/:id/repo/sync` | Pull latest |
| `DELETE` | `/api/companies/:id/repo` | Disconnect repo |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | Unread notifications |
| `GET` | `/api/notifications/count` | Unread count |
| `POST` | `/api/notifications/:id/read` | Mark read |

### Environment Variables
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/:id/env-vars` | List (secrets masked) |
| `POST` | `/api/companies/:id/env-vars` | Create |
| `DELETE` | `/api/env-vars/:id` | Delete |

### Config (3-Level Cascade)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/configs?scope=&type=` | List configs |
| `GET` | `/api/configs/effective/:agentId` | Merged config for agent |
| `POST` | `/api/configs` | Create config |
| `PATCH` | `/api/configs/:id` | Update |
| `DELETE` | `/api/configs/:id` | Remove |

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
- **Backend:** Supabase (PostgreSQL + Realtime + RLS)
- **Orchestrator:** Express + @anthropic-ai/claude-agent-sdk
- **Testing:** Vitest (unit) + Playwright (E2E, 10 specs)
- **Deployment:** Vercel (frontend) + local server (orchestrator)
- **Brain:** Obsidian vault for specs, plans, agent memory, per-agent brain dirs

---

## License

MIT
