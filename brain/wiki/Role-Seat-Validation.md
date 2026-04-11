---
tags: [spec, canvas, layout, validation, bug-fix, furniture, pathfinding]
date: 2026-04-11
status: active
---

# Task 2.4 / 2.5 — ROLE_SEATS Reachability Validation & Chair Blocking Decision

## Related
- [[Office-Simulator-Architecture]]
- [[changelog]]

---

## Overview

Cross-reference of the 6 hardcoded `ROLE_SEATS` coordinates (used in `PixelOfficeCanvas.tsx`, `api.ts`, and `CeoPlanFlow.tsx`) against the actual furniture placement in `public/assets/default-layout-1.json`.

**Goal:** Confirm every seat tile is:
1. Within grid bounds (30 cols × 22 rows)
2. On a walkable tile (value ≠ `0` = wall and ≠ `255` = void)
3. Semantically adjacent to the correct desk/chair furniture piece

---

## Grid Reference

```
Cols: 0–29  (30 wide)
Rows: 0–21  (22 tall)

Tile codes:
  0   = WALL          (not walkable)
  255 = VOID          (not walkable)
  7   = CEO room floor     (walkable)
  1   = PM room floor      (walkable)
  3   = DevOps room floor  (walkable)
  9   = Lounge/QA floor    (walkable)
```

### Room Boundaries (from tiles array)

| Room      | Cols   | Rows   | Tile |
|-----------|--------|--------|------|
| CEO       | 1–13   | 1–9    | 7    |
| PM        | 15–28  | 1–9    | 1    |
| DevOps    | 1–13   | 11–20  | 3    |
| Lounge/QA | 15–28  | 11–20  | 9    |
| Corridor  | 7–8    | row 10 | 1    |
| Corridor  | 22–23  | row 10 | 1    |

---

## Furniture Reference (Desk Clusters)

Extracted from `public/assets/default-layout-1.json → "furniture"` array.

### Top-Floor DESK_FRONT Clusters (face-on desks)

| UID              | Furniture          | Col | Row | Notes                     |
|------------------|--------------------|-----|-----|---------------------------|
| f-ceo-desk-1     | DESK_FRONT         | 3   | 2   | CEO desk body             |
| f-ceo-pc-1       | PC_FRONT_OFF       | 4   | 2   | PC on CEO desk            |
| f-ceo-chair-1    | CUSHIONED_CHAIR_FRONT | 4 | 4   | CEO chair (south of desk) |
| f-ceo-desk-2     | DESK_FRONT         | 8   | 2   | Frontend desk body        |
| f-ceo-pc-2       | PC_FRONT_OFF       | 9   | 2   | PC on Frontend desk       |
| f-ceo-chair-2    | CUSHIONED_CHAIR_FRONT | 9 | 4   | Frontend chair            |
| f-pm-desk-1      | DESK_FRONT         | 17  | 2   | PM desk body              |
| f-pm-pc-1        | PC_FRONT_OFF       | 18  | 2   | PC on PM desk             |
| f-pm-chair-1     | CUSHIONED_CHAIR_FRONT | 18| 4   | PM chair                  |
| f-pm-desk-2      | DESK_FRONT         | 23  | 2   | Backend desk body         |
| f-pm-pc-2        | PC_FRONT_OFF       | 24  | 2   | PC on Backend desk        |
| f-pm-chair-2     | CUSHIONED_CHAIR_FRONT | 24| 4   | Backend chair             |

### Bottom-Floor DESK_SIDE Clusters (side-on desks)

| UID               | Furniture                  | Col | Row | Notes                        |
|-------------------|----------------------------|-----|-----|------------------------------|
| f-devops-desk-1   | DESK_SIDE                  | 3   | 12  | DevOps desk A (top)          |
| f-devops-pc-1     | PC_SIDE                    | 3   | 13  | PC on desk A                 |
| f-devops-chair-1  | WOODEN_CHAIR_SIDE          | 2   | 13  | Chair LEFT of PC (agent sits here) |
| f-devops-desk-2   | DESK_SIDE                  | 3   | 16  | DevOps desk B (bottom)       |
| f-devops-pc-2     | PC_SIDE                    | 3   | 17  | PC on desk B                 |
| f-devops-chair-2  | WOODEN_CHAIR_SIDE          | 2   | 17  | Chair LEFT of PC             |
| f-devops-desk-3   | DESK_SIDE                  | 8   | 12  | QA desk A (top, mirrored)    |
| f-devops-pc-3     | PC_SIDE:left               | 8   | 13  | PC on QA desk A              |
| f-devops-chair-3  | WOODEN_CHAIR_SIDE:left     | 9   | 13  | Chair RIGHT of PC (agent sits here) |
| f-devops-desk-4   | DESK_SIDE                  | 8   | 16  | QA desk B (bottom, mirrored) |
| f-devops-pc-4     | PC_SIDE:left               | 8   | 17  | PC on QA desk B              |
| f-devops-chair-4  | WOODEN_CHAIR_SIDE:left     | 9   | 17  | Chair RIGHT of PC            |

---

## Validation Results — 6 Critical Positions

### Walkability Rule
```typescript
// pathfinding.ts
row.push(t !== 255 && t !== 0); // walkable if not void and not wall
```
Furniture does **not** affect the walkable grid — only tile values matter.

---

### ✅ CEO — (col: 4, row: 3)

| Check           | Result                                        |
|-----------------|-----------------------------------------------|
| In-bounds       | ✅ col 4 ∈ [0,29], row 3 ∈ [0,21]            |
| Tile value      | ✅ `7` (CEO room floor — walkable)            |
| Furniture match | ✅ Sandwiched between PC_FRONT_OFF (4,2) above and CUSHIONED_CHAIR_FRONT (4,4) below |
| Semantic        | ✅ Standard DESK_FRONT working position       |

**Status: PASS**

---

### ✅ Frontend — (col: 9, row: 3)

| Check           | Result                                        |
|-----------------|-----------------------------------------------|
| In-bounds       | ✅ col 9 ∈ [0,29], row 3 ∈ [0,21]            |
| Tile value      | ✅ `7` (CEO room floor — walkable)            |
| Furniture match | ✅ Sandwiched between PC_FRONT_OFF (9,2) above and CUSHIONED_CHAIR_FRONT (9,4) below |
| Semantic        | ✅ Standard DESK_FRONT working position       |

**Status: PASS**

---

### ✅ PM — (col: 18, row: 3)

| Check           | Result                                        |
|-----------------|-----------------------------------------------|
| In-bounds       | ✅ col 18 ∈ [0,29], row 3 ∈ [0,21]           |
| Tile value      | ✅ `1` (PM room floor — walkable)             |
| Furniture match | ✅ Sandwiched between PC_FRONT_OFF (18,2) above and CUSHIONED_CHAIR_FRONT (18,4) below |
| Semantic        | ✅ Standard DESK_FRONT working position       |

**Status: PASS**

---

### ✅ Backend — (col: 24, row: 3)

| Check           | Result                                        |
|-----------------|-----------------------------------------------|
| In-bounds       | ✅ col 24 ∈ [0,29], row 3 ∈ [0,21]           |
| Tile value      | ✅ `1` (PM room floor — walkable)             |
| Furniture match | ✅ Sandwiched between PC_FRONT_OFF (24,2) above and CUSHIONED_CHAIR_FRONT (24,4) below |
| Semantic        | ✅ Standard DESK_FRONT working position       |

**Status: PASS**

---

### ❌ DevOps — (col: 4, row: 14) — BUG

| Check           | Result                                                                    |
|-----------------|---------------------------------------------------------------------------|
| In-bounds       | ✅ col 4 ∈ [0,29], row 14 ∈ [0,21]                                       |
| Tile value      | ✅ `3` (DevOps room floor — walkable)                                     |
| Furniture match | ❌ **No desk or chair at or adjacent to (4,14)**                          |
| Nearest chair   | WOODEN_CHAIR_SIDE at **(2, 13)** — 2 cols left, 1 row up                |
| Nearest PC      | PC_SIDE at **(3, 13)** — 1 col left, 1 row up                           |
| Semantic        | ❌ Agent spawns in open corridor gap between desk cluster A (rows 12–13) and desk cluster B (rows 16–17) |

**Correct seat:** `{ col: 2, row: 13 }` — the `WOODEN_CHAIR_SIDE` tile (agent sits IN the chair graphic, matching DESK_FRONT pattern)

**Status: FAIL — Seat is in empty corridor, not at desk**

---

### ⚠️ QA — (col: 9, row: 14) — BUG (off-by-one)

| Check           | Result                                                                    |
|-----------------|---------------------------------------------------------------------------|
| In-bounds       | ✅ col 9 ∈ [0,29], row 14 ∈ [0,21]                                       |
| Tile value      | ✅ `3` (DevOps room floor — walkable)                                     |
| Furniture match | ⚠️ Chair `WOODEN_CHAIR_SIDE:left` is at **(9, 13)** — 1 row above        |
| Nearest PC      | PC_SIDE:left at **(8, 13)** — 1 col left, 1 row up                      |
| Semantic        | ⚠️ Agent spawns 1 row below their chair, in the gap between desk clusters A and B |

**Correct seat:** `{ col: 9, row: 13 }` — the `WOODEN_CHAIR_SIDE:left` tile

**Status: FAIL — Off-by-one row from chair position**

---

## Summary Table

| Role     | Current Seat | Tile | Walkable | Furniture Match | Verdict       | Correct Seat |
|----------|-------------|------|----------|-----------------|---------------|-------------|
| CEO      | (4, 3)      | 7    | ✅       | ✅ Between desk+chair | **PASS**  | —           |
| Frontend | (9, 3)      | 7    | ✅       | ✅ Between desk+chair | **PASS**  | —           |
| PM       | (18, 3)     | 1    | ✅       | ✅ Between desk+chair | **PASS**  | —           |
| Backend  | (24, 3)     | 1    | ✅       | ✅ Between desk+chair | **PASS**  | —           |
| DevOps   | (4, 14)     | 3    | ✅       | ❌ Open corridor | **FAIL**   | **(2, 13)** |
| QA       | (9, 14)     | 3    | ✅       | ⚠️ Off by 1 row | **FAIL**   | **(9, 13)** |

**4/6 PASS · 2/6 FAIL**

All 6 tiles are walkable (reachability ✅). The 2 failures are **semantic placement bugs** — agents are navigable but visually displaced from their assigned furniture.

---

## Fixes Applied

The following corrections have been applied to all 3 ROLE_SEATS definitions:

### `src/components/PixelOfficeCanvas.tsx`
```diff
- DevOps:   { col: 4, row: 14 },   // DevOps room (bottom-left)
+ DevOps:   { col: 2, row: 13 },   // DevOps room — WOODEN_CHAIR_SIDE desk A
- QA:       { col: 9, row: 14 },   // DevOps room second desk
+ QA:       { col: 9, row: 13 },   // DevOps room — WOODEN_CHAIR_SIDE:left desk A
```

### `src/lib/api.ts`
```diff
- DevOps:   { col: 4, row: 14 },
+ DevOps:   { col: 2, row: 13 },
- QA:       { col: 9, row: 14 },
+ QA:       { col: 9, row: 13 },
```

### `src/components/CeoPlanFlow.tsx`
```diff
- DevOps: { col: 4, row: 14 },
+ DevOps: { col: 2, row: 13 },
- QA: { col: 9, row: 14 },
+ QA: { col: 9, row: 13 },
```

---

## Design Notes

### DESK_FRONT Pattern (top floor)
```
row 2: [DESK_FRONT][PC_FRONT_OFF]   ← desk/PC tiles
row 3: [           ][  SEAT ← agent here  ]   ← working position
row 4: [           ][CUSHIONED_CHAIR]   ← chair (south, decorative)
```
Agent at row 3 faces north into the PC. Chair at row 4 is rendered behind the agent sprite.

### DESK_SIDE Pattern (bottom floor, left-facing)
```
col 3, row 12: [DESK_SIDE]
col 3, row 13: [PC_SIDE  ]
col 2, row 13: [WOODEN_CHAIR_SIDE ← SEAT]   ← agent sits here, facing right
```

### DESK_SIDE Pattern (bottom floor, right-facing / mirrored)
```
col 8, row 12: [DESK_SIDE    ]
col 8, row 13: [PC_SIDE:left ]
col 9, row 13: [WOODEN_CHAIR_SIDE:left ← SEAT]   ← agent sits here, facing left
```

---

## Task 2.5 — Chair Blocking Decision

**Date:** 2026-04-11  
**Status:** ✅ DECIDED & IMPLEMENTED

### The Question

Should chairs (`CUSHIONED_CHAIR_*`, `WOODEN_CHAIR_*`) block pathfinding?

If marked blocking, a furniture-aware BFS overlay would add those tiles to the non-walkable set. This is standard for desks, servers, and large appliances — but chairs present a unique problem.

### The Problem with Blocking Chairs

Every chair tile IS a `ROLE_SEAT`. The mapping is exact and intentional:

| Role     | Seat Coord | Chair at same coord        |
|----------|------------|---------------------------|
| CEO      | (4, 4)     | CUSHIONED_CHAIR_FRONT      |
| Frontend | (9, 4)     | CUSHIONED_CHAIR_FRONT      |
| PM       | (18, 4)    | CUSHIONED_CHAIR_FRONT      |
| Backend  | (24, 4)    | CUSHIONED_CHAIR_FRONT      |
| DevOps   | (2, 13)    | WOODEN_CHAIR_SIDE          |
| QA       | (9, 13)    | WOODEN_CHAIR_SIDE:left     |

> Note: DESK_FRONT agent positions (row 3) are 1 row above the chair (row 4). The chair is a decorative sprite rendered south of the agent. DESK_SIDE agents sit directly ON the chair tile.

If chairs were blocking, `applyFurnitureBlocking()` would mark those tiles `false` in the walkable grid. BFS would then reject those tiles as targets, making `ROLE_SEATS` unreachable for DevOps and QA (who sit directly on chair tiles), and cutting off any path that passes through chair tiles for all roles.

### Decision

> **Chairs are NON-BLOCKING. Footprint: `{ w: 0, h: 0 }`**

**Rationale:**
1. **Semantic:** Chairs are _where agents sit_, not obstacles. The chair graphic is a visual affordance for the seat; the agent sprite renders on top of it.
2. **Functional:** Chair tiles are the exact coordinates in `ROLE_SEATS`. Blocking them breaks navigation to those seats.
3. **Consistency:** `DESK_FRONT` agents (CEO, Frontend, PM, Backend) sit at row 3, one row above their chair at row 4. While their primary seat tile is not the chair tile, pathfinding often traverses through chair tiles in adjacent routes. Blocking chairs creates dead-end corridors in the top-floor rooms.
4. **Precedent:** In RPG/office sim genre (Pixel Agents, Stardew Valley), chairs are sit-on objects, not collision boxes. Only furniture with a physical mass larger than one person (desks, servers, walls) blocks movement.

### Rejected Alternative: "Chair-adjacent" seats

One alternative was to place `ROLE_SEATS` one tile south of each chair (behind the chair, away from the desk), avoiding the blocking conflict. This was rejected because:
- It breaks the visual alignment (agent appears behind their own chair)
- It wastes the tile immediately south, which may be the corridor or another desk cluster
- It adds complexity to the layout editor — every chair placement would require a separate seat marker

### Implementation

**File:** `src/engine/furnitureFootprints.ts` (new, 2026-04-11)

All six chair variants registered as `{ w: 0, h: 0 }`:

```typescript
// Chairs — NON-BLOCKING (Task 2.5 decision)
CUSHIONED_CHAIR_FRONT: { w: 0, h: 0 },
CUSHIONED_CHAIR_BACK:  { w: 0, h: 0 },
CUSHIONED_CHAIR_SIDE:  { w: 0, h: 0 },
WOODEN_CHAIR_FRONT:    { w: 0, h: 0 },
WOODEN_CHAIR_BACK:     { w: 0, h: 0 },
WOODEN_CHAIR_SIDE:     { w: 0, h: 0 },
```

The `applyFurnitureBlocking()` function explicitly skips any furniture with `fp.w === 0 || fp.h === 0`, so chairs contribute zero cells to the blocking overlay.

### Acceptance Criteria

- [x] All 6 chair variants appear in `FURNITURE_FOOTPRINTS` with `{ w: 0, h: 0 }`
- [x] `applyFurnitureBlocking()` skips items with zero footprint
- [x] `getFurnitureFootprint('CUSHIONED_CHAIR_FRONT')` returns `{ w: 0, h: 0 }`
- [x] `getFurnitureFootprint('WOODEN_CHAIR_SIDE')` returns `{ w: 0, h: 0 }`
- [x] `getFurnitureFootprint('WOODEN_CHAIR_SIDE:left')` returns `{ w: 0, h: 0 }` (variant stripped)
- [x] BFS can still path to chair tile coordinates (DevOps: (2,13), QA: (9,13))
- [x] Decision documented in this spec with full rationale

### Future Consideration

If a "hotdesk" feature is added (agents can sit at any free chair, not just their assigned seat), the furniture system should expose a `isSeat: boolean` flag per type, allowing the seat-assignment system to enumerate available chairs. This is additive and does not require changing the non-blocking decision.
