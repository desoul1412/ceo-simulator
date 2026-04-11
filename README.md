# CEO Simulator — Zero-Human Software Factory

A **Paperclip-style AI agent orchestration platform** that manages multiple software projects through autonomous Claude Code agents. Each project connects to its own Git repo. Agents write code in isolated branches, submit merge requests for your review, and track progress on a Scrum board — all from a single pixel-art dashboard.

**Live Demo:** [ceo-simulator-iota.vercel.app](https://ceo-simulator-iota.vercel.app)

---

## What This Tool Does

CEO Simulator is the **control plane for a Zero-Human Software Factory**. You manage high-level business goals across multiple projects. The system handles delegation, coding, testing, and deployment.

### The Flow

```
1. Create a project → connect a Git repo (public or private via PAT)
2. CEO agent reviews the codebase → generates Project Overview
3. CEO proposes: Summary, Master Plan, Hiring Plan, Required Env Vars
4. You review, edit, comment → approve the plan
5. Agents are hired per the approved plan
6. CEO creates Sprint 1 → you approve the backlog
7. Each agent works in their own branch → commits → pushes → creates a Merge Request
8. You review MRs on the Scrum Board → approve → merge to main
9. Scrum Master posts daily summaries → inbox notifications
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Project** | One server manages unlimited projects, each connected to its own Git repo |
| **Agent-Agnostic** | Hire Claude, HTTP endpoints, or Bash scripts as agents |
| **Per-Agent Branches** | Every agent works in an isolated `agent/{role}-{task}` branch |
| **Merge Requests** | Review diffs, approve, merge to main — or reject |
| **Scrum Board** | 5-column Kanban (Backlog → Todo → In Progress → Review → Done) |
| **Project Overview** | CEO-generated, human-editable plans (summary, execution, hiring) |
| **Approval Gates** | Nothing executes without your approval |
| **Inbox Notifications** | New MRs, plan submissions, agent blockers, daily summaries |
| **Per-Agent Budgets** | USD caps with auto-throttle on exhaust |
| **Heartbeat Daemon** | Auto-processes approved tickets every 30s |
| **Ticket System** | Threaded work items with comments and goal ancestry |
| **Agent Memory** | Short-term + long-term + skills → persisted to Obsidian |
| **3-Level Config** | Global → Project → Agent cascade for skills, rules, MCP servers |
| **Cost Tracking** | Real Claude API token usage per agent, daily/weekly % of plan limit |
| **20 Agent Roles** | Engineering, Data & AI, Business — each with dedicated skills |
| **Env Var Management** | Per-project, encrypted, injected into agent execution |
| **Pixel Office** | Canvas 2D animated office with BFS pathfinding and heartbeat visuals |

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
```

### 4. Connect a Project

1. Open `http://localhost:5173`
2. Click **+ New Company** → enter project name
3. Paste Git repo URL (e.g. `https://github.com/org/project.git`)
4. Optionally add GitHub PAT for private repos
5. CEO agent reviews the repo → generates Project Overview
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
- Complete data isolation

---

## Navigation (16 Routes)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Master Dashboard | All projects with mini canvases, usage %, working/idle status |
| `/company/:id/overview` | Project Overview | Editable plans, hiring, env vars, comments |
| `/company/:id` | Office | Live pixel office + panels |
| `/company/:id/agents` | Agents | Hire (20 roles), configure, fire |
| `/company/:id/agents/:id` | Agent Detail | Memory, skills, sessions, configs |
| `/company/:id/goals` | Goals | Goal tree + delegation progress |
| `/company/:id/board` | Scrum Board | 5-column Kanban, sprints, velocity |
| `/company/:id/documents` | Documents | Obsidian vault browser |
| `/company/:id/costs` | Costs | Token usage, daily/weekly %, per-agent |
| `/company/:id/org-chart` | Org Chart | CEO → reports hierarchy |
| `/company/:id/settings` | Project Config | Repo, skills, MCP, rules, env vars |
| `/settings` | Global Settings | Connection status, config cascade |
| `/settings/skills` | Global Skills | Skill definitions |
| `/settings/mcp` | Global MCP | MCP server registry |
| `/settings/rules` | Global Rules | CLAUDE.md-style directives |

Plus: **Inbox** (bell icon) for notifications across all projects.

---

## Agent Roles (20)

### Engineering (7)
| Role | Model | Budget | Focus |
|------|-------|--------|-------|
| CEO | opus | $25 | Strategic delegation, goal decomposition |
| PM | sonnet | $15 | Requirements, specs, sprint planning |
| Frontend | sonnet | $15 | React 19, Tailwind, pixel art UI |
| Backend | sonnet | $15 | APIs, Supabase, database |
| DevOps | sonnet | $10 | CI/CD, Vercel, infrastructure |
| QA | haiku | $5 | Tests, validation, regressions |
| Full-Stack | sonnet | $12 | End-to-end features, TDD-first |

### Data & AI (5)
| Role | Model | Budget | Focus |
|------|-------|--------|-------|
| Data Architect | opus | $15 | Schemas, data modeling, migrations |
| Data Scientist | opus | $15 | ML pipelines, experiments, statistics |
| AI Engineer | opus | $20 | LLM integration, prompts, RAG, Agent SDK |
| Automation | sonnet | $10 | n8n workflows, ETL, webhooks |
| Scrum Master | haiku | $2 | Daily summaries, velocity, blockers |

### Business (8)
| Role | Model | Budget | Focus |
|------|-------|--------|-------|
| Marketer | sonnet | $10 | Growth, SEO, launches, ads |
| Content Writer | haiku | $5 | Copy, docs, blog, email |
| Sales | sonnet | $10 | Pricing, funnels, retention |
| Operations | haiku | $5 | SOPs, compliance, budgets |
| Data Analyst | sonnet | $10 | KPIs, cohort analysis, dashboards |
| Finance | sonnet | $5 | Financial models, P&L, forecasts |
| SEO | sonnet | $5 | Audits, keywords, link building |
| Growth | sonnet | $8 | A/B tests, referrals, churn |

---

## Skills Library

`brain/library/skills/` — 61 skill files across 15 role directories + shared:

```
_shared/ (5)          — quality-engineering, systematic-debugging, context7, tavily, git-worktree
ceo/ (4)              — strategic-delegation, business-reasoning, budget, team-orchestration
planner/ (4)          — discovery, project-planning, writing-plans, risk-assessment
frontend-designer/ (5)— ui-ux-pro-max, react, tailwind, canvas, tdd
backend/ (2)          — api-design, database
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
full-stack/ (2)       — end-to-end, rapid-prototyping
```

---

## Project Structure

```
ceo-simulator/
├── src/                          # React 19 frontend
│   ├── components/               # 25+ React components
│   │   ├── MasterDashboard.tsx   # Project grid with usage %, working/idle
│   │   ├── ProjectOverview.tsx   # Editable plans, hiring, env vars
│   │   ├── ScrumBoard.tsx        # 5-column Kanban with sprints
│   │   ├── MergeRequestsPanel.tsx# MR review with merge/reject
│   │   ├── InboxPanel.tsx        # Notification bell + dropdown
│   │   ├── CompanyDetail.tsx     # Pixel office + side panels
│   │   ├── PixelOfficeCanvas.tsx # Canvas 2D game loop
│   │   ├── CeoPlanFlow.tsx       # 4-step CEO goal workflow
│   │   ├── HireAgentDialog.tsx   # 20 roles, auto/manual hire
│   │   ├── ConfigManager.tsx     # 3-level config CRUD
│   │   └── ...
│   ├── engine/                   # Canvas renderer + pathfinding
│   ├── store/                    # Zustand state management
│   ├── lib/                      # Supabase + orchestrator API clients
│   └── hooks/                    # Realtime sync + polling
├── server/                       # Local orchestrator
│   ├── index.ts                  # Express API (50+ endpoints)
│   ├── ticketProcessor.ts        # Worktree → execute → commit → push → MR
│   ├── repoManager.ts            # Per-company Git repo management
│   ├── heartbeatDaemon.ts        # 30s auto-processor
│   ├── worktreeManager.ts        # Git worktree isolation
│   ├── memoryManager.ts          # Agent memory → Obsidian
│   └── agents/
│       ├── agentRunner.ts        # Universal runtime dispatcher
│       ├── claudeRunner.ts       # Claude Agent SDK
│       ├── httpRunner.ts         # HTTP endpoint agents
│       ├── bashRunner.ts         # Bash script agents
│       └── ceo.ts                # CEO reasoning + delegation
├── brain/                        # Obsidian vault
│   ├── library/
│   │   ├── skills/               # 61 skill files (15 role dirs + shared)
│   │   ├── agent-presets/        # 20 agent preset configs
│   │   ├── rules/                # 6 rule definitions
│   │   └── mcp-servers/          # 3 MCP server configs
│   ├── wiki/                     # Architecture specs
│   └── {project-name}/           # Per-project plans + docs
├── public/assets/                # Pixel art sprites, tiles, furniture
├── .company-repos/               # Cloned project repos (gitignored)
├── CLAUDE.md                     # Autonomy engine directives
└── vercel.json                   # SPA deployment config
```

---

## API Reference (50+ Endpoints)

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server status |
| `POST` | `/api/assign-goal` | CEO reasons + delegates |
| `POST` | `/api/process-queue` | Process next approved ticket |

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
| `PATCH` | `/api/tickets/:id/column` | Move ticket on board |

### Project Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/:id/plans` | List plans |
| `POST` | `/api/companies/:id/plans` | Create plan |
| `PATCH` | `/api/plans/:id` | Edit plan content |
| `POST` | `/api/plans/:id/approve` | Approve plan |
| `POST` | `/api/plans/:id/comments` | Add comment |

### Repository
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/companies/:id/repo` | Connect Git repo |
| `POST` | `/api/companies/:id/repo/sync` | Pull latest |
| `DELETE` | `/api/companies/:id/repo` | Disconnect repo |

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hire-agent` | Create agent (20 roles) |
| `DELETE` | `/api/agents/:id` | Fire agent |
| `PATCH` | `/api/agents/:id/lifecycle` | Pause/resume/throttle |
| `PATCH` | `/api/agents/:id/budget` | Adjust budget |
| `POST` | `/api/agents/:id/inject-skill` | Add skill at runtime |

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
npm run dev        # Frontend (Vite :5173)
npm run server     # Orchestrator + heartbeat daemon (:3001)
npm run build      # Production build
npm run test       # 36 vitest tests
```

---

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand
- **Canvas:** 2D pixel-art office, BFS pathfinding, sprite animation
- **Backend:** Supabase (PostgreSQL + Realtime + RLS)
- **Orchestrator:** Express + @anthropic-ai/claude-agent-sdk
- **Deployment:** Vercel (frontend) + local server (orchestrator)
- **Brain:** Obsidian vault for specs, plans, agent memory

---

## License

MIT
