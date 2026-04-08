# CEO Simulator — Zero-Human Software Factory

A **Paperclip-style AI agent orchestration platform** where you manage autonomous Claude Code agents through a pixel-art dashboard. Assign high-level business goals, and AI agents delegate, code, test, and deploy — while you watch them work in a real-time animated office.

**Live Demo:** [ceo-simulator-iota.vercel.app](https://ceo-simulator-iota.vercel.app)

---

## What This Tool Does

CEO Simulator is the **control plane for a Zero-Human Software Factory**. Instead of managing individual pull requests, you direct high-level business goals. The system handles everything else:

1. **You assign a goal** → "Build a habit tracker app"
2. **CEO agent reasons** → Claude analyzes the goal, creates a delegation plan
3. **Workers execute** → PM writes specs, Frontend builds UI, Backend builds APIs, QA tests
4. **You approve/reject** → Review tickets before agents execute (or enable auto-approve)
5. **Agents remember** → Skills learned, memory persisted to Obsidian vault, costs tracked

### Key Features (14/14 Paperclip Parity)

| Feature | Description |
|---------|-------------|
| **Agent-Agnostic** | Hire Claude, HTTP endpoints, Bash scripts, or custom runtimes |
| **Heartbeat Daemon** | Auto-processes approved tickets every 30s |
| **Ticket System** | Threaded work items with comments, goal ancestry |
| **Approval Gates** | Human reviews before agent execution |
| **Per-Agent Budgets** | $USD caps with auto-throttle on exhaust |
| **Atomic Task Claim** | Postgres `FOR UPDATE SKIP LOCKED` — zero race conditions |
| **Goal Ancestry** | Full context chain: CEO goal → delegation → subtask |
| **Audit Trail** | Every tool call, approval, budget check logged |
| **Agent Memory** | Short-term + long-term + skills → Obsidian files |
| **Skill Injection** | Add skills to agents at runtime |
| **Multi-Company** | Run multiple projects from one dashboard |
| **Org Charts** | Visual CEO → reports hierarchy |
| **Cost Tracking** | Real Claude API token usage per agent |
| **3-Level Config** | Global → Project → Agent cascade for skills, rules, MCP |

---

## Quick Start (New Project)

### Prerequisites
- Node.js 20+
- npm
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
# Copy the example env file
cp .env.example .env

# Edit .env with your Supabase credentials:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Configure server env
cp .env.example server/.env
# Edit server/.env:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Set Up Supabase Database

Run the migrations in order from the Supabase Dashboard SQL Editor, or use the Supabase MCP tool. The schema creates 12 tables: `companies`, `agents`, `goals`, `delegations`, `activity_log`, `agent_sessions`, `task_queue`, `token_usage`, `configs`, `tickets`, `ticket_comments`, `audit_log`.

### 4. Start the Dashboard

```bash
# Terminal 1: Start the frontend
npm run dev
# → http://localhost:5173

# Terminal 2: Start the orchestrator (for real Claude agents)
npm run server
# → http://localhost:3001 (heartbeat daemon auto-starts)
```

### 5. Use It

1. Open `http://localhost:5173`
2. Click a company (Acme Corp / Globex Inc are pre-seeded)
3. Assign a goal in the **CEO Directive** panel
4. If orchestrator is running → CEO calls Claude, creates tickets
5. **Approve** tickets in the Approval Panel
6. Watch agents work in the pixel office!

---

## Continue From an Existing GitHub Project

To manage an **existing codebase** with CEO Simulator:

### 1. Clone both repos

```bash
git clone https://github.com/your-org/your-project.git
cd your-project

git clone https://github.com/desoul1412/ceo-simulator.git ../ceo-simulator
cd ../ceo-simulator && npm install
```

### 2. Point the orchestrator at your project

Start the server from your project directory:
```bash
cd /path/to/your-project
npx tsx /path/to/ceo-simulator/server/index.ts
```

Or set `PROJECT_CWD` in `server/.env`.

### 3. Create a company for your project

1. Dashboard → **+ New Company** → enter project name + budget
2. **Hire agents** (Quick Hire picks optimal defaults per role)
3. Assign goals → agents read your codebase, write code in git worktrees, run tests

The agents work inside your existing repo — not the CEO Simulator repo.

---

## Architecture

```
┌─ React Dashboard (Vercel) ──────────────────────────┐
│ Pixel office canvas + goal panel + activity feed     │
│ Reads from Supabase Realtime (auto-updates)          │
└──────────────────────┬───────────────────────────────┘
                       │
┌─ Supabase ───────────┴───────────────────────────────┐
│ PostgreSQL + Realtime + Row Level Security            │
│ 12 tables: companies, agents, tickets, configs...    │
└──────────────────────┬───────────────────────────────┘
                       │
┌─ Local Orchestrator ─┴───────────────────────────────┐
│ Express on :3001 + Claude Agent SDK                   │
│ Heartbeat daemon (30s) → auto-processes tickets       │
│ Runtimes: Claude SDK | HTTP endpoints | Bash scripts  │
└──────────────────────────────────────────────────────┘
```

**Stack:** React 19 + TypeScript + Vite + Tailwind v4 + Zustand + Supabase + Claude Agent SDK

---

## Configuration Library

Reusable templates in `brain/library/` — import when creating agents or configuring projects.

### Skills (`brain/library/skills/`)
React Development, TypeScript, API Design, TDD, Documentation, DevOps/CI, Database, CSS/Tailwind

### Rules (`brain/library/rules/`)
TDD Circuit Breaker, MCP Fallback, Pre-Flight Docs, Post-Flight Update, No Hallucination, Git Worktree Isolation

### MCP Servers (`brain/library/mcp-servers/`)
Tavily (web search), Context7 (API docs), Supabase (database ops)

### Agent Presets (`brain/library/agent-presets/`)
Frontend Developer, Backend Developer, Project Manager, DevOps Engineer, QA Engineer

---

## Navigation (14 Routes)

| Route | Page |
|-------|------|
| `/` | Master Dashboard — all companies with mini canvases |
| `/company/:id` | Office — live pixel office + panels |
| `/company/:id/agents` | Agents — hire/configure |
| `/company/:id/agents/:id` | Agent Detail — memory, skills, sessions |
| `/company/:id/goals` | Goals — tree + delegation progress |
| `/company/:id/documents` | Documents — Obsidian vault browser |
| `/company/:id/costs` | Costs — token usage analytics |
| `/company/:id/org-chart` | Org Chart — hierarchy |
| `/company/:id/settings` | Project Config — override globals |
| `/settings` | Global Settings |
| `/settings/skills` | Global Skills |
| `/settings/mcp` | Global MCP Servers |
| `/settings/rules` | Global Rules |

---

## Scripts

```bash
npm run dev        # Frontend dev server (:5173)
npm run server     # Orchestrator + heartbeat daemon (:3001)
npm run build      # Production build
npm run test       # 39 vitest tests
```

---

## License

MIT
