---
tags: [plan, overview]
date: 2026-04-11
status: active
---

# Overview

> Directive: "Add obstacle avoidance to agent movement in the isometric office. Agents should pathfind around desks, sofas, and other furniture objects instead of walking through them. Update the pathfinding engine and the office floor plan to mark furniture tiles as non-walkable."
> Size: medium | Cost: $2.9547

Now I have a thorough understanding of the entire codebase relevant to this directive. Here's the comprehensive project overview:

---

# 📋 PROJECT OVERVIEW: Obstacle Avoidance for Agent Pathfinding

## Project Name & Description

**"Furniture Collision — Agent Obstacle Avoidance"**

Add obstacle avoidance to agent movement in the CEO Simulator's pixel-art office canvas. Agents currently pathfind using BFS on a grid that only considers walls (`0`) and void (`255`) as non-walkable — **furniture tiles (desks, sofas, PCs, plants, bookshelves, etc.) are completely ignored.** Agents visually walk *through* all placed furniture objects. This feature will make furniture tiles block movement, forcing agents to pathfind around them.

---

## Current State — What Exists and What's Working

### ✅ Functional Systems

| System | File(s) | Status |
|--------|---------|--------|
| **BFS Pathfinding Engine** | `src/engine/pathfinding.ts` | Working — 4-directional BFS on `WalkableGrid` (boolean[][]) |
| **Walkable Grid Builder** | `buildWalkableGrid()` in `pathfinding.ts:8-21` | Working — marks `255` (void) and `0` (wall) as non-walkable; **everything else is walkable** |
| **Canvas 2D Renderer** | `src/engine/canvasRenderer.ts` | Working — renders tiles, furniture, characters, speech bubbles at 16px tile scale |
| **Office Layout JSON** | `public/assets/default-layout-1.json` | Working — 30×22 grid, flat `tiles[]` array, `furniture[]` array with `{uid, type, col, row}` entries |
| **Pixel Office Component** | `src/components/PixelOfficeCanvas.tsx` | Working — loads layout JSON, builds walkable grid, runs 60fps game loop, interpolates agents along BFS paths |
| **Asset Loader** | `src/engine/assetLoader.ts` | Working — loads 9 floor tiles, 6 character sheets, 21 furniture sprite types |
| **Agent Movement** | `PixelOfficeCanvas.tsx:206-219` | Working — calls `bfsPath()` when target changes, agents interpolate at 30px/sec |
| **Pathfinding Tests** | `src/engine/pathfinding.test.ts` | 5 passing tests — includes wall avoidance, unreachable targets, bounds checks |
| **Legacy Floor Plans** | `src/components/OfficeFloorPlan.tsx` (v1, CSS Grid), `IsometricOffice.tsx` (v2, CSS 3D) | Retained but superseded by Canvas v3 |

### 🔴 The Bug / Missing Feature

**`buildWalkableGrid()` (line 15-17) only checks tile type:**
```typescript
const t = tiles[r * cols + c];
row.push(t !== 255 && t !== 0); // walkable if not void and not wall
```

**Furniture is never consulted.** The `furniture[]` array in `default-layout-1.json` contains ~50+ items (desks, PCs, sofas, plants, bookshelves, chairs, whiteboards, coffee tables, bins) placed at specific `(col, row)` coordinates — but these are only used for *rendering* in `renderFurniture()` (`canvasRenderer.ts:122-147`). The walkable grid has no knowledge of them.

**Result:** Agents walk directly through desks, sofas, PCs, bookshelves, and every other furniture object.

### Layout Data Structure (in `default-layout-1.json`)
- Grid: **30 cols × 22 rows = 660 tiles**
- Tile types: `0`=wall, `1-9`=various floor types, `255`=void
- Furniture array: `~50+ objects` with types like `DESK_FRONT`, `DESK_SIDE`, `PC_FRONT_OFF`, `PC_SIDE`, `SOFA_FRONT`, `SOFA_BACK`, `LARGE_PLANT`, `BOOKSHELF`, `WHITEBOARD`, `COFFEE_TABLE`, `BIN`, `CUSHIONED_CHAIR_*`, etc.
- Multi-tile furniture: Some items (desks, sofas, bookshelves) span multiple tiles visually but are placed at a single `(col, row)` anchor — their actual tile footprint needs to be defined.

---

## Scope Classification

### **🟡 MEDIUM**

| Factor | Assessment |
|--------|------------|
| **Files to modify** | 3-5 core files + 1 JSON data file + tests |
| **Core engine change** | `buildWalkableGrid()` must accept furniture data |
| **Data model change** | Furniture items need a `footprint` or `blocksTiles` property defining which tiles they occupy |
| **Layout JSON update** | `default-layout-1.json` furniture entries need size/footprint metadata (or a lookup table by type) |
| **Test updates** | Existing `pathfinding.test.ts` tests remain valid; new tests needed for furniture-blocked paths |
| **Risk** | Medium — if furniture footprints are wrong, agents could get trapped in rooms with no valid path; need fallback logic |
| **Estimated effort** | 4-8 hours for an experienced developer |

### Files Requiring Changes

| File | Change Type |
|------|-------------|
| `src/engine/pathfinding.ts` | Modify `buildWalkableGrid()` to accept and apply furniture blocking |
| `src/engine/canvasRenderer.ts` | Add `FurnitureItem.footprint` or size metadata to `FurnitureItem` interface |
| `src/components/PixelOfficeCanvas.tsx` | Pass furniture data to `buildWalkableGrid()` call (line 114) |
| `public/assets/default-layout-1.json` | Add footprint/size data to furniture entries, OR create a furniture type → size lookup |
| `src/engine/pathfinding.test.ts` | Add tests for furniture-blocked grids |
| (New) furniture size registry | Map furniture type → `{cols, rows}` footprint (e.g., `DESK_FRONT` = 2×1, `SOFA_FRONT` = 3×1) |

---

## Stakeholders & Users

| Stakeholder | Role | Concern |
|-------------|------|---------|
| **CEO (Human User)** | Primary user of the dashboard | Wants the pixel office to look realistic — agents should not ghost through furniture |
| **Agents (AI Workers)** | Simulated entities on canvas | Must still be able to reach their assigned desks, meeting areas, break positions, and idle spots |
| **Frontend Developer** | Implementer | Needs clear furniture footprint data; needs to handle edge cases (trapped agents, no-path fallback) |
| **QA** | Tester | Needs to verify no pathfinding regressions, no trapped agents, correct furniture blocking |

---

## Business Objectives

| Objective | Success Metric |
|-----------|----------------|
| **Visual Fidelity** | Agents visibly route *around* desks, sofas, and other furniture — never walking through them |
| **No Regressions** | All existing `pathfinding.test.ts` tests continue passing |
| **Reachability** | Every agent's desk seat, meeting position, break position, and idle position remains reachable from every other reachable position — verified by test |
| **Graceful Fallback** | If an agent's target becomes unreachable (e.g., surrounded by furniture), they stay in place with a speech bubble or pick an alternate position — no infinite loops |
| **Performance** | BFS on a 30×22 grid (660 tiles) must complete in <1ms — no frame drops from pathfinding recalculation |
| **Data-Driven Footprints** | Furniture blocking is driven by metadata (not hardcoded coordinates), so the layout can be changed in the JSON without code changes |

---

## Non-Functional Requirements

### Performance
- **BFS Complexity:** O(V+E) on a 660-tile grid = trivial (<1ms). No concern.
- **Grid rebuild frequency:** Walkable grid is built once on layout load (`PixelOfficeCanvas.tsx:114`). No per-frame cost. If furniture is static (which it is), this is fine.
- **60fps game loop** (`PixelOfficeCanvas.tsx:239-321`) must not stall. Path computation happens only when an agent's target changes, not every frame.

### Reliability
- **TDD Circuit Breaker:** Per CLAUDE.md §4, if tests fail 3 times consecutively, halt and document.
- **No trapped agents:** A BFS reachability check should confirm all seat/meeting/break/idle positions are connected after furniture blocking is applied.
- **Empty-path fallback:** `bfsPath()` already returns `[]` for unreachable targets (`pathfinding.ts:79`). `PixelOfficeCanvas.tsx:214` already guards `if (newPath.length > 1)` — agents simply don't move if no path exists. This is acceptable as a minimal fallback.

### Maintainability
- Furniture footprint data must live in the layout JSON or a separate registry file — **not** scattered across TypeScript as magic numbers.
- The `FurnitureItem` interface (`canvasRenderer.ts:28-33`) should be extended, not replaced.

### Security
- N/A — this is a purely frontend/canvas change with no API surface or data mutation.

### Scalability
- The current 30×22 grid is well within BFS limits. The architecture doc mentions layouts up to 64×64 = 4,096 tiles — still trivial for BFS.
- Furniture count (~50) iterated once during grid build — negligible overhead.

---

## System Context — External Integrations & APIs

| System | Relevance to This Feature |
|--------|--------------------------|
| **Supabase (PostgreSQL)** | ❌ Not affected — office layouts are loaded from static JSON, not from the database |
| **Orchestrator Server** (`server/`) | ❌ Not affected — agent movement is purely client-side canvas simulation |
| **Vercel Deployment** | ✅ Minor — updated `default-layout-1.json` will be deployed as a static asset |
| **Asset Pipeline** (`public/assets/furniture/`) | ✅ Relevant — each furniture type's `manifest.json` files exist (e.g., `DESK/manifest.json`, `SOFA/manifest.json`) and could be extended with footprint data |
| **Obsidian Brain** (`brain/`) | ✅ Per CLAUDE.md §1 — spec doc must be written before coding, changelog updated after |
| **Zustand Store** | ❌ Not affected — agent positions are managed in `PixelOfficeCanvas` local state (`agentsRef`), not in the global store for canvas rendering |
| **React Router / Other Pages** | ❌ Not affected — change is scoped entirely to the Canvas office view |

### Key Dependency Chain
```
default-layout-1.json (static data)
    → PixelOfficeCanvas.tsx (loads JSON, builds grid)
        → pathfinding.ts::buildWalkableGrid() (currently ignores furniture)
        → pathfinding.ts::bfsPath() (uses walkable grid)
            → agent movement interpolation (game loop)
```

**The entire change is contained within the `src/engine/` + `PixelOfficeCanvas.tsx` + layout JSON pipeline.** No backend, no database, no API changes required.

---

## Summary

| Dimension | Value |
|-----------|-------|
| **Scope** | Medium — ~5 files, engine-level change to pathfinding grid builder |
| **Risk** | Low-Medium — main risk is furniture footprints blocking required paths |
| **Dependencies** | Zero external — purely frontend Canvas + static JSON |
| **Testing** | Existing 5 BFS tests + new furniture-block tests + reachability validation |
| **Estimated Cost** | Within single-agent budget (Frontend or Full-Stack role) |
| **Ship Criteria** | Agents visually route around all furniture; all seats reachable; 0 test regressions |
