---
tags: [architecture, simulation, react, isometric, dashboard, state-management]
date: 2026-04-08
status: active
---

# Office Simulator — Architecture (v2 — Isometric Dashboard Pivot)

Linked from: [[00-Index]]
Design system: [[UI-Design-System]]
Previous version archived below as § Legacy v1.

---

## Overview

The application is a **Management Dashboard** containing multiple simulated companies. Each company runs an isometric Habbo Hotel-style office with live agent activity. The user interacts at two levels:

1. **Global Dashboard** — lists all companies, shows aggregate KPIs.
2. **Company Detail / IsometricOffice** — drills into one company; shows isometric floor plan with animated sub-agents working their delegated tasks in real time.

---

## 1. Data Model

### Root State

```typescript
interface DashboardState {
  companies: Company[];
  selectedCompanyId: string | null;  // null = Global Dashboard view
}
```

### Company

```typescript
interface Company {
  id: string;
  name: string;
  budget: number;          // USD, starts at seed value
  budgetSpent: number;     // accumulated cost of agent actions
  ceo: CeoAgent;
  employees: Employee[];   // populated by CEO delegation
  status: CompanyStatus;   // 'bootstrapping' | 'growing' | 'scaling' | 'crisis'
}

type CompanyStatus = 'bootstrapping' | 'growing' | 'scaling' | 'crisis';
```

### CEO Agent

The CEO is the **only** entity the user interacts with directly. All goals flow through the CEO.

```typescript
interface CeoAgent {
  id: string;
  name: string;
  goal: string;              // user-assigned natural-language goal
  activeTask: string | null; // what the CEO is currently doing
  delegations: Delegation[]; // tasks handed to employees
  isoPosition: IsoCoord;     // position on isometric grid
  status: AgentStatus;
}

interface Delegation {
  id: string;
  toRole: EmployeeRole;
  task: string;
  priority: 'low' | 'medium' | 'high';
  progress: number;          // 0–100
  startedAt: number;         // Date.now()
}
```

### Employee (Sub-Agent)

```typescript
type EmployeeRole = 'PM' | 'DevOps' | 'Frontend';

interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  assignedTask: string | null;   // inherited from Delegation
  progress: number;              // 0–100, mirrors Delegation.progress
  status: AgentStatus;
  isoPosition: IsoCoord;
  color: string;                 // neon role color
}

type AgentStatus = 'idle' | 'working' | 'meeting' | 'break' | 'blocked';
```

### Isometric Coordinate

```typescript
interface IsoCoord {
  tileX: number;   // logical grid column
  tileY: number;   // logical grid row
  // Screen position derived: isoToScreen(tileX, tileY) → { left, top }
}
```

---

## 2. Isometric Projection

Switch from orthographic (top-down CSS Grid) to **2:1 dimetric isometric** projection.

### Tile-to-screen formula

```typescript
const TILE_W = 64;   // px — isometric tile width
const TILE_H = 32;   // px — isometric tile height (TILE_W / 2)

function isoToScreen(tileX: number, tileY: number, originX: number, originY: number) {
  return {
    left: originX + (tileX - tileY) * (TILE_W / 2),
    top:  originY + (tileX + tileY) * (TILE_H / 2),
  };
}
```

- **Origin** (`originX`, `originY`): top-center of the canvas
- Agents at depth (higher `tileY`) render on top of agents at lower `tileY` → sort by `tileX + tileY` before rendering (painter's algorithm)

### Grid Size

- **20 × 12 isometric tiles** per company office
- Canvas: `~900 × 500 px`
- Zones:

```
  CEO Corner:     tileX 0-3,  tileY 0-3
  PM Zone:        tileX 4-9,  tileY 0-4
  DevOps Zone:    tileX 10-16, tileY 0-4
  Frontend Zone:  tileX 4-16, tileY 5-11
  Meeting Island: tileX 8-11, tileY 5-8
  Kitchen/Break:  tileX 0-3,  tileY 8-11
```

### Tile Types

```typescript
type TileType = 'floor' | 'wall' | 'desk' | 'meeting-table' | 'kitchen' | 'plant' | 'void';
```

`void` tiles are transparent — used to shape the isometric diamond footprint.

---

## 3. UI Layout & Navigation

```
┌─────────────────────────────────────────────────────────┐
│  ▣ CEO.SIM  [GLOBAL DASHBOARD]              HUD v2.0    │  ← header
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│   Company Cards      │   Selected Company Detail        │
│   ┌──────────┐       │   ┌──────────────────────────┐   │
│   │Acme Corp │  ───► │   │  IsometricOffice canvas  │   │
│   │$120k     │       │   │  (animated, isometric)   │   │
│   │3 agents  │       │   └──────────────────────────┘   │
│   └──────────┘       │   ┌──────────────────────────┐   │
│   ┌──────────┐       │   │  CEO Goal Input          │   │
│   │Globex    │       │   │  Delegation Feed         │   │
│   │$80k      │       │   │  Budget Meter            │   │
│   └──────────┘       │   └──────────────────────────┘   │
│   [+ Add Company]    │                                  │
└──────────────────────┴──────────────────────────────────┘
```

### View States

| `selectedCompanyId` | Rendered view                    |
|---------------------|----------------------------------|
| `null`              | `<GlobalDashboard />`            |
| `string`            | `<CompanyDetail companyId={id}>` |

Navigation is **stateful only** — no URL routing in v1.

---

## 4. State Management Strategy

### Store: Zustand (recommended) or `useReducer` + Context

Given multiple companies each with independent tick loops, a centralized store prevents prop-drilling and makes cross-company KPI aggregation simple.

```typescript
// src/store/dashboardStore.ts  (Zustand shape)

interface DashboardStore {
  companies: Company[];
  selectedCompanyId: string | null;

  // Actions
  addCompany: (name: string, budget: number) => void;
  selectCompany: (id: string | null) => void;
  assignGoal: (companyId: string, goal: string) => void;
  tickCompany: (companyId: string) => void;   // called by simulation engine
}
```

**Why not prop drilling:** The hook `useAgentPolling` from v1 becomes a per-company simulation engine (`useCompanySimulation(companyId)`). Each company's tick loop writes into the store; components subscribe to only what they render.

### Simulation Engine: `useCompanySimulation(companyId)`

Replaces `useAgentPolling`. Per company:

- Reads company state from store (goal, employees, delegations)
- Runs recursive `setTimeout` tick (3–5 s jitter)
- On tick: advances `Delegation.progress`, updates `Employee.status`, moves agents to zone-appropriate `IsoCoord`, burns `budgetSpent`
- CEO delegates automatically when a goal is set: spawns `Delegation` records for PM, DevOps, Frontend with derived sub-tasks
- Writes updates back via `tickCompany()`

### CEO Delegation Flow

```
User sets goal
     │
     ▼
CEO status → 'working'
     │
     ▼
CEO generates Delegations (3 × EmployeeRole)
     │
     ├── PM:       "Define requirements for: <goal>"
     ├── DevOps:   "Set up infra for: <goal>"
     └── Frontend: "Build UI for: <goal>"
     │
     ▼
Each Employee picks up Delegation → moves to desk → animates
     │
     ▼
Progress 0 → 100 over N ticks
     │
     ▼
Delegation complete → CEO status → 'idle', budget decremented
```

---

## 5. Component Tree (v2)

```
App
├── <GlobalDashboard />                        (selectedCompanyId === null)
│   ├── <CompanyCard company={c} /> × N
│   └── <AddCompanyButton />
│
└── <CompanyDetail companyId={id} />           (selectedCompanyId !== null)
    ├── <IsometricOffice companyId={id} />
    │   ├── <IsoTile /> × 240                  — isometric floor tiles
    │   ├── <IsoAgent agent={ceo} />           — CEO sprite, iso projected
    │   └── <IsoAgent agent={emp} /> × 3       — PM / DevOps / Frontend
    │
    ├── <CeoGoalPanel companyId={id} />        — text input → assignGoal()
    ├── <DelegationFeed companyId={id} />      — live delegation + progress bars
    └── <CompanyHud companyId={id} />          — budget meter, status, KPIs
```

---

## 6. Isometric Rendering Strategy

### Tile rendering order

Tiles rendered in row-major order (`tileY` outer, `tileX` inner). This naturally produces back-to-front painter's order for the floor.

Agents sorted by depth before render:

```typescript
const sorted = [...agents].sort((a, b) =>
  (a.isoPosition.tileX + a.isoPosition.tileY) -
  (b.isoPosition.tileX + b.isoPosition.tileY)
);
```

### Agent sprites

Each `<IsoAgent />` is `position: absolute`, positioned via `isoToScreen()`. Sprite assets needed:

| Role       | Sprite file                          | Frames |
|------------|--------------------------------------|--------|
| CEO        | `public/assets/sprites/ceo.png`      | 4      |
| PM         | `public/assets/sprites/pm.png`       | 4      |
| DevOps     | `public/assets/sprites/devops.png`   | 4      |
| Frontend   | `public/assets/sprites/frontend.png` | 4      |

Each sprite is a 4-frame horizontal sheet at `256×64` (64×64 per frame, isometric scale).

### Isometric tile assets

| Tile         | File                                      | Size     |
|--------------|-------------------------------------------|----------|
| Floor        | `public/assets/iso-tiles/floor.png`       | 64×32    |
| Desk         | `public/assets/iso-tiles/desk.png`        | 64×64    |
| Meeting      | `public/assets/iso-tiles/meeting.png`     | 128×64   |
| Wall segment | `public/assets/iso-tiles/wall.png`        | 64×64    |
| Plant        | `public/assets/iso-tiles/plant.png`       | 32×48    |
| Kitchen      | `public/assets/iso-tiles/kitchen.png`     | 64×64    |

All isometric sprites: `image-rendering: pixelated`, dark sci-fi/cyberpunk palette per [[UI-Design-System]].

---

## 7. File Map (v2)

| File                                        | Purpose                                        |
|---------------------------------------------|------------------------------------------------|
| `src/store/dashboardStore.ts`               | Zustand root store (companies, navigation)     |
| `src/hooks/useCompanySimulation.ts`         | Per-company tick engine + CEO delegation logic |
| `src/components/GlobalDashboard.tsx`        | Company card grid, add company CTA             |
| `src/components/CompanyCard.tsx`            | Single company summary card                    |
| `src/components/CompanyDetail.tsx`          | Detail shell: iso office + panels              |
| `src/components/IsometricOffice.tsx`        | Canvas + iso tile grid + agent overlay         |
| `src/components/IsoTile.tsx`                | Single isometric tile                          |
| `src/components/IsoAgent.tsx`               | Iso-projected sprite, walk-cycle animation     |
| `src/components/CeoGoalPanel.tsx`           | Goal text input, submit → assignGoal()         |
| `src/components/DelegationFeed.tsx`         | Live delegation list + progress bars           |
| `src/components/CompanyHud.tsx`             | Budget meter, company status, KPI row          |
| `src/utils/isoProjection.ts`                | `isoToScreen()`, `screenToIso()`, sort helpers |
| `public/assets/iso-tiles/`                  | Isometric floor/desk/wall tile PNGs            |
| `public/assets/sprites/`                    | Role-specific 4-frame sprite sheets            |

---

## 8. TDD Test Targets (v2)

| Test                                                   | File                                  |
|--------------------------------------------------------|---------------------------------------|
| `isoToScreen` correct pixel output for known inputs    | `isoProjection.test.ts`               |
| Painter-sort orders agents by depth                    | `isoProjection.test.ts`               |
| `addCompany` creates company with CEO + empty staff    | `dashboardStore.test.ts`              |
| `assignGoal` creates 3 Delegations (one per role)      | `dashboardStore.test.ts`              |
| `tickCompany` advances delegation progress             | `dashboardStore.test.ts`              |
| Budget decrements as delegations complete              | `dashboardStore.test.ts`              |
| `GlobalDashboard` renders one card per company         | `GlobalDashboard.test.tsx`            |
| `CompanyDetail` mounts on company select               | `CompanyDetail.test.tsx`              |
| `IsometricOffice` renders CEO + 3 employee agents      | `IsometricOffice.test.tsx`            |
| `CeoGoalPanel` submit calls `assignGoal` in store      | `CeoGoalPanel.test.tsx`               |

---

## 9. Migration from v1

| v1 artifact                    | v2 fate                                               |
|--------------------------------|-------------------------------------------------------|
| `useAgentPolling.ts`           | Replaced by `useCompanySimulation.ts`                 |
| `OfficeFloorPlan.tsx`          | Replaced by `IsometricOffice.tsx`                     |
| `AgentSprite.tsx`              | Replaced by `IsoAgent.tsx`                            |
| `HudPanel.tsx`                 | Replaced by `CompanyHud.tsx`                          |
| `App.tsx` (flat layout)        | Replaced by `GlobalDashboard` / `CompanyDetail` shell |
| Top-down 15×15 CSS Grid        | Replaced by 20×12 isometric projection                |
| PNG tiles (32×32)              | Replaced by isometric PNGs (64×32 floor, 64×64 objs) |
| Existing tests (15 passing)    | Archived; new suite targets v2 components             |

---

## § Legacy v1 Notes

The v1 flat top-down grid (15×15, orthographic) is on `master` as of commit `1bfff5e`. The v2 isometric build will be developed on `feature/isometric-dashboard`.

Key v1 decisions not carried forward:
- Single `useAgentPolling` hook (no company concept)
- CSS Grid for tile layout (replaced by absolute iso projection)
- 3 hard-coded agents (replaced by dynamic CEO + delegated team)
