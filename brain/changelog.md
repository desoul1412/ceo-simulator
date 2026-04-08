---
tags: [changelog, meta]
date: 2026-04-08
status: active
---

# Changelog

## 2026-04-08 — Office Agents Simulator — Phase 1 Complete

### Step 1 — Asset & Design System
- Created `brain/wiki/UI-Design-System.md` — full Pixel Art / HUD design system: color tokens, typography, grid spec, CRT scanline pattern, component rules, status color map
- Generated SVG placeholder assets (game-assets MCP unavailable):
  - `public/assets/tiles/server-floor.svg` — dark sci-fi floor tile with circuit traces
  - `public/assets/tiles/desk.svg` — top-down cyberpunk desk with monitor + keyboard
  - `public/assets/sprites/agent-1.svg` — top-down cyborg worker
- Created `brain/raw/asset-TODO.md` — PNG generation queue with 6 prompts

### Step 2 — Architecture Blueprint
- Created `brain/wiki/Office-Simulator-Architecture.md` with:
  - ASCII map of 15×15 office grid (W/F/D/M/K zones, coordinates)
  - React Agent state shape + `useAgentPolling` contract
  - CSS Grid tile layout + absolute-position agent animation strategy
  - Component tree diagram
  - TDD test target table

### Step 3 — Engineering Execution
**Files created:**
- `src/hooks/useAgentPolling.ts` — simulation tick engine; 3–5 s jitter via recursive `setTimeout`; picks random status + zone-appropriate grid position per tick; exports `INITIAL_AGENTS`
- `src/components/AgentSprite.tsx` — absolutely positioned, CSS-transition animated sprite with status dot badge; hue-rotation tint per agent color
- `src/components/OfficeFloorPlan.tsx` — 15×15 CSS Grid tile renderer; `TileCell` sub-component with `data-cell-type` attrs; agent sprites layered at `z-index: 10`
- `src/components/HudPanel.tsx` — KPI sidebar with productivity bar, agent status rows, live tick counter
- `src/App.tsx` — rewritten; mounts `useAgentPolling`, renders `OfficeFloorPlan` + `HudPanel`
- `src/index.css` — rewritten; HUD CSS vars, `sim-root/header/main` layout, CRT scanline `.crt-overlay::after`
- `src/test-setup.ts` — vitest + jest-dom setup
- `src/hooks/useAgentPolling.test.ts` — 6 unit tests
- `src/components/OfficeFloorPlan.test.tsx` — 9 component tests

**Test results:** 15/15 passing (`npm test`)

**Dependencies added:**
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`

**Known gaps / next sprint:**
- SVG → PNG asset swap (see [[asset-TODO]])
- Sprite sheet walk-cycle animation (needs 4-frame PNG)
- Git worktree workflow deferred (no initial commit at project start)
- Pathfinding / collision avoidance
- `<Architecture>` stub spec needs content

---

## 2026-04-08 — Project Initialization
- Scaffolded React 19 + TypeScript + Vite project
- Installed Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Created folder structure: `brain/`, `public/assets/sprites/`, `public/assets/tiles/`
- Created `CLAUDE.md` autonomy engine
- Initialized Obsidian vault at `./brain/`
- Configured Tavily MCP and Context7 MCP
