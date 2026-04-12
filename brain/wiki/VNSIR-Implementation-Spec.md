---
tags: [vnsir, spec]
date: 2026-04-12
status: active
---

# VNSIR Implementation Spec

**VNSIR** — **V**irtual **N**avigation **S**imulation **I**nterface **R**efactor

Linked from: [[00-Index]]  
Related: [[Office-Simulator-Architecture]], [[Auth-System-Spec]], [[Migration-Spec]], [[UI-Design-System]]

> **Spec version:** 1.0  
> **Author:** liam-chen (Project Manager)  
> **Date:** 2026-04-12  
> **Scope:** Full page/route inventory for CEO Simulator v3 frontend — React Router, component mapping, per-page acceptance criteria, and data flow diagrams.

---

## 1. Overview

VNSIR is the codename for the **complete frontend navigation and page architecture** of CEO Simulator v3. It defines:

- Every route, its URL pattern, and the component(s) it renders
- Per-page acceptance criteria (functional, visual, and data requirements)
- Data flow between Zustand store, Supabase/OrchestratorAPI, and React components
- Layout shell responsibilities (`AppLayout`, `NavBar`)

### Why This Spec Exists

The router (`src/router.tsx`) currently has **14 routes across 13 distinct views**. Several pages were built iteratively without a unified contract. This spec establishes the canonical definition so that:

1. Any agent can build/fix a page without guessing expected behavior
2. QA has explicit pass/fail criteria per page
3. Data flow is unambiguous — no silent API assumptions
4. Auth integration ([[Auth-System-Spec]]) has clear injection points per route

### Scope Boundary

| In Scope | Out of Scope |
|----------|-------------|
| All 14 routes in `src/router.tsx` | Canvas game-loop internals (see [[Office-Simulator-Architecture]]) |
| Per-page ACs and data flows | Server-side daemon logic (`heartbeatDaemon.ts`) |
| `AppLayout` shell + `NavBar` | Supabase schema (see [[Migration-Spec]]) |
| Auth guard injection points | RLS policy implementation (see [[Auth-System-Spec]]) |

---

## 2. Page Inventory

Complete route table as of 2026-04-12. Source of truth: `src/router.tsx`.

| # | Route Pattern | Component | Parent Layout | Auth Required |
|---|--------------|-----------|---------------|---------------|
| P-01 | `/` | `<MasterDashboard />` | `<AppLayout />` | ✅ Yes |
| P-02 | `/company/:companyId` | `<CompanyView />` → `<CompanyDetail />` | `<AppLayout />` | ✅ Yes |
| P-03 | `/company/:companyId/agents` | `<CompanyView />` (agents tab) | `<AppLayout />` | ✅ Yes |
| P-04 | `/company/:companyId/agents/:agentId` | `<AgentDetail />` | `<AppLayout />` | ✅ Yes |
| P-05 | `/company/:companyId/goals` | `<GoalsPage />` | `<AppLayout />` | ✅ Yes |
| P-06 | `/company/:companyId/documents` | `<DocumentsPage />` | `<AppLayout />` | ✅ Yes |
| P-07 | `/company/:companyId/costs` | `<CostsPage />` | `<AppLayout />` | ✅ Yes |
| P-08 | `/company/:companyId/org-chart` | `<OrgChartPage />` | `<AppLayout />` | ✅ Yes |
| P-09 | `/company/:companyId/board` | `<ScrumBoard />` | `<AppLayout />` | ✅ Yes |
| P-10 | `/company/:companyId/merge-requests` | `<MergeRequestsPage />` | `<AppLayout />` | ✅ Yes |
| P-11 | `/company/:companyId/overview` | `<ProjectOverview />` | `<AppLayout />` | ✅ Yes |
| P-12 | `/company/:companyId/settings` | `<ProjectSettings />` | `<AppLayout />` | ✅ Yes |
| P-13 | `/settings` | `<SettingsPage />` | `<AppLayout />` | ✅ Yes |
| P-14 | `/settings/:tab` | `<SettingsPage />` (deep-link tab) | `<AppLayout />` | ✅ Yes |

> **Note:** Auth guard injection is pending [[Auth-System-Spec]] implementation. Until then, all routes are publicly accessible. Once auth ships, all `company/:companyId` routes must validate `company.owner_id === session.user.id` before rendering.

---

## 3. Layout Shell

### 3.1 `<AppLayout />`

**File:** `src/components/AppLayout.tsx`

The root shell wrapping every route. Renders `<NavBar />` at the top and `<Outlet />` for child routes.

**Acceptance Criteria:**

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| AL-01 | Shell always renders | `<NavBar />` is visible on every route |
| AL-02 | Outlet renders child | Active route component occupies the content area below NavBar |
| AL-03 | Full viewport height | Layout fills 100vh with no vertical overflow on the shell itself |
| AL-04 | HUD design system | Background is `#0d1117`, font-family is `var(--font-hud)` |
| AL-05 | No layout shift on route change | NavBar position is stable; only `<Outlet />` area transitions |

### 3.2 `<NavBar />`

**File:** `src/components/NavBar.tsx`

Top navigation bar. Shows global logo/brand + company-context tabs when inside `/company/:companyId/*`.

**Acceptance Criteria:**

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| NB-01 | Brand mark visible | "CEO.SIM" or logo renders left-aligned at all times |
| NB-02 | Company tabs render | When on `/company/:companyId/*`, tabs for Overview / Agents / Goals / Board / Costs / Org Chart / Docs / MRs / Settings are rendered |
| NB-03 | Active tab highlighted | Current route's tab has distinct active color (`var(--hud-accent)` or equivalent) |
| NB-04 | Dashboard link | Clicking the brand mark navigates to `/` |
| NB-05 | Tab navigation works | Clicking each tab navigates to the correct `/company/:companyId/<section>` route |
| NB-06 | No tabs on `/settings` | Global settings route hides company-context tabs |
| NB-07 | Responsive collapse | On viewport < 768px, tabs collapse to a hamburger menu or horizontal scroll |

---

## 4. Page Specifications & Acceptance Criteria

---

### P-01 — Master Dashboard (`/`)

**Component:** `<MasterDashboard />`  
**Purpose:** Global company grid. CEO sees all managed companies as pixel-art tiles with live mini canvases.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| MD-01 | Company grid renders | All companies from `dashboardStore.companies` appear as `<CompanyTile />` cards |
| MD-02 | Mini canvas per tile | Each tile renders a scaled-down `<PixelOfficeCanvas />` showing the office in real-time |
| MD-03 | Agent status indicator | Live dot shows green (`#00ff88`) if any agent is `working`/`meeting`, grey if all idle |
| MD-04 | Budget bar | Daily budget percentage bar rendered with color: green < 50%, orange 50–80%, red > 80% |
| MD-05 | Company name display | Company name shown in uppercase with HUD font |
| MD-06 | Click → CompanyView | Clicking a tile navigates to `/company/:companyId` |
| MD-07 | Create company CTA | "+ New Company" button is visible and functional |
| MD-08 | Empty state | If `companies.length === 0`, renders an empty-state prompt (not blank page) |
| MD-09 | Offline fallback | If Supabase is offline, Zustand in-memory companies still render |
| MD-10 | Grid layout | Tiles display in a responsive grid (min 2 cols desktop, 1 col mobile) |

---

### P-02 — Company View / Detail (`/company/:companyId`)

**Component:** `<CompanyView />` → `<CompanyDetail />`  
**Purpose:** Primary per-company workspace. Pixel office canvas + goal panel + activity feed + budget HUD.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| CV-01 | Company resolves | `companyId` param is looked up in `dashboardStore.companies`; renders "Company not found" if missing |
| CV-02 | Pixel office renders | `<PixelOfficeCanvas />` renders the company's `officeLayout` at full size (~600×400px) |
| CV-03 | Goal panel visible | `<CeoGoalPanel />` or equivalent shows active goals and delegation tree |
| CV-04 | Activity feed live | `<ActivityFeed />` shows real-time `activity_log` entries from Supabase Realtime |
| CV-05 | Budget HUD | Budget spent vs. total visible with progress bar |
| CV-06 | Agents tab | Route `/company/:companyId/agents` renders the same layout with agents tab active |
| CV-07 | Approval panel | Pending tickets with `awaiting_approval` status shown in `<ApprovalPanel />` |
| CV-08 | Not found graceful | Missing `companyId` returns a styled "Company not found" message, not a crash |

---

### P-03 — Company Agents Tab (`/company/:companyId/agents`)

**Component:** `<CompanyView />` (agents tab active)  
**Purpose:** View and hire/fire agents for the selected company.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| AG-01 | Agent card grid | All `company.employees` render as `<AgentCard />` cards |
| AG-02 | Card shows role/status | Each card displays: name, role, status, monthly cost |
| AG-03 | Status badge | Status badge uses color coding: `working`=green, `idle`=grey, `blocked`=red, `offline`=dim |
| AG-04 | Hire button visible | "Hire Agent" button opens `<HireAgentDialog />` |
| AG-05 | Hire dialog functional | Dialog submits `POST /api/companies/:id/agents`; new agent appears in grid without page reload |
| AG-06 | Agent name clickable | Clicking an agent navigates to `/company/:companyId/agents/:agentId` |
| AG-07 | Budget per agent | Monthly cost is shown; total burn rate is visible somewhere on page |
| AG-08 | Empty state | If no agents, shows "No agents hired yet" with hire CTA |

---

### P-04 — Agent Detail (`/company/:companyId/agents/:agentId`)

**Component:** `<AgentDetail />`  
**Purpose:** Deep configuration + lifecycle management for a single agent.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| AD-01 | Agent resolves | `agentId` param resolves against store; "Agent not found" if missing |
| AD-02 | Config panel | Name, role, skills, permissions editable and patchable via `PATCH /api/agents/:id` |
| AD-03 | Budget panel | `budget_spent` and `budget_limit` displayed; `budget_limit` editable |
| AD-04 | Activity log | Individual agent's `activity_log` entries (filtered by `agent_id`) visible |
| AD-05 | Lifecycle controls | Buttons for Pause / Resume / Throttle / Terminate; calls `PATCH /api/agents/:id/status` |
| AD-06 | Lifecycle status badge | Current `lifecycle_status` displayed: `active`, `paused`, `throttled`, `terminated` |
| AD-07 | Session context | `active_session_id` (if present) shown for debugging |
| AD-08 | Inject skill button | "Inject Skill" button calls `POST /api/agents/:id/inject-skill` with skill text input |
| AD-09 | Back navigation | Breadcrumb or back button returns to `/company/:companyId/agents` |

---

### P-05 — Goals Page (`/company/:companyId/goals`)

**Component:** `<GoalsPage />`  
**Purpose:** Hierarchical goal tree — create, edit, assign, track delegation and progress.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| GL-01 | Goal tree renders | Goals from `goals` table for this company rendered as a hierarchy |
| GL-02 | Progress shown | Each goal shows a progress bar (0–100%) |
| GL-03 | Status badges | `pending`, `in-progress`, `completed`, `blocked` shown with distinct colors |
| GL-04 | Goal creation | "+ New Goal" opens a form; `POST /api/companies/:id/goals` on submit |
| GL-05 | Assignment visible | Goal's `assignedTo` agent name shown |
| GL-06 | Delegation visible | `delegatedTo` agent names shown as sub-items or badges |
| GL-07 | Parent–child indentation | Child goals visually indented under parent goal |
| GL-08 | Edit goal | Clicking a goal opens edit modal; `PATCH /api/goals/:id` on save |
| GL-09 | Empty state | If no goals, prompts CEO to create the first goal |

---

### P-06 — Documents Page (`/company/:companyId/documents`)

**Component:** `<DocumentsPage />`  
**Purpose:** Browse the company's `brain/` Obsidian vault — files, specs, changelogs.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| DC-01 | File tree renders | Directory listing from `brain/` path returned by API |
| DC-02 | Markdown rendering | Selecting a `.md` file renders its content with basic Markdown formatting |
| DC-03 | Wikilink display | `[[WikiLink]]` syntax shown as styled links (navigation optional in v1) |
| DC-04 | Loading state | Spinner while file content loads |
| DC-05 | Error state | If vault unavailable, shows "Brain vault offline" message |
| DC-06 | Shell-only fallback | If API not yet implemented, page renders "Documents — Coming Soon" rather than crashing |

---

### P-07 — Costs Page (`/company/:companyId/costs`)

**Component:** `<CostsPage />`  
**Purpose:** Budget analytics — per-agent spend, total burn rate, token usage history.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| CS-01 | Total budget display | Company `budget` and `budgetSpent` shown at the top |
| CS-02 | Per-agent breakdown | Each agent's `budget_spent` shown; sorted by spend (desc) |
| CS-03 | Burn rate | Daily/weekly estimated burn rate calculated and displayed |
| CS-04 | Token usage table | Recent rows from `token_usage` table shown: `agent, model, input_tokens, output_tokens, cost_usd` |
| CS-05 | Budget bar | Horizontal progress bar: spent / total with color thresholds |
| CS-06 | Budget cap indicator | Per-agent budget limit (if set) shown alongside actual spend |
| CS-07 | Time filter | Filter token usage by: Today / 7 Days / 30 Days |
| CS-08 | Export placeholder | "Export CSV" button present (may be stub in v1) |

---

### P-08 — Org Chart (`/company/:companyId/org-chart`)

**Component:** `<OrgChartPage />`  
**Purpose:** Visual org hierarchy — CEO at root, reports branching down.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| OC-01 | Hierarchy renders | Agents organized by `reportsTo` chain; CEO at top |
| OC-02 | Nodes show role | Each node shows agent name + role badge |
| OC-03 | Status on node | Agent `status` shown as colored dot on each node |
| OC-04 | Edges between nodes | Visual lines/arrows connect manager → direct reports |
| OC-05 | Click → AgentDetail | Clicking a node navigates to `/company/:companyId/agents/:agentId` |
| OC-06 | Responsive layout | Chart is horizontally scrollable if wider than viewport |
| OC-07 | Empty state | If only 1 agent (CEO), renders single root node with "Hire reports" prompt |

---

### P-09 — Scrum Board (`/company/:companyId/board`)

**Component:** `<ScrumBoard />`  
**Purpose:** Kanban board for the active sprint — ticket columns: Todo / In Progress / Review / Done.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| SB-01 | Four columns render | `todo`, `in_progress`, `review`, `done` columns all visible |
| SB-02 | Tickets load | `fetchTickets(companyId)` called on mount; tickets displayed in correct column per `board_column` |
| SB-03 | Sprint selector | Current sprint shown; completed sprint can be marked done |
| SB-04 | Ticket card shows title | Each `<TicketCard />` displays ticket title, priority, and assigned agent |
| SB-05 | Approval workflow | Tickets with `awaiting_approval` status show Approve / Reject buttons |
| SB-06 | Approve all button | "Approve All" button calls `approveAllTickets(companyId)` |
| SB-07 | Column drag (stretch) | Cards may be dragged between columns (v2 stretch goal) |
| SB-08 | Story points visible | `story_points` shown on ticket card if set |
| SB-09 | Complete sprint | "Complete Sprint" button calls `completeSprint(sprintId)` and triggers next sprint |
| SB-10 | Loading skeleton | Skeleton cards shown while `fetchTickets` resolves |
| SB-11 | Empty column state | Columns with no tickets show "No items" placeholder (not blank) |

---

### P-10 — Merge Requests (`/company/:companyId/merge-requests`)

**Component:** `<MergeRequestsPage />`  
**Purpose:** Git branch review — list open/merged/rejected MRs, view diffs, approve/reject.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| MR-01 | MR list loads | `merge_requests` fetched for `companyId`; shown in list |
| MR-02 | Status filter | Tabs or filter for `open`, `merged`, `rejected` |
| MR-03 | MR card details | Each MR shows: title, branch, author agent, `additions`, `deletions`, `files_changed` |
| MR-04 | Status badge | `open` = yellow, `merged` = green, `rejected` = red |
| MR-05 | Approve/Reject | Buttons on open MRs; call `PATCH /api/merge-requests/:id` |
| MR-06 | Diff preview | Expandable diff text or linked diff for each MR |
| MR-07 | Empty state | If no MRs, shows "No merge requests yet" |

---

### P-11 — Project Overview (`/company/:companyId/overview`)

**Component:** `<ProjectOverview />`  
**Purpose:** AI-generated plans hub — Master Plan, Hiring Plan, Daily Plan — plus env var management.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| PO-01 | Plans load | `fetchPlans(companyId)` on mount; plans displayed by `type` |
| PO-02 | Plan type tabs | Tabs for `Summary`, `Master Plan`, `Hiring Plan`, `Initial Tasks` |
| PO-03 | Plan content | Selected plan's Markdown `content` rendered |
| PO-04 | Approve plan | "Approve" button on pending plans; calls `approvePlan(planId)` |
| PO-05 | Plan comments | Comments thread shown below plan; `addPlanComment()` form visible |
| PO-06 | Env vars section | List of `project_env_vars` for company; Add / Delete supported |
| PO-07 | Secret masking | `is_secret = true` env vars show `••••••••` with reveal toggle |
| PO-08 | Add env var | Form: key + value + secret flag; `createEnvVar()` on submit |
| PO-09 | Delete env var | Delete icon; `deleteEnvVar()` on confirm |
| PO-10 | Hire agent shortcut | "Hire Agent" button triggers `hireAgent()` from the overview context |

---

### P-12 — Project Settings (`/company/:companyId/settings`)

**Component:** `<ProjectSettings />`  
**Purpose:** Per-company configuration — name, budget cap, repo URL, agent defaults.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| PS-01 | Company fields | Name, `budget`, `repo_url`, `brain_summary` editable |
| PS-02 | Save persists | `PATCH /api/companies/:id` on save; store updated optimistically |
| PS-03 | Danger zone | "Delete Company" action is present, requires confirmation dialog |
| PS-04 | Status toggle | Company `status` (`active`/`paused`) can be toggled |
| PS-05 | Config entries | `configs` table entries (global/company scope) can be viewed/edited |
| PS-06 | Validation | Budget must be a positive number; form shows inline error on invalid input |

---

### P-13 & P-14 — Global Settings (`/settings`, `/settings/:tab`)

**Component:** `<SettingsPage />`  
**Purpose:** Global application settings — General, Skills, MCP Servers, Rules.

#### Acceptance Criteria

| ID | Criterion | Pass Condition |
|----|-----------|----------------|
| GS-01 | Four tabs | `General`, `Skills`, `MCP`, `Rules` tabs all render |
| GS-02 | Deep-link tab | `/settings/skills` activates the Skills tab directly |
| GS-03 | Default tab | `/settings` with no `:tab` defaults to `General` tab |
| GS-04 | General tab | Global preferences: API keys (masked), theme, default model |
| GS-05 | Skills tab | Library of installed skill files; add/remove skill entries |
| GS-06 | MCP tab | MCP server list; connection status indicators; add/remove servers |
| GS-07 | Rules tab | Global agent rules / system prompts editable |
| GS-08 | Persist on save | Settings saved to `configs` table (`scope: global`) |
| GS-09 | No company context | NavBar shows no company-specific tabs on this route |

---

## 5. Data Flow Diagrams

### 5.1 Global State Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   React Router v6                         │   │
│  │  <RouterProvider router={router} />                       │   │
│  │       │                                                   │   │
│  │  <AppLayout />  ←── wraps ALL routes                     │   │
│  │       ├── <NavBar />       (reads: selectedCompany)       │   │
│  │       └── <Outlet />       (renders: active page)        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Zustand — dashboardStore                     │   │
│  │                                                          │   │
│  │  companies: Company[]          (hydrated from Supabase)   │   │
│  │  selectedCompanyId: string     (set on navigation)       │   │
│  │                                                          │   │
│  │  READS ──→ MasterDashboard, CompanyView, NavBar          │   │
│  │  WRITES ←─ hireAgent, createGoal, updateAgentStatus      │   │
│  └────────────────────────────────┬─────────────────────────┘   │
│                                   │                              │
│           ┌───────────────────────┼───────────────────┐         │
│           ▼                       ▼                   ▼         │
│   ┌──────────────┐      ┌──────────────────┐  ┌────────────┐   │
│   │  Supabase    │      │  OrchestratorAPI │  │  LocalState│   │
│   │  Client      │      │  (Express /api)  │  │  (useState)│   │
│   │              │      │                  │  │            │   │
│   │  Realtime ──→│      │  tickets, plans, │  │ ScrumBoard │   │
│   │  activity_log│      │  agents, mergeRQs│  │ ProjectOvw │   │
│   │  agents      │      │  env vars, goals │  │            │   │
│   └──────────────┘      └──────────────────┘  └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Master Dashboard — Data Flow

```
User opens "/"
       │
       ▼
<MasterDashboard />
       │
       ├── useDashboardStore(s => s.companies)
       │        │
       │        └── Zustand store ──► Supabase: SELECT * FROM companies
       │                              (initial hydration on app mount)
       │
       ├── For each company → <CompanyTile company={c} />
       │        │
       │        ├── Renders: <PixelOfficeCanvas company={c} />  (60fps game loop)
       │        ├── Computes: budgetPct = budgetSpent / DAILY_CAP × 100
       │        └── onClick: navigate(`/company/${c.id}`)
       │
       └── Supabase Realtime subscription (useRealtimeSync)
                └── on INSERT/UPDATE companies/agents → update Zustand store
                    → CompanyTile re-renders with new status
```

---

### 5.3 Company View — Data Flow

```
User navigates "/company/:companyId"
       │
       ▼
<CompanyView />
       │
       ├── useParams() → companyId
       ├── useDashboardStore(s => s.companies).find(c => c.id === companyId)
       │
       └── company found → <CompanyDetail company={c} />
                │
                ├── <PixelOfficeCanvas />     ← reads company.officeLayout + employees
                │        └── game loop: BFS pathfinding, sprite animation, 60fps render
                │
                ├── <CeoGoalPanel />          ← reads company.goals
                │        └── POST /api/companies/:id/goals (assign new goal)
                │
                ├── <ActivityFeed />          ← Realtime: activity_log WHERE company_id=X
                │        └── Supabase Realtime subscription → append entries live
                │
                ├── <ApprovalPanel />         ← GET /api/companies/:id/tickets?status=awaiting_approval
                │        └── POST /api/tickets/:id/approve | reject
                │
                └── <BudgetHud />             ← reads company.budget + company.budgetSpent
```

---

### 5.4 Scrum Board — Data Flow

```
User navigates "/company/:companyId/board"
       │
       ▼
<ScrumBoard />
       │
       ├── useEffect → fetchTickets(companyId)    GET /api/companies/:id/tickets
       │                    └── returns Ticket[]
       │
       ├── useEffect → fetchSprints(companyId)    GET /api/companies/:id/sprints
       │                    └── returns Sprint[]
       │
       ├── Derive: ticketsByColumn = group(tickets, t => t.board_column)
       │
       ├── Render: 4 columns × filtered tickets
       │        each ticket card:
       │           ├── title, priority, story_points
       │           ├── assignedAgent name (resolved from employees list)
       │           └── if status=awaiting_approval → <ApproveBtn> / <RejectBtn>
       │
       ├── "Approve All" → approveAllTickets(companyId)  POST /api/companies/:id/approve-all
       └── "Complete Sprint" → completeSprint(sprintId)  PATCH /api/sprints/:id/complete
                                    └── triggers: next sprint auto-created by daemon
```

---

### 5.5 Project Overview (Plans + Env Vars) — Data Flow

```
User navigates "/company/:companyId/overview"
       │
       ▼
<ProjectOverview />
       │
       ├── fetchPlans(companyId)            GET /api/companies/:id/plans
       │        └── Plan[] { id, type, title, content, status }
       │
       ├── fetchEnvVars(companyId)          GET /api/companies/:id/env-vars
       │        └── EnvVar[] { id, key, value, is_secret }
       │
       ├── Plan Tabs: Summary | Master Plan | Hiring Plan | Initial Tasks
       │        └── selected plan.content rendered as Markdown
       │        └── "Approve" → approvePlan(planId)  POST /api/plans/:id/approve
       │                          └── triggers: auto-hire agents per hiring_plan
       │
       ├── Plan Comments
       │        └── fetchPlanComments(planId)         GET /api/plans/:id/comments
       │        └── addPlanComment(planId, content)   POST /api/plans/:id/comments
       │
       └── Env Vars
                ├── list: EnvVar[] with is_secret masking
                ├── createEnvVar(companyId, key, value, is_secret)
                │        └── POST /api/companies/:id/env-vars
                └── deleteEnvVar(envVarId)
                         └── DELETE /api/env-vars/:id
```

---

### 5.6 Agent Detail — Lifecycle State Machine

```
                       ┌─────────┐
                       │ active  │◄────────────────────────┐
                       └────┬────┘                         │
                            │                              │
               ┌────────────┼────────────┐                 │
               ▼            ▼            ▼                 │
          ┌─────────┐  ┌──────────┐ ┌───────────┐         │
          │ paused  │  │throttled │ │terminated │         │
          └────┬────┘  └────┬─────┘ └───────────┘         │
               │            │                              │
               └────────────┴──── resume ─────────────────┘

PATCH /api/agents/:id/status
  body: { lifecycle_status: 'paused' | 'active' | 'throttled' | 'terminated' }

Ticket processor behaviour:
  paused      → skip all tasks for this agent
  throttled   → skip tasks only if budget_spent >= budget_limit × 0.95
  terminated  → skip all tasks; agent hidden from active rosters
  active      → normal execution
```

---

### 5.7 Auth Guard Data Flow (Post Auth-System-Spec Implementation)

```
Any route under /company/:companyId/*
       │
       ▼
<AuthGuard companyId={companyId}>
       │
       ├── Read: sessionStore.user (JWT decoded)
       │
       ├── if !user → redirect to /login
       │
       ├── GET /api/companies/:companyId
       │        └── server: SELECT * FROM companies WHERE id=? AND owner_id=jwt.sub
       │
       ├── if company.owner_id !== user.id → render <ForbiddenPage />
       │
       └── else → render <Outlet /> (child route content)
```

---

## 6. User Stories (VNSIR Backlog)

These user stories cover gaps identified against the current implementation.

### Sprint 1 — Page Completeness

| ID | Story | AC Link | Priority |
|----|-------|---------|----------|
| V-01 | As CEO, I want the Documents page to display my brain vault files so I can browse specs without leaving the app | DC-01 to DC-06 | HIGH |
| V-02 | As CEO, I want the Org Chart to show real-time agent status dots so I can tell at a glance who is working | OC-01 to OC-07 | HIGH |
| V-03 | As CEO, I want per-agent budget bars on the Costs page so I can spot overspending agents immediately | CS-01 to CS-08 | HIGH |
| V-04 | As CEO, I want deep-link tab navigation on the Settings page so I can bookmark `/settings/skills` | GS-02, GS-03 | MEDIUM |
| V-05 | As CEO, I want the empty-state screens on all pages to have contextual CTAs rather than blank white space | MD-08, AG-08, GL-09, SB-11, MR-07 | MEDIUM |

### Sprint 2 — Data Integrity

| ID | Story | AC Link | Priority |
|----|-------|---------|----------|
| V-06 | As CEO, I want ticket column changes on the board to persist immediately so re-loading doesn't reset work | SB-02 | HIGH |
| V-07 | As CEO, I want plan approvals to trigger automatic agent hiring per hiring_plan content | PO-04, PO-10 | HIGH |
| V-08 | As CEO, I want Merge Request diffs to show line-by-line changes so I can review code before approving | MR-06 | MEDIUM |
| V-09 | As CEO, I want secret env vars to be masked by default with a reveal toggle so secrets don't leak in screenshots | PO-07 | HIGH |

### Sprint 3 — Auth Integration

| ID | Story | AC Link | Priority |
|----|-------|---------|----------|
| V-10 | As CEO, I want all company pages to be locked to my account so other users can't see my companies | Section 5.7 | CRITICAL |
| V-11 | As CEO, I want to be redirected to `/login` when my JWT expires so I'm not shown a broken API error | Section 5.7 | CRITICAL |

---

## 7. Open Questions & Risks

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-01 | Does `DocumentsPage` need a backend endpoint to read `brain/` files, or does it use the same vault that agents write to? | dev-sharma | OPEN — avoid editing `DocumentsPage.tsx` until resolved |
| Q-02 | Should `/company/:companyId` and `/company/:companyId/agents` remain the same component (`CompanyView` → `CompanyDetail`) or be split? | liam-chen | OPEN — current implementation reuses component; may cause tab confusion |
| Q-03 | When Auth ships, should `MasterDashboard` filter `companies` by `owner_id` client-side (from store) or always re-query server with auth header? | auth team | BLOCKED on [[Auth-System-Spec]] implementation |
| Q-04 | Is the `ScrumBoard` drag-and-drop a v1 requirement or stretch goal? | CEO | OPEN — currently listed as stretch (SB-07) |

---

## 8. Change Log (Spec)

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-04-12 | liam-chen | Initial spec — full page inventory, ACs, data flow diagrams |
