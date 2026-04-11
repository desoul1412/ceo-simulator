/**
 * furnitureFootprints.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Defines the blocking footprint for every furniture type in the office.
 *
 * DECISION — Task 2.5 (2026-04-11):
 *   Chairs (CUSHIONED_CHAIR_*, WOODEN_CHAIR_*) are NON-BLOCKING: footprint {w:0, h:0}.
 *
 *   Rationale:
 *   - Each chair tile is the assigned seat for an agent role (ROLE_SEATS).
 *   - Marking a chair as blocking would make the seat itself unreachable by BFS.
 *   - Chairs are decorative/semantic: the agent sprite is rendered ON TOP of the
 *     chair graphic. The chair is a visual affordance, not a physical obstacle.
 *   - The walkable grid is driven solely by tile values (0=wall, 255=void).
 *     Furniture footprints are an additive overlay applied AFTER tile-based grid
 *     construction — a zero footprint means the furniture contributes no blocked
 *     cells to that overlay.
 *
 * FOOTPRINT SEMANTICS:
 *   { w: number, h: number }
 *   - w=0, h=0  → NON-BLOCKING (passes through for pathfinding)
 *   - w>0, h>0  → BLOCKING (cells in the rect [col, row] to [col+w-1, row+h-1]
 *                  are marked non-walkable in the overlay grid)
 *
 * HOW TO USE:
 *   import { getFurnitureFootprint, applyFurnitureBlocking } from './furnitureFootprints';
 *
 *   // Build tile-based grid first
 *   const grid = buildWalkableGrid(tiles, cols, rows);
 *   // Then layer furniture blocking on top
 *   applyFurnitureBlocking(grid, layout.furniture);
 */

export interface FurnitureFootprint {
  /** Tile-width of blocking area (0 = non-blocking) */
  w: number;
  /** Tile-height of blocking area (0 = non-blocking) */
  h: number;
}

// ── Footprint Registry ────────────────────────────────────────────────────────

/**
 * Maps furniture type keys (matching FurnitureItem.type, without variant suffix)
 * to their blocking footprint.
 *
 * Type key format: strip the colon-variant (e.g. "PC_SIDE:left" → "PC_SIDE").
 */
export const FURNITURE_FOOTPRINTS: Record<string, FurnitureFootprint> = {
  // ── Desks ────────────────────────────────────────────────────────────────
  DESK_FRONT:          { w: 2, h: 2 },   // 2-wide, 2-tall desk cluster
  DESK_SIDE:           { w: 1, h: 2 },   // side-facing desk (tall)
  DESK_CORNER:         { w: 2, h: 2 },   // corner desk

  // ── PCs / monitors ───────────────────────────────────────────────────────
  PC_FRONT_OFF:        { w: 1, h: 1 },   // monitor on desk — blocks its tile
  PC_FRONT_ON:         { w: 1, h: 1 },
  PC_SIDE:             { w: 1, h: 1 },
  PC_SIDE_ON:          { w: 1, h: 1 },

  // ── Chairs — NON-BLOCKING (Task 2.5 decision) ────────────────────────────
  //
  //   Chairs are agent seats. Blocking them would make ROLE_SEATS unreachable.
  //   w:0 h:0 → zero cells added to the blocking overlay.
  //
  CUSHIONED_CHAIR_FRONT: { w: 0, h: 0 },
  CUSHIONED_CHAIR_BACK:  { w: 0, h: 0 },
  CUSHIONED_CHAIR_SIDE:  { w: 0, h: 0 },
  WOODEN_CHAIR_FRONT:    { w: 0, h: 0 },
  WOODEN_CHAIR_BACK:     { w: 0, h: 0 },
  WOODEN_CHAIR_SIDE:     { w: 0, h: 0 },

  // ── Sofas ────────────────────────────────────────────────────────────────
  SOFA_SIDE:           { w: 2, h: 1 },   // blocks 2 tiles wide
  SOFA_FRONT:          { w: 2, h: 1 },

  // ── Storage / shelves ────────────────────────────────────────────────────
  BOOKSHELF:           { w: 2, h: 1 },
  FILING_CABINET:      { w: 1, h: 1 },
  SERVER_RACK:         { w: 1, h: 2 },

  // ── Appliances ───────────────────────────────────────────────────────────
  COFFEE_MACHINE:      { w: 1, h: 1 },
  WATER_COOLER:        { w: 1, h: 1 },
  PRINTER:             { w: 1, h: 1 },

  // ── Décor / greenery ─────────────────────────────────────────────────────
  PLANT_SMALL:         { w: 0, h: 0 },   // walkable through (thin pot)
  PLANT_LARGE:         { w: 1, h: 1 },
  PLANT_TALL:          { w: 1, h: 1 },

  // ── Meeting / collaboration ───────────────────────────────────────────────
  MEETING_TABLE:       { w: 3, h: 2 },
  WHITEBOARD:          { w: 2, h: 1 },
  TV_STAND:            { w: 2, h: 1 },
};

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Resolve the base type key from a furniture type string.
 * Strips colon-variants: "PC_SIDE:left" → "PC_SIDE"
 */
export function resolveFurnitureKey(type: string): string {
  return type.split(':')[0];
}

/**
 * Get the footprint for a furniture type string.
 * Falls back to { w: 1, h: 1 } (single-tile blocking) for unknown types,
 * which is the safe/conservative default.
 */
export function getFurnitureFootprint(type: string): FurnitureFootprint {
  const key = resolveFurnitureKey(type);
  return FURNITURE_FOOTPRINTS[key] ?? { w: 1, h: 1 };
}

/**
 * Apply furniture blocking onto an existing walkable grid (mutates in place).
 *
 * Only furniture with w > 0 && h > 0 contributes blocked cells.
 * Chairs (w:0, h:0) are skipped entirely — their tiles remain walkable.
 *
 * @param grid    - WalkableGrid from buildWalkableGrid()
 * @param items   - FurnitureItem[] from OfficeLayout
 */
export function applyFurnitureBlocking(
  grid: boolean[][],
  items: { type: string; col: number; row: number }[]
): void {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (const item of items) {
    const fp = getFurnitureFootprint(item.type);

    // Non-blocking furniture (chairs, small plants) — skip
    if (fp.w === 0 || fp.h === 0) continue;

    // Mark each tile in the footprint rect as non-walkable
    for (let dr = 0; dr < fp.h; dr++) {
      for (let dc = 0; dc < fp.w; dc++) {
        const r = item.row + dr;
        const c = item.col + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          grid[r][c] = false;
        }
      }
    }
  }
}
