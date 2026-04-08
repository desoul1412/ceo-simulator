---
tags: [architecture, simulation, react, canvas, pixel-art, paperclip]
date: 2026-04-08
status: active
---

# Office Simulator — Architecture (v3 — Paperclip + Pixel Agents Hybrid)

Linked from: [[00-Index]]
Design system: [[UI-Design-System]]
References: [Paperclip](https://github.com/paperclipai/paperclip), [Pixel Agents](https://github.com/pablodelucca/pixel-agents)

---

## Vision

A **Paperclip-style management dashboard** where each company has a **Pixel Agents-style Canvas 2D office** that visualizes agent activity in real time. The pixel office is a *panel inside* the management UI — not the UI itself.

**Paperclip gives us:** Companies, agents (hire/fire/configure), goals (assign to CEO → cascade delegation), budgets with spend tracking, org charts, approvals, activity feeds, agent heartbeats.

**Pixel Agents gives us:** Canvas 2D rendering, tile-based office floors (64×64 max grid), BFS pathfinding for character movement, sprite sheet animations (typing/reading/idle/walking), speech bubbles, interactive character selection, persistent office layouts.

---

## 1. Data Model (Paperclip-inspired)

```typescript
// ── Root ──────────────────────────────────────────────────────────────────
interface AppState {
  companies: Company[];
  selectedCompanyId: string | null;
  view: 'dashboard' | 'company-detail' | 'agent-detail' | 'org-chart';
}

// ── Company ───────────────────────────────────────────────────────────────
interface Company {
  id: string;
  name: string;
  logo?: string;                   // pixel art company icon
  budget: number;
  budgetSpent: number;
  status: 'active' | 'paused';
  agents: Agent[];
  goals: Goal[];
  activityLog: ActivityEntry[];
  officeLayout: OfficeLayout;      // tile map for Canvas renderer
}

// ── Agent (Paperclip agent model) ─────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  avatar: SpriteConfig;            // which sprite sheet + color tint
  status: AgentStatus;
  reportsTo: string | null;        // agent id → org chart tree
  assignedGoalId: string | null;
  currentTask: string | null;
  monthlyCost: number;             // budget burn rate
  permissions: string[];
  skills: string[];
  hiredAt: number;
  // Canvas rendering state
  tileX: number;
  tileY: number;
  targetTileX: number;             // pathfinding destination
  targetTileY: number;
  path: [number, number][];        // BFS computed path
  animState: AnimationState;       // 'idle' | 'walking' | 'typing' | 'reading' | 'waiting'
  speechBubble: string | null;     // text shown above character
}

type AgentRole = 'CEO' | 'PM' | 'DevOps' | 'Frontend' | 'Backend' | 'QA' | 'Designer';
type AgentStatus = 'idle' | 'working' | 'meeting' | 'break' | 'blocked' | 'offline';
type AnimationState = 'idle' | 'walk-down' | 'walk-up' | 'walk-left' | 'walk-right' | 'typing' | 'reading' | 'waiting';

// ── Goal (Paperclip goal hierarchy) ───────────────────────────────────────
interface Goal {
  id: string;
  parentGoalId: string | null;     // goal tree → cascading delegation
  title: string;
  description: string;
  assignedTo: string;              // agent id (user assigns to CEO only)
  delegatedTo: string[];           // agent ids CEO delegates to
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  progress: number;                // 0–100
  createdAt: number;
}

// ── Office Layout (Pixel Agents-inspired) ─────────────────────────────────
interface OfficeLayout {
  width: number;                   // tiles (e.g. 20)
  height: number;                  // tiles (e.g. 14)
  tileSize: number;                // px per tile (e.g. 32)
  tiles: TileType[][];             // 2D grid
  furniture: FurnitureItem[];      // placed objects (desks, plants, etc.)
  seats: Seat[];                   // named seat positions agents can occupy
}

type TileType = 'floor' | 'wall' | 'void';

interface FurnitureItem {
  id: string;
  type: 'desk' | 'chair' | 'plant' | 'server-rack' | 'coffee-machine' | 'whiteboard' | 'meeting-table';
  tileX: number;
  tileY: number;
  spriteId: string;
}

interface Seat {
  id: string;
  furnitureId: string;             // which desk this seat belongs to
  tileX: number;
  tileY: number;
  assignedAgentId: string | null;
}

// ── Activity (Paperclip audit trail) ──────────────────────────────────────
interface ActivityEntry {
  id: string;
  timestamp: number;
  agentId: string;
  type: 'goal-assigned' | 'task-started' | 'task-completed' | 'delegation' | 'approval-requested' | 'budget-spent';
  message: string;
}
```

---

## 2. Canvas 2D Rendering Engine (Pixel Agents-inspired)

### Architecture

```
PixelOfficeCanvas (React component)
├── useCanvasGameLoop()           — requestAnimationFrame loop
├── TileRenderer                  — draw floor/wall tiles from OfficeLayout
├── FurnitureRenderer             — draw desk/plant/whiteboard sprites
├── CharacterRenderer             — draw agents at pixel positions
│   ├── SpriteAnimator            — frame selection from sprite sheet
│   └── SpeechBubbleRenderer      — floating text above characters
└── PathfindingEngine             — BFS on walkable tile grid
```

### Game Loop (60fps target)

```typescript
function gameLoop(ctx: CanvasRenderingContext2D, state: OfficeRenderState) {
  // 1. Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Draw tiles (floor + walls) — back to front
  renderTiles(ctx, state.layout);

  // 3. Draw furniture
  renderFurniture(ctx, state.layout.furniture);

  // 4. Update agent positions (interpolate along BFS path)
  state.agents.forEach(agent => updateAgentPosition(agent, state.deltaTime));

  // 5. Draw agents sorted by Y (painter's algorithm)
  const sorted = [...state.agents].sort((a, b) => a.pixelY - b.pixelY);
  sorted.forEach(agent => renderAgent(ctx, agent));

  // 6. Draw speech bubbles (on top of everything)
  sorted.forEach(agent => renderSpeechBubble(ctx, agent));

  requestAnimationFrame(() => gameLoop(ctx, state));
}
```

### BFS Pathfinding

```typescript
function bfsPath(
  grid: TileType[][],
  start: [number, number],
  end: [number, number]
): [number, number][] {
  // Standard BFS on 4-connected grid
  // Returns array of [tileX, tileY] waypoints
  // Agent interpolates between waypoints at walk speed
}
```

### Sprite System

- Sprite sheets: 128×256 PNG (4 columns × 8 rows = 32 frames)
- Frame layout: 4 frames per direction (down/left/right/up) + idle/typing/reading/waiting
- Frame size: 32×48 px per character
- Animation: `steps()` timing via frame counter in game loop (not CSS)
- Character tinting: Canvas `globalCompositeOperation` for role colors

---

## 3. UI Layout (Paperclip Management Dashboard)

```
┌──────────────────────────────────────────────────────────────────┐
│  ▣ CEO.SIM  │ Dashboard │ Agents │ Goals │ Costs │ Org Chart    │  ← nav bar
├──────────────────────────────────────────────────────────────────┤
│ ┌─ SIDEBAR ─────────┐  ┌─ MAIN CONTENT ───────────────────────┐│
│ │                    │  │                                      ││
│ │ Company Selector   │  │  [Dashboard view]                    ││
│ │ ┌──────────────┐   │  │  ┌────────────────────────────────┐  ││
│ │ │ Acme Corp  ▸│   │  │  │  PIXEL OFFICE CANVAS          │  ││
│ │ └──────────────┘   │  │  │  (Canvas 2D, ~600×400px)      │  ││
│ │ ┌──────────────┐   │  │  │  agents animate in real-time  │  ││
│ │ │ Globex Inc   │   │  │  └────────────────────────────────┘  ││
│ │ └──────────────┘   │  │                                      ││
│ │                    │  │  ┌─────────────┐ ┌─────────────────┐ ││
│ │ [+ New Company]    │  │  │ Goal Panel  │ │ Activity Feed   │ ││
│ │                    │  │  │ (assign to  │ │ (real-time log  │ ││
│ │ ── QUICK STATS ──  │  │  │  CEO, see   │ │  of agent       │ ││
│ │ Total Budget: $200k│  │  │  cascading  │ │  actions)       │ ││
│ │ Active Agents: 8   │  │  │  delegation)│ │                 │ ││
│ │ Active Goals: 3    │  │  └─────────────┘ └─────────────────┘ ││
│ │                    │  │                                      ││
│ │ ── AGENTS ──       │  │  ┌─────────────┐ ┌─────────────────┐ ││
│ │ Ada (CEO) ● work   │  │  │ Budget HUD  │ │ Delegation Tree │ ││
│ │ Sam (PM)  ● idle   │  │  │ $120k total │ │ CEO→PM→task     │ ││
│ │ Kai (Dev) ◌ break  │  │  │ $12k spent  │ │ CEO→Dev→task    │ ││
│ │ Mia (FE)  ● work   │  │  └─────────────┘ └─────────────────┘ ││
│ └────────────────────┘  └──────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Navigation Pages (Paperclip parity)

| Route              | Component               | Purpose                                       |
|--------------------|-------------------------|-----------------------------------------------|
| `/`                | `<Dashboard />`         | Overview: pixel office + goal panel + feed     |
| `/agents`          | `<AgentsPage />`        | Hire/fire agents, configure skills/permissions |
| `/agents/:id`      | `<AgentDetail />`       | Individual agent config, budget, activity      |
| `/goals`           | `<GoalsPage />`         | Goal tree, create/edit goals, progress         |
| `/costs`           | `<CostsPage />`         | Budget analytics, per-agent spend breakdown    |
| `/org-chart`       | `<OrgChartPage />`      | Visual hierarchy: CEO → reports → sub-reports  |
| `/settings`        | `<SettingsPage />`      | Company config, office layout editor           |

### Pages not in v1 scope (future)

- `/approvals` — governance gate for strategic decisions
- `/inbox` — task inbox with delegation
- `/routines` — scheduled agent heartbeats

---

## 4. State Management

### Zustand Store (expanded)

```typescript
interface AppStore {
  // Data
  companies: Company[];
  selectedCompanyId: string | null;
  view: ViewType;

  // Company CRUD
  addCompany: (name: string, budget: number) => void;
  selectCompany: (id: string | null) => void;

  // Agent management
  hireAgent: (companyId: string, role: AgentRole, name: string) => void;
  fireAgent: (companyId: string, agentId: string) => void;
  updateAgentStatus: (companyId: string, agentId: string, status: AgentStatus) => void;

  // Goal management
  createGoal: (companyId: string, title: string, assignedTo: string) => void;
  delegateGoal: (companyId: string, goalId: string, toAgentIds: string[]) => void;
  updateGoalProgress: (companyId: string, goalId: string, progress: number) => void;

  // Simulation
  tickCompany: (companyId: string) => void;

  // Canvas state
  updateAgentPath: (companyId: string, agentId: string, path: [number, number][]) => void;
  setAgentSpeechBubble: (companyId: string, agentId: string, text: string | null) => void;
}
```

### Simulation Engine: `useCompanySimulation(companyId)`

- Runs `requestAnimationFrame` for Canvas rendering (60fps)
- Runs `setTimeout` tick for business logic (3–5s jitter)
- On business tick:
  1. Advance goal progress
  2. Update agent statuses based on their assigned goals
  3. Compute BFS paths to new positions (desk if working, meeting table if meeting, kitchen if break)
  4. Set speech bubbles ("Working on: Build UI...")
  5. Burn budget
- On render tick:
  1. Interpolate agent pixel positions along BFS paths
  2. Advance sprite animation frames
  3. Draw everything to Canvas

---

## 5. Component Tree (v3)

```
App (React Router)
├── <NavBar />
├── <Sidebar>
│   ├── <CompanySelector />
│   ├── <QuickStats />
│   └── <AgentList />           — mini status for each agent
│
├── Route: / → <Dashboard>
│   ├── <PixelOfficeCanvas />   — Canvas 2D, BFS pathfinding, sprites
│   ├── <GoalPanel />           — assign goals, see delegation tree
│   ├── <ActivityFeed />        — real-time log of agent actions
│   ├── <BudgetHud />           — budget meter + spend rate
│   └── <DelegationTree />      — visual CEO → sub-agent task cascade
│
├── Route: /agents → <AgentsPage>
│   ├── <AgentCard /> × N       — role, status, monthly cost
│   └── <HireAgentDialog />
│
├── Route: /agents/:id → <AgentDetail>
│   ├── <AgentConfig />         — name, role, skills, permissions
│   ├── <AgentBudget />         — monthly cost, spend history
│   └── <AgentActivity />       — individual activity log
│
├── Route: /goals → <GoalsPage>
│   └── <GoalTree />            — hierarchical goal view
│
├── Route: /costs → <CostsPage>
│   └── <BudgetBreakdown />     — per-agent, per-goal cost analytics
│
├── Route: /org-chart → <OrgChartPage>
│   └── <OrgChartTree />        — SVG/Canvas org hierarchy
│
└── Route: /settings → <SettingsPage>
    └── <OfficeLayoutEditor />  — drag-and-drop tile/furniture editor
```

---

## 6. Sprite & Asset Requirements

### Characters (per Pixel Agents approach)

| Asset                  | File                                  | Size          | Frames |
|------------------------|---------------------------------------|---------------|--------|
| Generic worker sheet   | `public/assets/sprites/worker.png`    | 128×256       | 32     |
| CEO variant            | `public/assets/sprites/ceo.png`       | 128×256       | 32     |
| PM variant             | `public/assets/sprites/pm.png`        | 128×256       | 32     |
| DevOps variant         | `public/assets/sprites/devops.png`    | 128×256       | 32     |

Frame layout: 4 cols (walk frames) × 8 rows (idle/walk-down/walk-left/walk-right/walk-up/typing/reading/waiting)

### Tiles & Furniture

| Asset              | File                                     | Size   |
|--------------------|------------------------------------------|--------|
| Floor tile         | `public/assets/tiles/floor.png`          | 32×32  |
| Wall tile          | `public/assets/tiles/wall.png`           | 32×32  |
| Desk               | `public/assets/furniture/desk.png`       | 64×48  |
| Chair              | `public/assets/furniture/chair.png`      | 32×32  |
| Plant              | `public/assets/furniture/plant.png`      | 32×48  |
| Coffee machine     | `public/assets/furniture/coffee.png`     | 32×48  |
| Whiteboard         | `public/assets/furniture/whiteboard.png` | 64×48  |
| Meeting table      | `public/assets/furniture/meeting.png`    | 64×64  |
| Server rack        | `public/assets/furniture/server.png`     | 32×64  |

---

## 7. Migration from v2

| v2 artifact                 | v3 fate                                                |
|-----------------------------|--------------------------------------------------------|
| `IsometricOffice.tsx`       | Replaced by `PixelOfficeCanvas.tsx` (Canvas 2D)        |
| `IsometricCharacter.tsx`    | Replaced by Canvas sprite renderer                     |
| CSS 3D transforms           | Removed — Canvas 2D with top-down pixel art instead    |
| `CompanyDashboard.tsx`      | Refactored into `NavBar` + `Sidebar` + Router          |
| `CompanyDetail.tsx`         | Replaced by `Dashboard` route with canvas + panels     |
| `CeoGoalPanel.tsx`          | Refactored into `GoalPanel` with goal tree support     |
| `DelegationFeed.tsx`        | Refactored into `ActivityFeed` + `DelegationTree`      |
| `dashboardStore.ts`         | Expanded with agent CRUD, goal hierarchy, office layout |
| `isoProjection.ts`          | Replaced by `canvasRenderer.ts` + `pathfinding.ts`     |

---

## 8. Key Technical Decisions

1. **Canvas 2D over CSS transforms** — pixel art looks correct at native resolution; Canvas gives pixel-perfect control, game-loop animation, and sprite sheet rendering. CSS isometric was technically clever but visually wrong for the Habbo/pixel-agents aesthetic.

2. **Top-down view (not isometric)** — Pixel Agents uses top-down. Easier to implement BFS pathfinding, no depth-sorting complexity, matches the reference art style. Isometric is a stretch goal.

3. **React Router for navigation** — the office is one panel in a larger management app. Pages like /agents, /goals, /costs are standard React pages, not game views.

4. **Zustand stays** — expanded to handle agent CRUD, goal trees, and canvas state. No need for Redux complexity.

5. **Canvas inside React** — `<PixelOfficeCanvas />` is a React component wrapping a `<canvas>` element. Game loop runs in `useEffect`. Business state comes from Zustand; render state is local to the canvas.
