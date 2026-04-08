---
tags: [architecture, simulation, react, grid]
date: 2026-04-08
status: active
---

# Office Simulator — Architecture

Linked from: [[00-Index]]
Design system: [[UI-Design-System]]

---

## 1. Grid Layout — 15×15 Office Map

Each cell = 32×32 px. Grid coords are `[col, row]` (0-indexed).

```
     0  1  2  3  4  5  6  7  8  9 10 11 12 13 14
  0  W  W  W  W  W  W  W  W  W  W  W  W  W  W  W
  1  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
  2  W  F  D  F  D  F  D  F  D  F  D  F  D  F  W   <- desk row
  3  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
  4  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
  5  W  F  D  F  D  F  D  F  D  F  D  F  D  F  W   <- desk row
  6  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
  7  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
  8  W  F  D  F  D  F  D  F  D  F  D  F  D  F  W   <- desk row
  9  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
 10  W  F  F  F  F  F  F  F  F  F  F  F  F  F  W
 11  W  M  M  M  M  F  F  F  F  F  K  K  K  K  W   <- meeting / kitchen
 12  W  M  M  M  M  F  F  F  F  F  K  K  K  K  W
 13  W  M  M  M  M  F  F  F  F  F  K  K  K  K  W
 14  W  W  W  W  W  W  W  W  W  W  W  W  W  W  W

  W=wall  F=floor  D=desk  M=meeting  K=kitchen
```

**Named position sets:**

| Zone        | Coords (col, row)                                                      |
|-------------|------------------------------------------------------------------------|
| Desks       | (2,2)(4,2)(6,2)(8,2)(10,2)(12,2) / row5 / row8 — 18 total            |
| Meeting     | cols 1-4, rows 11-13 (12 cells)                                       |
| Kitchen     | cols 10-13, rows 11-13 (12 cells)                                     |
| Walkways    | all `F` cells not already listed above                                |

---

## 2. React State Management

### State Shape

```typescript
interface Agent {
  id: string;
  name: string;
  role: 'CEO' | 'Backend Dev' | 'QA';
  col: number;         // current grid column (drives CSS left)
  row: number;         // current grid row (drives CSS top)
  status: AgentStatus; // 'idle' | 'working' | 'meeting' | 'break'
  color: string;       // neon hex — fixed per agent
}

type AgentStatus = 'idle' | 'working' | 'meeting' | 'break';
```

### Hook: `useAgentPolling()`

Location: `src/hooks/useAgentPolling.ts`

- Initializes 3 agents with fixed starting positions
- Uses recursive `setTimeout` (3–5 s jitter) to mutate agent positions
- On each tick: picks a new random status, selects a random valid position from the zone matching that status, returns updated agent array via `useState`
- Exported agents array is stable reference via `useState`

### No global store needed — single hook mounted in `App.tsx`, props drilled to children.

---

## 3. CSS/Tailwind Animation Strategy

### Tile Grid

```css
.office-grid {
  display: grid;
  grid-template-columns: repeat(15, 32px);
  grid-template-rows: repeat(15, 32px);
  width: 480px;
  height: 480px;
  position: relative;  /* agent positioning context */
  image-rendering: pixelated;
}
```

### Agent Movement (smooth interpolation)

Agents are `position: absolute` siblings of the grid tiles, layered via `z-index: 10`.

```css
.agent-sprite {
  position: absolute;
  width: 32px;
  height: 32px;
  transition: left 0.8s cubic-bezier(0.4, 0, 0.2, 1),
              top  0.8s cubic-bezier(0.4, 0, 0.2, 1);
  /* left = col * 32; top = row * 32 */
}
```

When `col` / `row` state changes → React re-renders inline `style={{ left, top }}` → CSS transition handles smooth glide.

### Sprite Sheet (placeholder → real asset)

When `agent-1.png` is a 128×32 sprite sheet (4 walking frames):

```css
.agent-sprite {
  background: url('/assets/sprites/agent-1.png') 0 0;
  animation: walk-cycle 0.5s steps(4) infinite;
}

@keyframes walk-cycle {
  to { background-position-x: -128px; }
}
```

Currently using SVG placeholder — swap `src` path when real PNG is generated.

---

## 4. Component Tree

```
App
└── <OfficePage>
    ├── <HudPanel agents={agents} />       — KPI sidebar
    └── <OfficeFloorPlan agents={agents} />
        ├── TileCell × 225                 — static background grid
        └── <AgentSprite /> × 3            — absolutely positioned, animated
```

---

## 5. File Map

| File                                     | Purpose                              |
|------------------------------------------|--------------------------------------|
| `src/hooks/useAgentPolling.ts`           | Simulation tick engine               |
| `src/components/OfficeFloorPlan.tsx`     | Grid renderer + agent overlay        |
| `src/components/AgentSprite.tsx`         | Single agent sprite + status badge   |
| `src/components/HudPanel.tsx`            | KPI sidebar                          |
| `public/assets/tiles/server-floor.svg`   | Floor tile (placeholder)             |
| `public/assets/tiles/desk.svg`           | Desk tile (placeholder)              |
| `public/assets/sprites/agent-1.svg`      | Agent sprite (placeholder)           |

---

## 6. TDD Test Targets

| Test                                           | File                                    |
|------------------------------------------------|-----------------------------------------|
| Grid renders 225 cells                         | `OfficeFloorPlan.test.tsx`              |
| Cells have correct `data-cell-type` attrs      | `OfficeFloorPlan.test.tsx`              |
| Agent count equals 3                           | `OfficeFloorPlan.test.tsx`              |
| `useAgentPolling` initializes with 3 agents    | `useAgentPolling.test.ts`               |
| Status change triggers col/row update          | `useAgentPolling.test.ts`               |
