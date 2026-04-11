---
tags: [plan, implementation_plan]
date: 2026-04-11
status: active
---

# Implementation Plan

> Directive: "Add obstacle avoidance to agent movement in the isometric office. Agents should pathfind around desks, sofas, and other furniture objects instead of walking through them. Update the pathfinding engine and the office floor plan to mark furniture tiles as non-walkable."
> Size: medium | Cost: $2.9547

Now I have a complete picture of the codebase. Let me build the plan.

---

# 📋 Implementation Plan: Obstacle Avoidance for Agent Pathfinding

## Executive Summary

Agents currently walk straight through desks, sofas, and plants because `buildWalkableGrid()` (line 6, `pathfinding.ts`) only checks tile data (`255=void`, `0=wall`), completely ignoring the 48 furniture items in `default-layout-1.json`. The fix is a 3-file change: one new module (`furnitureFootprints.ts`), one modified module (`pathfinding.ts`), and one wiring update (`PixelOfficeCanvas.tsx` line 114).

**Grid dimensions**: 30 cols × 22 rows = 660 tiles  
**Furniture items**: 48 items across ~22 distinct types  
**Critical constraint**: 6 `ROLE_SEATS` positions must remain walkable after blocking furniture tiles

---

## Phase 1: Furniture Footprint Registry
**Goal**: Create the data module that maps every furniture type string to its tile footprint (width × height in grid cells).  
**Duration**: 0.5 days  
**Assigned Roles**: Frontend, PM  
**Dependencies**: None — this is the foundational data layer  

- [ ] **Task 1.1** (Role: PM) — Audit all 22 furniture types from `default-layout-1.json` and cross-reference with actual sprite dimensions in `public/assets/furniture/`. Document each type's pixel size → tile footprint (e.g., `SOFA_FRONT` sprite is 48×16 → 3×1 tiles). Record findings in a table within the spec doc `brain/wiki/Obstacle-Avoidance-Spec.md`.

- [ ] **Task 1.2** (Role: Frontend) — Create `src/engine/furnitureFootprints.ts` with the following exports:
  ```typescript
  // Type definition
  interface FurnitureFootprint { w: number; h: number; }
  
  // Registry constant — keyed by base asset name (before ':' modifier)
  const FURNITURE_FOOTPRINTS: Record<string, FurnitureFootprint>
  
  // Public API
  function getFootprint(type: string): FurnitureFootprint  // strips ':left'/':right', defaults to {w:1,h:1}
  function computeBlockedTiles(furniture: FurnitureItem[]): Set<string>  // returns "col,row" keys
  ```
  All ~22 types from the layout JSON must be mapped. Types present in `default-layout-1.json`:
  | Type | Expected Footprint |
  |------|--------------------|
  | `DESK_FRONT` | 2×1 |
  | `DESK_SIDE` | 1×2 |
  | `PC_FRONT_OFF/ON_*` | 1×1 |
  | `PC_BACK` | 1×1 |
  | `PC_SIDE` | 1×1 |
  | `SOFA_FRONT` | 3×1 |
  | `SOFA_BACK` | 3×1 |
  | `SOFA_SIDE` | 1×2 |
  | `COFFEE_TABLE` | 2×1 |
  | `COFFEE` | 1×1 |
  | `WHITEBOARD` | 2×2 |
  | `BOOKSHELF` | 1×2 |
  | `DOUBLE_BOOKSHELF` | 2×2 |
  | `LARGE_PLANT` | 1×2 |
  | `PLANT` / `PLANT_2` | 1×1 |
  | `CUSHIONED_CHAIR_*` | 1×1 |
  | `WOODEN_CHAIR_SIDE` | 1×1 |
  | `BIN` | 1×1 |
  | `CLOCK` | 1×1 (wall-mounted, non-blocking — see Task 1.4) |
  | `LARGE_PAINTING` / `SMALL_PAINTING*` | wall-mounted, non-blocking |
  | `SMALL_TABLE_FRONT` | 1×1 |

- [ ] **Task 1.3** (Role: Frontend) — Create `src/engine/furnitureFootprints.test.ts` with unit tests:
  - `getFootprint('DESK_FRONT')` → `{w:2, h:1}`
  - `getFootprint('SOFA_SIDE:left')` → `{w:1, h:2}` (modifier stripped)
  - `getFootprint('UNKNOWN_THING')` → `{w:1, h:1}` (safe default)
  - `computeBlockedTiles([{uid:'x', type:'DESK_FRONT', col:3, row:2}])` → Set containing `"3,2"` and `"4,2"`
  - `computeBlockedTiles([])` → empty Set
  - Wall-mounted items (`CLOCK`, `LARGE_PAINTING`, `SMALL_PAINTING`, `SMALL_PAINTING_2`) should return `{w:0, h:0}` and produce **zero** blocked tiles

- [ ] **Task 1.4** (Role: PM) — Define the **non-blocking furniture list** (wall-mounted decorations that agents can walk under): `CLOCK`, `LARGE_PAINTING`, `SMALL_PAINTING`, `SMALL_PAINTING_2`. Confirm with visual inspection that these sprites render on wall tiles (row=0, tileType=0) in the layout. Document rationale in spec.

- [ ] **Task 1.5** (Role: Frontend) — Run `npm test` — all new + existing tests must pass. Commit to feature branch `feat/obstacle-avoidance`.

### Definition of Done — Phase 1
- [x] `furnitureFootprints.ts` exports `getFootprint()` and `computeBlockedTiles()`
- [x] All 22 furniture types from the layout JSON are mapped
- [x] Wall-mounted items explicitly produce 0×0 footprints (non-blocking)
- [x] `furnitureFootprints.test.ts` has ≥6 test cases, all green
- [x] Module has zero imports from React/DOM (pure TypeScript, no side effects)

---

## Phase 2: Pathfinding Grid Integration
**Goal**: Extend `buildWalkableGrid()` to accept furniture data and mark occupied tiles as non-walkable. Add reachability validation.  
**Duration**: 0.5 days  
**Assigned Roles**: Frontend, PM  
**Dependencies**: **Phase 1 must complete** (`computeBlockedTiles` is required)

- [ ] **Task 2.1** (Role: Frontend) — Modify `buildWalkableGrid()` in `src/engine/pathfinding.ts` (currently lines 6–21) to accept an optional second parameter:
  ```typescript
  export function buildWalkableGrid(
    tiles: number[],
    cols: number,
    rows: number,
    furniture?: FurnitureItem[]  // NEW — optional for backward compat
  ): WalkableGrid
  ```
  After the existing tile loop (lines 12-19), add a second pass:
  ```typescript
  if (furniture) {
    const blocked = computeBlockedTiles(furniture);
    for (const key of blocked) {
      const [c, r] = key.split(',').map(Number);
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r][c] = false;
      }
    }
  }
  ```

- [ ] **Task 2.2** (Role: Frontend) — Add `validateReachability()` function to `pathfinding.ts`:
  ```typescript
  export function validateReachability(
    grid: WalkableGrid,
    requiredTiles: [number, number][]  // [col, row] pairs that MUST be reachable
  ): { reachable: boolean; unreachableTiles: [number, number][] }
  ```
  Implementation: BFS flood-fill from the first walkable tile in `requiredTiles`, then check all others are visited. This catches the fatal bug where a desk blocks an agent's seat.

- [ ] **Task 2.3** (Role: Frontend) — Extend `src/engine/pathfinding.test.ts` with new test cases:
  - `buildWalkableGrid()` with no furniture param → identical behavior to current (backward compat)
  - `buildWalkableGrid()` with a `DESK_FRONT` at (3,2) → cells (3,2) and (4,2) are `false`
  - `buildWalkableGrid()` with a `CLOCK` at (6,0) → cell (6,0) remains unchanged (wall-mounted)
  - `validateReachability()` on a connected grid → `{ reachable: true, unreachableTiles: [] }`
  - `validateReachability()` on a grid where a required tile is blocked → returns the tile in `unreachableTiles`
  - Regression: all 5 existing `bfsPath` tests still pass unchanged

- [ ] **Task 2.4** (Role: PM) — **Validate `ROLE_SEATS` reachability** against the actual layout. Cross-reference these 6 critical positions with the furniture placed in `default-layout-1.json`:
  | Role | Seat (col,row) | Nearest furniture | Conflict? |
  |------|----------------|-------------------|-----------|
  | CEO | (4,3) | `f-ceo-chair-1` at (4,4) | ⚠️ Check |
  | PM | (18,3) | `f-pm-chair-1` at (18,4) | ⚠️ Check |
  | DevOps | (4,14) | `f-devops-desk-1` at (3,12) | Likely OK |
  | Frontend | (9,3) | `f-ceo-chair-2` at (9,4) | ⚠️ Check |
  | Backend | (24,3) | `f-pm-chair-2` at (24,4) | ⚠️ Check |
  | QA | (9,14) | `f-devops-chair-4` at (9,13) | ⚠️ Check |
  
  If any seat becomes unreachable, recommend either: (a) adjust `ROLE_SEATS` in `PixelOfficeCanvas.tsx` lines 33-40, or (b) make chair-type furniture non-blocking (agents sit *in* chairs).

- [ ] **Task 2.5** (Role: PM) — **Decision: Are chairs blocking?** Chairs (`CUSHIONED_CHAIR_*`, `WOODEN_CHAIR_*`) represent where agents sit. Marking them non-walkable would block the agent's own seat. **Recommendation**: Chairs should be **non-blocking** (footprint `{w:0, h:0}`). Document decision in spec. Frontend updates `furnitureFootprints.ts` accordingly.

- [ ] **Task 2.6** (Role: Frontend) — Run `npm test` — all tests (old + new) must pass. Commit to `feat/obstacle-avoidance`.

### Definition of Done — Phase 2
- [x] `buildWalkableGrid()` signature extended with optional `furniture` param
- [x] Backward compatibility: calling without furniture produces identical grid
- [x] `validateReachability()` implemented and tested
- [x] All 6 `ROLE_SEATS` confirmed reachable on the actual layout grid
- [x] Chair blocking decision documented and implemented
- [x] ≥5 new test cases in `pathfinding.test.ts`, all green
- [x] Zero regressions on existing 5 BFS tests

---

## Phase 3: Canvas Wiring + Debug Overlay
**Goal**: Connect the furniture-aware grid to the live game loop in `PixelOfficeCanvas.tsx`. Add an optional debug overlay for visual verification.  
**Duration**: 0.5 days  
**Assigned Roles**: Frontend, PM  
**Dependencies**: **Phase 2 must complete** (modified `buildWalkableGrid` signature required)

- [ ] **Task 3.1** (Role: Frontend) — Modify `PixelOfficeCanvas.tsx` **line 114** to pass furniture:
  ```typescript
  // BEFORE (line 114-116):
  walkableRef.current = buildWalkableGrid(
    layoutData.tiles, layoutData.cols, layoutData.rows
  );
  
  // AFTER:
  walkableRef.current = buildWalkableGrid(
    layoutData.tiles, layoutData.cols, layoutData.rows,
    layoutData.furniture || []
  );
  ```
  This is a **one-line change** to the call site — the entire bug fix is this wiring.

- [ ] **Task 3.2** (Role: Frontend) — Add DEV-mode reachability validation immediately after the grid is built (after line 116):
  ```typescript
  if (import.meta.env.DEV) {
    const seats = Object.values(ROLE_SEATS).map(s => [s.col, s.row] as [number, number]);
    const result = validateReachability(walkableRef.current, seats);
    if (!result.reachable) {
      console.warn('[PathDebug] Unreachable seats:', result.unreachableTiles);
    }
  }
  ```

- [ ] **Task 3.3** (Role: Frontend) — Add optional **debug grid overlay** in `canvasRenderer.ts`, activated by URL param `?debugGrid=1`:
  ```typescript
  export function renderDebugGrid(
    ctx: CanvasRenderingContext2D,
    grid: WalkableGrid,
    cols: number,
    rows: number
  ): void
  ```
  Renders semi-transparent red overlay on non-walkable tiles, green on walkable. Drawn after tiles but before furniture in the render pipeline (`renderFrame`, line 283 in `canvasRenderer.ts`).

- [ ] **Task 3.4** (Role: Frontend) — Thread the debug grid through `PixelOfficeCanvas.tsx`:
  - Read `new URLSearchParams(window.location.search).has('debugGrid')` once on mount
  - If active, pass `walkableRef.current` into `renderFrame()` (add optional param) and call `renderDebugGrid()` between tile and furniture render passes
  - This is dev-only tooling — zero production overhead when param is absent

- [ ] **Task 3.5** (Role: PM) — **Manual walkthrough**: Launch `npm run dev`, navigate to the company view. Verify:
  - Agents walk **around** desks (not through them)
  - Agents can still reach all 6 `ROLE_SEATS`
  - Agents can path from any seat to the lounge `BREAK_POSITIONS` and `IDLE_POSITIONS`
  - No agent gets permanently stuck (empty `bfsPath` returns → agent stays in place)
  - `?debugGrid=1` shows correct red/green overlay matching furniture placement

- [ ] **Task 3.6** (Role: Frontend) — Run `npm test` — full suite green. Commit to `feat/obstacle-avoidance`.

### Definition of Done — Phase 3
- [x] `buildWalkableGrid` called with `layoutData.furniture` at line 114
- [x] DEV-mode reachability warning fires correctly when a seat is blocked
- [x] Debug grid overlay functional behind `?debugGrid=1` URL param
- [x] No console errors, no visible regressions in tile/furniture/character rendering
- [x] All tests pass

---

## Phase 4: QA Validation + Merge
**Goal**: Full regression testing, visual QA sign-off, documentation update, and merge to `main`.  
**Duration**: 0.5 days  
**Assigned Roles**: Frontend, PM  
**Dependencies**: **Phase 3 must complete**

- [ ] **Task 4.1** (Role: PM) — **Scenario test matrix** — execute and sign off each:
  | # | Scenario | Expected Result | Status |
  |---|----------|-----------------|--------|
  | 1 | Agent in `working` status → paths to desk | Walks around other furniture to reach `ROLE_SEATS` position | ☐ |
  | 2 | Agent in `break` status → paths to lounge | Navigates around lounge sofas/tables to reach `BREAK_POSITIONS` | ☐ |
  | 3 | Agent in `idle` status → random wander | Picks `IDLE_POSITIONS`, paths around obstacles | ☐ |
  | 4 | Agent in `meeting` status → paths to (7,6) | Can reach meeting area without clipping through CEO desk | ☐ |
  | 5 | No path exists (hypothetical) | Agent stays in place, no crash, no infinite loop | ☐ |
  | 6 | Debug overlay (`?debugGrid=1`) | Red tiles match furniture footprints, green matches walkable | ☐ |
  | 7 | Multiple agents pathfinding simultaneously | No jitter, no z-fighting, paths don't conflict | ☐ |
  | 8 | Browser resize during pathing | Canvas rescales, agents continue smooth movement | ☐ |

- [ ] **Task 4.2** (Role: Frontend) — Run complete test suite and verify counts:
  ```
  npm test
  ```
  Expected: all existing tests pass + ≥11 new tests across `furnitureFootprints.test.ts` and extended `pathfinding.test.ts`.

- [ ] **Task 4.3** (Role: Frontend) — Run `npm run build` to verify TypeScript compilation with zero errors. Check bundle size delta (should be negligible — ~2KB gzipped for the new module).

- [ ] **Task 4.4** (Role: PM) — Update `brain/wiki/Obstacle-Avoidance-Spec.md` with final implementation details:
  - Actual footprint table used
  - Chair blocking decision rationale
  - Debug overlay usage instructions
  - Any `ROLE_SEATS` adjustments made

- [ ] **Task 4.5** (Role: PM) — Append to `brain/changelog.md`:
  ```markdown
  ## 2026-04-11 — Obstacle Avoidance for Agent Pathfinding
  - NEW: `src/engine/furnitureFootprints.ts` — furniture type → tile footprint registry
  - MOD: `src/engine/pathfinding.ts` — `buildWalkableGrid()` accepts furniture param, marks occupied tiles non-walkable
  - MOD: `src/components/PixelOfficeCanvas.tsx` — passes `layoutData.furniture` to grid builder
  - MOD: `src/engine/canvasRenderer.ts` — optional `renderDebugGrid()` overlay
  - NEW: `src/engine/furnitureFootprints.test.ts` — 6+ unit tests
  - MOD: `src/engine/pathfinding.test.ts` — 5+ new test cases
  ```

- [ ] **Task 4.6** (Role: Frontend) — Merge `feat/obstacle-avoidance` → `main`. Vercel auto-deploys from main.

- [ ] **Task 4.7** (Role: PM) — Post-deploy smoke test on `https://ceo-simulator-iota.vercel.app` — verify agents pathfind around furniture in production.

### Definition of Done — Phase 4
- [x] All 8 scenario tests pass visual QA
- [x] `npm test` — all green, zero regressions
- [x] `npm run build` — zero TypeScript errors
- [x] `brain/changelog.md` updated
- [x] `brain/wiki/Obstacle-Avoidance-Spec.md` written/updated
- [x] Branch merged to `main`
- [x] Production deployment verified

---

## Testing Strategy

### Unit Tests (Vitest — `npm test`)
| File | Test Focus | Count |
|------|-----------|-------|
| `furnitureFootprints.test.ts` **(NEW)** | Registry lookups, modifier stripping, default fallback, `computeBlockedTiles` output, wall-mounted exclusion | 6+ |
| `pathfinding.test.ts` **(EXTENDED)** | Backward compat (no furniture), furniture-blocked cells, `validateReachability` connected/disconnected | 5+ new |
| `pathfinding.test.ts` **(EXISTING)** | BFS path finding, wall navigation, unreachable targets | 5 existing |

### Integration Tests (Manual — Dev Server)
- Launch `npm run dev` → navigate to `/company/:id` → observe agent movement
- Activate `?debugGrid=1` → visually verify blocked tile overlay matches furniture
- Cycle agent statuses (working/break/meeting/idle) → confirm pathfinding to all targets

### Edge Case Testing
- **Agent spawns on a blocked tile**: `ROLE_SEATS` overlap with furniture → caught by `validateReachability()` in DEV mode console warning
- **No path exists**: `bfsPath` returns `[]` → agent stays in place (existing behavior at line 214: `if (newPath.length > 1)`)
- **Unknown furniture type**: `getFootprint()` defaults to `{w:1, h:1}` — blocks the tile rather than silently ignoring

### E2E (Not Required)
This is a purely visual, client-side feature with no backend, no API, no data mutation. Manual visual QA replaces E2E automation. The debug grid overlay serves as a programmatic verification tool.

---

## CI/CD Pipeline

```
feat/obstacle-avoidance branch
        │
        ▼
┌─────────────────────┐
│ 1. npm install       │
│ 2. npm run build     │  ← TypeScript compilation check
│ 3. npm test          │  ← Vitest: ~16 tests (5 old + 11 new)
│ 4. Lint (optional)   │
└─────────┬───────────┘
          │ All green
          ▼
┌─────────────────────┐
│ Merge to main        │
└─────────┬───────────┘
          │ Auto-trigger
          ▼
┌─────────────────────┐
│ Vercel Production    │  ← SPA deploy (vercel.json: rewrites to /index.html)
│ Build: vite build    │  ← Zero infra changes needed
└─────────────────────┘
```

**No infrastructure changes**: Same Vercel SPA deployment. No new environment variables. No Supabase changes. No new dependencies in `package.json`.

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **`ROLE_SEATS` blocked by furniture footprints** | 🔴 High | Agent can't reach their desk → visual bug | `validateReachability()` catches this at dev time. Phase 2 Task 2.4 audits all 6 seats. Chairs made non-blocking (Task 2.5). |
| **Incorrect footprint dimensions** | 🟡 Medium | Agent walks through large furniture or gets blocked by empty space | PM audits sprite pixel sizes (Phase 1 Task 1.1). Debug grid overlay makes errors immediately visible. |
| **`BREAK_POSITIONS` / `IDLE_POSITIONS` unreachable** | 🟡 Medium | Agents in break/idle status can't path → stuck | `validateReachability()` extended to check these positions too (Task 3.2). Lounge furniture positions cross-checked in Task 2.4. |
| **Performance regression on large grids** | 🟢 Low | BFS slowdown | Current grid is 660 tiles. `computeBlockedTiles` iterates ~48 items. BFS is O(V+E) ≈ O(660). Negligible. |
| **Sprite pixel dimensions don't match assumed footprints** | 🟡 Medium | Visual mismatch between rendered furniture and blocked tiles | PM does pixel-level audit (Task 1.1). Debug overlay visualizes the exact blocked cells. |
| **Fallback if tests fail 3× (TDD Circuit Breaker)** | 🟢 Low | Burned tokens | Per CLAUDE.md §4: halt execution, document in `changelog.md`, escalate to CEO. |

---

## File Change Summary

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `src/engine/furnitureFootprints.ts` | **CREATE** | ~80 lines |
| `src/engine/furnitureFootprints.test.ts` | **CREATE** | ~60 lines |
| `src/engine/pathfinding.ts` | **MODIFY** | +25 lines (furniture param + `validateReachability`) |
| `src/engine/pathfinding.test.ts` | **MODIFY** | +40 lines (5 new test cases) |
| `src/components/PixelOfficeCanvas.tsx` | **MODIFY** | +8 lines (line 114 change + DEV validation) |
| `src/engine/canvasRenderer.ts` | **MODIFY** | +20 lines (`renderDebugGrid` function) |
| `brain/wiki/Obstacle-Avoidance-Spec.md` | **CREATE** | ~50 lines |
| `brain/changelog.md` | **APPEND** | ~10 lines |

**Total estimated delta**: ~293 lines added/modified across 8 files. Zero deletions. Zero new dependencies.

---

## Timeline

| Day | Phase | Milestone |
|-----|-------|-----------|
| Day 1 AM | Phase 1 | `furnitureFootprints.ts` + tests green |
| Day 1 PM | Phase 2 | `pathfinding.ts` extended + seat reachability validated |
| Day 2 AM | Phase 3 | Canvas wired + debug overlay functional |
| Day 2 PM | Phase 4 | Full QA → merge → deploy |

**Total**: **2 developer-days** with 1 Frontend + 1 PM.
