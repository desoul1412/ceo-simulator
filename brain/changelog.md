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

## 2026-04-08 — Architecture v3: Paperclip + Pixel Agents Hybrid

### Decision
Pivoted from CSS 3D isometric to **Canvas 2D pixel art** (Pixel Agents style) embedded in a **Paperclip-style management dashboard**. The v2 CSS isometric approach was technically functional but visually wrong for the target aesthetic.

### References researched
- [Paperclip](https://github.com/paperclipai/paperclip) — React 19 + Vite + Tailwind + Express + PostgreSQL. 45+ pages, 24+ API routes. Companies, agents, goals (cascading delegation), budgets, org charts, approvals, activity feeds.
- [Pixel Agents](https://github.com/pablodelucca/pixel-agents) — VS Code extension. Canvas 2D game loop, BFS pathfinding, 32×48px sprite sheets, speech bubbles, activity-driven animations, persistent office layouts.

### Key changes in `Office-Simulator-Architecture.md` (v2 → v3)
1. **Rendering**: CSS 3D transforms → Canvas 2D with `requestAnimationFrame` game loop
2. **View**: Isometric 2.5D → top-down pixel art (matches Pixel Agents style)
3. **Pathfinding**: random teleport → BFS on walkable tile grid
4. **Sprites**: CSS div characters → sprite sheet animation (32×48px, 32 frames)
5. **Management UI**: minimal sidebar → full Paperclip parity (agents, goals, costs, org chart, settings pages via React Router)
6. **Data model**: expanded with Agent CRUD, Goal hierarchy (parent→child), OfficeLayout (tiles + furniture + seats), ActivityLog
7. **Speech bubbles**: agents show what they're working on above their heads
8. **Office layout**: configurable tile grid with placeable furniture (desks, plants, whiteboards, server racks)

### v2 components to replace
- `IsometricOffice` → `PixelOfficeCanvas` (Canvas 2D)
- `IsometricCharacter` → Canvas sprite renderer
- `CompanyDashboard` → `NavBar` + `Sidebar` + React Router
- `CompanyDetail` → `Dashboard` route (canvas + panels)

---

## 2026-04-08 — Isometric 2.5D Dashboard Build (Step 3)

Built via `feature/isometric-dashboard` worktree → merged to master.

### Engine (CSS 3D Isometric)
- `transform: rotateX(60deg) rotateZ(-45deg)` on grid wrapper → 2.5D illusion
- Reverse transforms on `IsometricCharacter` sprites → face camera
- 8×6 tile grid with 7 zone types (CEO/PM/DevOps/Frontend desks, meeting, kitchen, floor)
- `isoProjection.ts`: tile definitions, `sortByDepth()` painter's algorithm, role desks

### State Management (Zustand)
- `dashboardStore.ts`: root store with `Company[]`, `selectedCompanyId`
- Actions: `addCompany`, `selectCompany`, `assignGoal`, `tickCompany`
- CEO delegation flow: goal → 3 `Delegation` records → employee status changes → budget burn
- 2 mock companies: Acme Corp ($120k), Globex Inc ($80k)
- Per-company tick: recursive setTimeout 3–5s jitter in `CompanyDetail`

### Components
- `CompanyDashboard` → sidebar company list + main content area
- `CompanyCard` → status badge, budget, active count, current goal preview
- `CompanyDetail` → iso office + title bar (budget/status) + side panels
- `IsometricOffice` → CSS Grid + 3D transform wrapper + zone tiles + agent sprites
- `IsometricCharacter` → CSS pixel-art body with role color, reverse-transform billboard
- `CeoGoalPanel` → text input → `assignGoal()`, disabled while goal active
- `DelegationFeed` → per-delegation progress bars, role colors, task text

### Tests
- 32/32 passing: v1 legacy (15) + v2 iso projection (7) + store (10)
- Coverage: grid generation, depth sort, company CRUD, goal delegation, tick progress, budget

---

## 2026-04-08 — game-asset-mcp Repair & Registration

- Identified root cause: package name `@mubarakhalketbi/game-asset-mcp` doesn't exist on npm; repo is GitHub-only
- Cloned to `~/game-asset-mcp` and installed deps (`--ignore-scripts` to bypass `canvas` native build failure on Windows)
- Patched `src/clients.js`: 3D Gradio model space connection failure is now non-fatal — server degrades gracefully to 2D-only mode (`generate_2d_asset` available, `generate_3d_asset` disabled)
- Updated `.claude/settings.json`: command changed from `npx @mubarakhalketbi/game-asset-mcp` → `node C:/Users/CPU12062/game-asset-mcp/src/index.js`
- Server confirmed starting cleanly: `[INFO] MCP Game Asset Generator running with stdio transport`
- **Restart Claude Code** to load the live MCP tool

---

## 2026-04-08 — Isometric Asset Generation (v2)

`game-assets` MCP package (`@mubarakhalketbi/game-asset-mcp`) confirmed non-existent on npm (404).
Assets generated via HuggingFace FLUX.1-schnell router API per CLAUDE.md fallback directive.

| Asset | Path | Size | Method |
|-------|------|------|--------|
| ISO floor tile (wood, seamless) | `public/assets/tiles/iso-floor.png` | 64×32 | HF FLUX → PIL NEAREST |
| ISO desk (dual monitors, neon) | `public/assets/tiles/iso-desk.png` | 64×64 | HF FLUX → PIL NEAREST |
| ISO worker sprite (cyborg) | `public/assets/sprites/iso-worker-1.png` | 64×64 | HF FLUX → PIL NEAREST |

Sizes match isometric tile spec from [[Office-Simulator-Architecture]] §6:
- Floor tile: 64×32 (2:1 diamond ratio)
- Desk / character: 64×64

---

## 2026-04-08 — Architecture Pivot: Isometric Dashboard (v2)

### Decision
Pivoted from flat top-down office simulator to a full **isometric Habbo Hotel-style management dashboard** containing multiple companies.

### Updated: `brain/wiki/Office-Simulator-Architecture.md` (v1 → v2)

Key architectural changes documented:

**Data Model**
- Root state: `DashboardState` → `companies[]` + `selectedCompanyId`
- `Company`: has `name`, `budget`, `budgetSpent`, `status`, a `CeoAgent`, and `Employee[]`
- `CeoAgent`: holds user-assigned `goal`, generates `Delegation[]` (one per sub-agent role)
- `Employee`: `PM | DevOps | Frontend` — receives task from CEO delegation, renders in iso office
- `IsoCoord { tileX, tileY }` — logical grid coords, projected to screen via `isoToScreen()`

**Isometric Projection**
- 2:1 dimetric: `left = originX + (tileX - tileY) * 32`, `top = originY + (tileX + tileY) * 16`
- Grid: 20×12 tiles; canvas ~900×500 px
- Zones: CEO Corner, PM Zone, DevOps Zone, Frontend Zone, Meeting Island, Kitchen/Break
- Painter's algorithm: sort agents by `tileX + tileY` before render

**UI Layout**
- Two-pane: left = company card list, right = selected company detail (iso office + panels)
- Navigation: pure state (`selectedCompanyId: string | null`) — no URL routing in v1

**State Management**
- Zustand store: `dashboardStore` (companies, selectedCompanyId, addCompany, assignGoal, tickCompany)
- Per-company hook: `useCompanySimulation(companyId)` — replaces `useAgentPolling`
- CEO delegation flow: goal → 3 Delegations (PM/DevOps/Frontend) → employees animate at desks → progress 0→100 → budget decrements

**Component Tree**
- `GlobalDashboard` → `CompanyCard × N` + `AddCompanyButton`
- `CompanyDetail` → `IsometricOffice` + `CeoGoalPanel` + `DelegationFeed` + `CompanyHud`
- `IsometricOffice` → `IsoTile × 240` + `IsoAgent × 4` (CEO + 3 employees)

**v1 → v2 migration table** documented; v1 code on master @ `1bfff5e` retained as reference.

### Updated: `brain/00-Index.md`
- v2 feature checklist added
- v1 items marked complete and archived

---

## 2026-04-08 — PNG Asset Generation + Sprite Sheet Animation

### Assets
- Generated 6 pixel art PNGs via HuggingFace FLUX.1-schnell router API (256×256 → resized with PIL NEAREST):
  - `public/assets/tiles/server-floor.png` (32×32)
  - `public/assets/tiles/desk.png` (32×32)
  - `public/assets/tiles/kitchen.png` (32×32)
  - `public/assets/tiles/meeting.png` (32×32)
  - `public/assets/tiles/indicator.png` (16×16)
  - `public/assets/sprites/agent-1.png` (128×32 — 4-frame walk-cycle sheet)
- Registered `game-assets` MCP in `.claude/settings.json` (restart Claude Code to use)

### Components (via `feature/png-assets` worktree → merged)
- `OfficeFloorPlan.tsx`: replaced SVG tile icons with `TILE_ASSET` PNG map; floor/desk/kitchen/meeting all use real PNG textures
- `AgentSprite.tsx`: replaced `<img>` with CSS `background-image` sprite sheet; `@keyframes walk-cycle steps(4)` injected into `<head>` once; animation active when `status !== 'idle'`

### Process
- Initial commit created to enable git worktrees
- Worktree: `feature/png-assets` → committed → merged to `master` → worktree removed
- 15/15 tests still passing post-merge
- `brain/raw/asset-TODO.md` queue fully cleared (all items ✅)

---

## 2026-04-08 — Project Initialization
- Scaffolded React 19 + TypeScript + Vite project
- Installed Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Created folder structure: `brain/`, `public/assets/sprites/`, `public/assets/tiles/`
- Created `CLAUDE.md` autonomy engine
- Initialized Obsidian vault at `./brain/`
- Configured Tavily MCP and Context7 MCP
