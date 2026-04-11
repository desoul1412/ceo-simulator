---
tags: [plan, hiring_plan]
date: 2026-04-11
status: active
---

# Hiring Plan

> Directive: "Add obstacle avoidance to agent movement in the isometric office. Agents should pathfind around desks, sofas, and other furniture objects instead of walking through them. Update the pathfinding engine and the office floor plan to mark furniture tiles as non-walkable."
> Size: medium | Cost: $2.9547

# 🏭 Hiring Plan: Obstacle Avoidance for Agent Pathfinding

## Codebase Assessment

After analyzing the full codebase, here's what I found:

| Metric | Value |
|--------|-------|
| **Files to create** | 1 — `src/engine/furnitureFootprints.ts` |
| **Files to modify** | 2 — `pathfinding.ts` (81 LOC), `PixelOfficeCanvas.tsx` (line 114) |
| **Test files affected** | 2 — `pathfinding.test.ts` + new footprint tests |
| **Furniture items in layout** | ~40 items across ~20 types (`DESK_FRONT`, `SOFA_SIDE:left`, etc.) |
| **Grid size** | 30×22 = 660 tiles (trivial for BFS) |
| **Backend changes** | None. Pure frontend engine work. |
| **Infra changes** | None. No deployment topology change. |

**Key code insight:** `buildWalkableGrid()` at `pathfinding.ts:6` currently only checks `tiles[r * cols + c]` for void/wall values. The `layoutData.furniture` array is loaded at `PixelOfficeCanvas.tsx:110` but **never passed** to the grid builder. This is the root cause — agents "see through" all furniture.

---

## Hiring Table

| # | Role | Model | Monthly Budget | Skills Required | Justification |
|---|------|-------|---------------|-----------------|---------------|
| 1 | **PM** | haiku | $5 | Requirements decomposition, spec validation, ticket tracking | Architecture doc is already complete with 4 phases. PM decomposes into atomic tickets, enforces phase gating (Phase 2 can't start until Phase 1 tests pass), and validates that `ROLE_SEATS` positions don't overlap with newly-blocked tiles — a critical edge case. Haiku is sufficient for this well-scoped coordination role. |
| 2 | **Frontend** | sonnet | $15 | TypeScript, React 19, Canvas2D, BFS pathfinding, spatial tile math, Vitest | **Primary executor.** Implements all 4 phases: (1) `furnitureFootprints.ts` — registry mapping ~20 `FurnitureItem.type` strings to `{w, h}` footprints with modifier stripping (`:left` → mirror), (2) extends `buildWalkableGrid()` signature to accept `FurnitureItem[]`, iterates `computeBlockedTiles()` to set `grid[r][c] = false`, adds `validateReachability()` via BFS flood-fill, (3) passes `layoutData.furniture` at `PixelOfficeCanvas.tsx:114`, (4) debug grid overlay behind URL param. Must understand isometric tile coordinate system already in use (`col`, `row` → `pixelX`, `pixelY` at `TILE_SIZE=16`). |
| 3 | **QA** | haiku | $5 | Vitest, TDD, spatial regression, edge-case analysis | Writes unit tests **before** implementation (TDD per CLAUDE.md §4). Tests: footprint lookups for all ~20 types, unknown types default to 1×1, modifier stripping (`SOFA_SIDE:left` → `SOFA_SIDE`), blocked tile computation against known layout, reachability validation (no orphaned walkable islands), and the **critical regression**: all 6 `ROLE_SEATS` positions (`CEO: [4,3]`, `PM: [18,3]`, etc.) and 3 `BREAK_POSITIONS` remain reachable after furniture blocking. Haiku is sufficient — test patterns are well-defined. |

**Total Monthly Burn: $25**

---

## Team Structure

```
        ┌─────────┐
        │   CEO   │  (You — strategic oversight, circuit breaker authority)
        └────┬────┘
             │
        ┌────▼────┐
        │   PM    │  haiku · $5/mo
        │ (coord) │  Owns ticket board, phase gates, edge-case checklist
        └──┬───┬──┘
           │   │
     ┌─────▼┐ ┌▼─────┐
     │ FE   │ │ QA   │
     │sonnet│ │haiku │
     │$15/mo│ │$5/mo │
     └──────┘ └──────┘
```

- **PM → Frontend**: Delivers phase-scoped tickets with acceptance criteria
- **PM → QA**: Delivers test specifications before each phase begins
- **Frontend ↔ QA**: TDD loop — QA writes failing tests, Frontend makes them pass
- **QA → PM**: Reports test results, blocks phase advancement on failures

---

## Communication Protocol

| Event | From → To | Channel | Format |
|-------|-----------|---------|--------|
| Phase kickoff | PM → FE, QA | Ticket | Phase spec + files to touch + acceptance criteria |
| Test-first spec | QA → FE | Test file PR | Failing `*.test.ts` committed to worktree before FE begins coding |
| Implementation complete | FE → QA | PR on feature branch | Code + `changelog.md` update per CLAUDE.md §1 POST-FLIGHT |
| Test failure (3x) | QA → PM → CEO | `changelog.md` | **TDD CIRCUIT BREAKER** (CLAUDE.md §4) — halt execution, escalate |
| Phase gate pass | PM → All | Ticket close | All tests green, phase marked complete, next phase unblocked |
| Reachability alert | QA → FE | Console warning | If `validateReachability()` detects orphaned tiles, FE must adjust footprints |

---

## Priority Hiring — Execution Order

### Wave 1 (Immediate — Day 1)
| Priority | Role | Rationale |
|----------|------|-----------|
| 🔴 **P0** | **Frontend** | The entire feature lives in 3 TypeScript files. This agent does 90% of the work. Cannot start anything without them. |
| 🔴 **P0** | **QA** | TDD is mandatory per CLAUDE.md §4. QA must write failing tests for Phase 1 (`furnitureFootprints`) *before* Frontend begins. Co-hire with FE. |

### Wave 2 (Day 1, after kickoff)
| Priority | Role | Rationale |
|----------|------|-----------|
| 🟡 **P1** | **PM** | Can onboard slightly after FE+QA since the architecture doc already defines all 4 phases. PM's main value is phase gating and catching the `ROLE_SEATS` reachability edge case. |

---

## Roles NOT Hired (and Why)

| Role | Why Excluded |
|------|-------------|
| **Backend** | Zero backend changes. No Supabase schema changes. No API endpoints. The `furniture` array is already in `default-layout-1.json`. |
| **DevOps** | No infrastructure changes. No `vercel.json` modifications. Same SPA deployment. |
| **Designer** | No new sprites needed. Furniture is already rendered by `canvasRenderer.ts`. We're only changing the *walkability grid*, not visual assets. |
| **Full-Stack** | Overkill. A focused Frontend specialist is more token-efficient for pure engine work. |
| **Data Architect** | No database involvement. `FurnitureFootprint` is a compile-time TypeScript `Map`, not a DB table. |

---

## Risk Mitigation

| Risk | Likelihood | Mitigation | Owner |
|------|-----------|------------|-------|
| Furniture blocks `ROLE_SEATS` → agents spawn inside desks, can't pathfind | **HIGH** | QA writes explicit reachability test for all 6 seat positions + 3 break positions against actual layout data | QA |
| `SOFA_FRONT` is 2×1 but registry says 1×1 → agent clips through half the sofa | MEDIUM | PM creates exhaustive footprint validation checklist from sprite sheet dimensions in `public/assets/` | PM |
| BFS returns `[]` (no path) after blocking → agent freezes in place | MEDIUM | FE adds fallback: if `bfsPath` returns empty, agent stays put and retries next tick with jittered target | FE |
| TDD circuit breaker fires (3 consecutive failures) | LOW | Per CLAUDE.md §4: halt, log to `changelog.md`, escalate to CEO. PM enforces. | PM |
