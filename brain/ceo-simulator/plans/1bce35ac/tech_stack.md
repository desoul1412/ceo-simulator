---
tags: [plan, tech_stack]
date: 2026-04-11
status: active
---

# Tech Stack

> Directive: "Add obstacle avoidance to agent movement in the isometric office. Agents should pathfind around desks, sofas, and other furniture objects instead of walking through them. Update the pathfinding engine and the office floor plan to mark furniture tiles as non-walkable."
> Size: medium | Cost: $2.9547

Now I have a comprehensive picture. Let me compile the full technology evaluation.

---

# 🔬 Technology Evaluation Report
## Feature: Obstacle Avoidance for Agent Pathfinding

---

## 1. Current Stack Inventory

### 1.1 Runtime Dependencies (from `package.json`)

| Package | Version | Role | Notes |
|---|---|---|---|
| `react` | `^19.2.4` | UI framework | React 19 — latest stable |
| `react-dom` | `^19.2.4` | DOM renderer | Paired with React 19 |
| `react-router-dom` | `^7.14.0` | Client routing | SPA routing via `vercel.json` rewrites |
| `zustand` | `^5.0.12` | State management | Lightweight, used in `dashboardStore.ts` |
| `@supabase/supabase-js` | `^2.102.1` | Backend-as-a-service | PostgreSQL + Realtime + RLS |
| `tailwindcss` | `^4.2.2` | CSS utility framework | v4, CSS-first config (`@import "tailwindcss"`) |
| `@tailwindcss/vite` | `^4.2.2` | Tailwind Vite plugin | No `tailwind.config.js` — v4 style |
| `express` | `^5.2.1` | Server framework | Orchestrator/agent runner backend |
| `@anthropic-ai/claude-agent-sdk` | `^0.2.96` | AI agent orchestration | Claude-powered agent execution |
| `tsx` | `^4.21.0` | TypeScript execution | Runs `server/index.ts` directly |
| `dotenv` | `^17.4.1` | Env config | Server-side env loading |
| `cors` | `^2.8.6` | CORS middleware | Express middleware |
| `autoprefixer` / `postcss` | `^10.4.27` / `^8.5.9` | CSS processing | Legacy — likely unused with Tailwind v4 Vite plugin |

### 1.2 Dev Dependencies

| Package | Version | Role |
|---|---|---|
| `vite` | `^8.0.4` | Build tool / dev server |
| `@vitejs/plugin-react` | `^6.0.1` | React fast refresh |
| `typescript` | `~6.0.2` | Type checking |
| `vitest` | `^4.1.3` | Test runner |
| `jsdom` | `^29.0.2` | DOM simulation for tests |
| `@testing-library/react` | `^16.3.2` | Component testing |
| `@testing-library/jest-dom` | `^6.9.1` | DOM matchers |
| `@testing-library/user-event` | `^14.6.1` | User interaction simulation |
| `eslint` | `^9.39.4` | Linting |
| `typescript-eslint` | `^8.58.0` | TS ESLint integration |
| `eslint-plugin-react-hooks` | `^7.0.1` | Hook rules enforcement |
| `eslint-plugin-react-refresh` | `^0.5.2` | HMR safety linting |

### 1.3 Architecture Map

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (SPA — Vite + React 19 + Tailwind v4)             │
│                                                              │
│  src/components/PixelOfficeCanvas.tsx  ← GAME LOOP (60fps)   │
│      ↓ imports                                               │
│  src/engine/pathfinding.ts            ← BFS PATHFINDER       │
│  src/engine/canvasRenderer.ts         ← Canvas2D renderer    │
│  src/engine/assetLoader.ts            ← Sprite sheet loader  │
│  src/utils/isoProjection.ts           ← Grid/zone definitions│
│  src/store/dashboardStore.ts          ← Zustand global state │
│                                                              │
│  public/assets/default-layout-1.json  ← LAYOUT DATA (tiles, │
│                                         furniture, colors)   │
├──────────────────────────────────────────────────────────────┤
│  BACKEND (Express 5 + Claude Agent SDK)                      │
│  server/index.ts → agentRunner, taskProcessor, etc.          │
│  Supabase for persistence + realtime                         │
├──────────────────────────────────────────────────────────────┤
│  DEPLOY: Vercel SPA + API rewrites                           │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Pathfinding — Current Implementation Deep-Dive

| Aspect | Current State | Source |
|---|---|---|
| Algorithm | **BFS (4-directional)** — N/E/S/W only | `pathfinding.ts:48` |
| Grid source | `buildWalkableGrid()` reads tile array: `0`=wall, `255`=void → `false`; everything else → `true` | `pathfinding.ts:6-21` |
| Furniture awareness | **❌ NONE** — furniture is completely ignored during grid construction | `PixelOfficeCanvas.tsx:114` only calls `buildWalkableGrid(tiles, cols, rows)` |
| Grid size | 30×22 = 660 cells | `default-layout-1.json:2-3` |
| Grid rebuild | Once on layout load — never rebuilt | `PixelOfficeCanvas.tsx:100-118` |
| Path computation | On target change only, not per-frame | `PixelOfficeCanvas.tsx:206-219` |
| Failure mode | Returns `[]` → agent doesn't move | `pathfinding.ts:79`, guarded at `PixelOfficeCanvas.tsx:214` |
| Furniture items | ~50 objects with `{uid, type, col, row}` — **no footprint/size data** | `default-layout-1.json:53-102` |
| `FurnitureItem` interface | `uid: string`, `type: string`, `col: number`, `row: number` — **no `walkable` or `footprint` field** | `canvasRenderer.ts:28-33` |

**The Gap:** `buildWalkableGrid()` only examines tile types. It has zero knowledge of furniture placement. Agents walk straight through desks, sofas, and bookshelves.

---

## 2. Proposed Additions & Technology Decisions

### 2.1 What This Feature Actually Needs

This is a **data-layer + algorithm modification**, not a framework addition. The critical question is: *Do we need a pathfinding library, or do we extend the existing BFS?*

### 2.2 Comparison Matrix: Pathfinding Approach

| Criterion | **Option A: Extend Existing BFS** | **Option B: pathfinding.js** | **Option C: ngraph.path (Dijkstra/A\*)** |
|---|---|---|---|
| **npm Package** | N/A (in-tree) | [`pathfinding`](https://www.npmjs.com/package/pathfinding) v0.4.18 | [`ngraph.path`](https://www.npmjs.com/package/ngraph.path) v1.4.0 |
| **Bundle size** | 0 KB added | ~35 KB min | ~12 KB min |
| **Algorithm** | BFS (optimal for unweighted grid) | A*, BFS, Dijkstra, JPS, etc. | A*, Dijkstra, NBA* |
| **Grid support** | Native — our `WalkableGrid` | Native `Grid` class w/ walkability | Requires graph construction |
| **Maturity** | Proven in our codebase, 65 LOC | 3.2K ⭐, stable since 2014 | 700 ⭐, maintained |
| **Diagonal movement** | Not currently (4-dir); trivial to add | Built-in toggle | Graph-defined |
| **Performance on 660 tiles** | <0.1ms BFS | <0.1ms (any algo) | <0.1ms |
| **Team fit** | Perfect — zero learning curve | Adds API surface, new dependency | Over-engineered for grid |
| **Cost** | $0 | $0 | $0 |
| **Integration effort** | ~30min: modify `buildWalkableGrid()` | ~2hr: replace BFS, adapt Grid class | ~3hr: model as graph |
| **Risk** | Lowest — minimal diff | Medium — new dependency for no perf gain | Highest — wrong abstraction |

### 2.3 Comparison Matrix: Furniture Footprint Data Strategy

| Criterion | **Option A: Footprint Registry in TypeScript** | **Option B: Footprint in Layout JSON per-item** | **Option C: `blocked` tile layer in JSON** |
|---|---|---|---|
| **Approach** | `Map<string, {w,h}>` in `src/engine/furnitureFootprints.ts` | Add `"footprint": [1,1]` to each furniture entry | New `blockedTiles: number[]` array in layout JSON |
| **DRY** | ✅ One entry per furniture *type* | ❌ Repeated per *instance* | ✅ Pre-computed, no type lookup |
| **Layout editor friendly** | ❌ Requires code change for new types | ✅ Self-contained in JSON | ✅ Pre-baked, editor can export |
| **Maintainability** | Good — explicit TypeScript types, testable | Fair — JSON bloat | Good — simple overlay |
| **Flexibility** | Can compute dynamically, supports rotation | Per-instance overrides possible | Static — no type awareness |
| **CLAUDE.md compliance** | ⚠️ "Footprint data must live in layout JSON or separate registry — NOT scattered as magic numbers" | ✅ In layout JSON | ✅ In layout JSON |

### 2.4 Comparison Matrix: Reachability Validation

| Criterion | **Option A: BFS Flood Fill at Grid Build** | **Option B: Runtime Path Failure Logging** | **Option C: Unit Test Only** |
|---|---|---|---|
| **When** | Once after `buildWalkableGrid()` + furniture overlay | Every failed `bfsPath()` call | CI/test time only |
| **Coverage** | Detects trapped seats at load time | Detects at runtime, after agent is already stuck | Detects in CI against known layout |
| **Cost** | <1ms (660 tiles) | Zero overhead until failure | Zero runtime cost |
| **Implementation** | Flood-fill from a known walkable tile, check all seat positions | Add `console.warn` in empty-path branch | Add Vitest test case |
| **Recommendation** | ✅ **Best** — catches layout bugs immediately | Supplemental | Supplemental |

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Keep Custom BFS — Do Not Add Pathfinding Library

| Field | Value |
|---|---|
| **Status** | ✅ Accepted |
| **Context** | We need furniture-aware pathfinding on a 30×22 grid. Our existing `bfsPath()` in `pathfinding.ts` is 80 LOC, well-tested (5 test cases), and performs in <0.1ms. |
| **Decision** | Extend `buildWalkableGrid()` to accept furniture data and mark occupied tiles as non-walkable. Do NOT introduce `pathfinding.js` or `ngraph.path`. |
| **Rationale** | (1) BFS is **optimal** for unweighted uniform grids — A* offers zero advantage here. (2) 660 tiles makes any algorithm trivial — no perf pressure. (3) Adding a dependency increases bundle size (+35KB) and API surface for zero measurable benefit. (4) Our BFS is already integrated with the game loop, tested, and understood. |
| **Consequences** | If diagonal movement or weighted terrain is needed later, we extend in-tree or reconsider. For now, YAGNI. |

### ADR-002: Furniture Footprint Registry as TypeScript Module

| Field | Value |
|---|---|
| **Status** | ✅ Accepted |
| **Context** | Each furniture type (`DESK_FRONT`, `SOFA_FRONT`, etc.) occupies 1+ tiles. We need to map type → footprint size to mark tiles as blocked. CLAUDE.md §NFR mandates footprints in "layout JSON or a separate registry file." |
| **Decision** | Create `src/engine/furnitureFootprints.ts` exporting a `Map<string, { cols: number; rows: number }>` — a **separate registry file** compliant with CLAUDE.md. |
| **Rationale** | (1) One entry per *type*, not per *instance* — DRY. (2) TypeScript file is testable with Vitest. (3) Adding `footprint` to every JSON furniture entry would bloat `default-layout-1.json` by ~50 entries of redundant data. (4) Registry is trivially extensible when new furniture types are added. |
| **Consequences** | New furniture types require a registry entry. Failing to add one means the item won't block tiles — safe default (walkable). A test should verify all layout furniture types exist in the registry. |

### ADR-003: Overlay Furniture Blocking into Existing `buildWalkableGrid`

| Field | Value |
|---|---|
| **Status** | ✅ Accepted |
| **Context** | We need to integrate furniture blocking into the walkable grid without breaking the existing API contract. |
| **Decision** | Add a new function `applyFurnitureBlocking(grid, furniture, footprints)` that mutates the grid in-place, called after `buildWalkableGrid()`. Keep `buildWalkableGrid()` pure (tiles only) for testability. |
| **Rationale** | (1) Separation of concerns — tile logic ≠ furniture logic. (2) `buildWalkableGrid()` has 5 existing tests that remain valid. (3) The overlay function is independently testable. (4) Call site in `PixelOfficeCanvas.tsx:114` adds one line. |
| **Consequences** | Two-step grid construction: `buildWalkableGrid()` then `applyFurnitureBlocking()`. Slightly more code at the call site but much better testability. |

### ADR-004: BFS Reachability Check at Grid Build Time

| Field | Value |
|---|---|
| **Status** | ✅ Accepted |
| **Context** | Furniture blocking could inadvertently trap agent seats or meeting positions, making them unreachable. |
| **Decision** | Add `validateReachability(grid, positions[])` that flood-fills from a known open tile and asserts all critical positions are connected. Run once after grid build. Log warnings for unreachable positions (dev mode). |
| **Rationale** | (1) 660-tile flood fill costs <0.1ms — trivial. (2) Catches layout bugs at load time instead of runtime. (3) The empty-path fallback (`bfsPath → []`) already prevents crashes, but silent movement failure is a bad UX. |
| **Consequences** | Requires maintaining a list of "critical positions" (seats, meeting, break, idle). These already exist in `PixelOfficeCanvas.tsx:33-53` and `isoProjection.ts:39-76`. |

---

## 4. Migration Path

**There is no migration** — this feature adds to the existing system without replacing anything.

### Change Manifest

| # | File | Action | Complexity |
|---|---|---|---|
| 1 | `src/engine/furnitureFootprints.ts` | **CREATE** — Footprint registry (`Map<type, {cols, rows}>`) | Low |
| 2 | `src/engine/furnitureFootprints.test.ts` | **CREATE** — Test registry covers all layout types | Low |
| 3 | `src/engine/pathfinding.ts` | **MODIFY** — Add `applyFurnitureBlocking()` + `validateReachability()` | Medium |
| 4 | `src/engine/pathfinding.test.ts` | **MODIFY** — Add tests for furniture blocking + reachability | Medium |
| 5 | `src/components/PixelOfficeCanvas.tsx` | **MODIFY** — Line ~114: call `applyFurnitureBlocking()` after `buildWalkableGrid()` | Low |
| 6 | `src/engine/canvasRenderer.ts` | **NO CHANGE** — `FurnitureItem` interface unchanged (footprints live in registry) | None |
| 7 | `public/assets/default-layout-1.json` | **NO CHANGE** — Furniture data already has `{type, col, row}` which is sufficient | None |

### Dependency Changes

```diff
# package.json — NO CHANGES REQUIRED
# Zero new dependencies
```

### Data Flow (Before → After)

```
BEFORE:
  layout.tiles → buildWalkableGrid() → WalkableGrid → bfsPath()
                                        ↑ furniture NOT included

AFTER:
  layout.tiles → buildWalkableGrid() → WalkableGrid (tiles only)
                                           ↓
  layout.furniture + footprintRegistry → applyFurnitureBlocking(grid) → WalkableGrid (complete)
                                           ↓
                                    validateReachability(grid, criticalPositions)
                                           ↓
                                      bfsPath() ← unchanged API
```

---

## 5. Dev Environment Assessment

### 5.1 Current Tooling Health

| Tool | Version | Status | Notes |
|---|---|---|---|
| **Vite** | 8.0.4 | ✅ Current | Latest major — fast HMR, native TS |
| **TypeScript** | 6.0.2 | ✅ Current | `es2023` target, strict bundler mode |
| **Vitest** | 4.1.3 | ✅ Current | Paired with Vite 8 — fast, native TS |
| **ESLint** | 9.39.4 | ✅ Current | Flat config, TS + React hooks + refresh |
| **Testing Library** | React 16.3.2 | ✅ Current | jsdom 29 environment |
| **Tailwind** | 4.2.2 | ✅ Current | v4 CSS-first, Vite plugin — no legacy config |

### 5.2 Test Infrastructure

| Metric | Value | Assessment |
|---|---|---|
| Test files | 5 (`pathfinding`, `isoProjection`, `dashboardStore`, `OfficeFloorPlan`, `useAgentPolling`) | Adequate for current scope |
| Pathfinding tests | 7 test cases (2 `buildWalkableGrid` + 5 `bfsPath`) | **Good baseline — needs 4-6 new cases for furniture** |
| Test runner | `vitest run` (CI) / `vitest` (watch) | ✅ Proper |
| DOM test setup | `@testing-library/jest-dom` imported in `test-setup.ts` | ✅ Configured |
| Canvas testing | **Not present** — `PixelOfficeCanvas` is untested | Acceptable for game loop — logic tests cover pathfinding |

### 5.3 Recommendations for This Feature

| # | Recommendation | Priority |
|---|---|---|
| 1 | **Add `furnitureFootprints.test.ts`** — verify every type in `default-layout-1.json` has a registry entry | 🔴 Must |
| 2 | **Add furniture blocking tests** — 3×3 grid with desk, verify blocked tiles, verify path routes around | 🔴 Must |
| 3 | **Add reachability test** — load actual layout + furniture, verify all `ROLE_SEATS` + `BREAK_POSITIONS` + `IDLE_POSITIONS` are reachable | 🔴 Must |
| 4 | **Consider `postcss`/`autoprefixer` removal** — unused with Tailwind v4 Vite plugin, dead weight | 🟡 Nice-to-have |
| 5 | **Consolidate position constants** — `ROLE_SEATS` duplicated in `PixelOfficeCanvas.tsx:33-40` and `isoProjection.ts:39-50` — DRY violation | 🟡 Nice-to-have |
| 6 | **No new dependencies needed** — resist urge to add pathfinding libs for a 660-tile grid | 🔴 Must |

---

## 6. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Furniture blocks a seat position, trapping an agent | Medium | High — agent silently stuck | ADR-004 reachability check catches at load time |
| Footprint registry missing a type → item doesn't block | Low | Low — agents walk through one item | Test that all JSON types are in registry |
| Multi-tile furniture footprint off-by-one | Medium | Medium — wrong tiles blocked | Explicit test cases per major furniture type |
| Chair tiles blocked → agent can't reach their desk | High | High — agent can't sit down | Chairs should NOT be blocking (agent sits in them) — registry must exclude `*_CHAIR_*` types |
| Performance regression in game loop | Negligible | N/A | Grid built once, BFS on 660 tiles is <0.1ms |

---

## 7. Summary & Verdict

| Decision | Choice | Rationale |
|---|---|---|
| **Pathfinding algorithm** | Keep custom BFS (no new library) | 660-tile grid, unweighted — BFS is optimal. Zero value from A*/JPS. |
| **Footprint data** | New `furnitureFootprints.ts` registry | DRY, testable, CLAUDE.md compliant |
| **Grid construction** | Two-phase: tiles → furniture overlay | Clean separation, existing tests preserved |
| **Reachability** | Flood-fill validation at build time | Catches layout bugs instantly, <0.1ms cost |
| **New dependencies** | **None** | Zero new packages. Zero bundle impact. |
| **Estimated effort** | **4-6 hours** (create registry + modify pathfinding + tests + integration) | MEDIUM scope confirmed |

**Bottom line:** This is a clean, surgical modification to existing code. The stack is modern, well-chosen, and requires zero changes to support this feature. The only work is data (footprint registry) and logic (grid overlay). Ship it.
