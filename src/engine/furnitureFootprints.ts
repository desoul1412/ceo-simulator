/**
 * Furniture footprint registry — defines which tile cells are blocked
 * (non-walkable) for each furniture type.
 *
 * Decision (Task 2.5 — Liam Chen PM):
 *   Chairs (CUSHIONED_CHAIR_*, WOODEN_CHAIR_*) are NON-BLOCKING (w:0, h:0)
 *   because they represent agent seats. Marking them non-walkable would trap
 *   agents at their own desks.
 *
 * Footprint = {w, h} where the blocked region is:
 *   col .. col+w-1,  row .. row+h-1
 * A footprint of {w:0, h:0} means the item occupies no walkable tiles.
 */

export interface FurnitureFootprint {
  /** Number of columns blocked (0 = non-blocking) */
  w: number;
  /** Number of rows blocked (0 = non-blocking) */
  h: number;
}

export interface FurnitureItem {
  uid: string;
  type: string;
  col: number;
  row: number;
}

export interface BlockedCell {
  col: number;
  row: number;
}

/**
 * Footprint lookup by furniture type.
 * Keys are matched with startsWith() so variants like "DESK_SIDE:left"
 * correctly resolve to "DESK_SIDE".
 */
export const FURNITURE_FOOTPRINTS: Record<string, FurnitureFootprint> = {
  // ── Desks ─────────────────────────────────────────────────────────────────
  DESK_FRONT: { w: 2, h: 1 },
  DESK_SIDE:  { w: 1, h: 2 },

  // ── PCs / monitors ────────────────────────────────────────────────────────
  PC_FRONT_OFF: { w: 1, h: 1 },
  PC_FRONT_ON:  { w: 1, h: 1 },
  PC_SIDE:      { w: 1, h: 1 },

  // ── Chairs — NON-BLOCKING (Task 2.5 decision) ─────────────────────────────
  CUSHIONED_CHAIR_FRONT: { w: 0, h: 0 },
  CUSHIONED_CHAIR_BACK:  { w: 0, h: 0 },
  CUSHIONED_CHAIR_SIDE:  { w: 0, h: 0 },
  WOODEN_CHAIR_FRONT:    { w: 0, h: 0 },
  WOODEN_CHAIR_BACK:     { w: 0, h: 0 },
  WOODEN_CHAIR_SIDE:     { w: 0, h: 0 },

  // ── Sofas ─────────────────────────────────────────────────────────────────
  SOFA_FRONT: { w: 2, h: 1 },
  SOFA_BACK:  { w: 2, h: 1 },
  SOFA_SIDE:  { w: 1, h: 2 },

  // ── Tables ────────────────────────────────────────────────────────────────
  COFFEE_TABLE:       { w: 2, h: 2 },
  SMALL_TABLE_FRONT:  { w: 1, h: 1 },
  MEETING_TABLE:      { w: 4, h: 2 },

  // ── Storage / decor ───────────────────────────────────────────────────────
  DOUBLE_BOOKSHELF: { w: 2, h: 1 },
  BOOKSHELF:        { w: 1, h: 1 },
  WHITEBOARD:       { w: 2, h: 1 },
  SERVER_RACK:      { w: 1, h: 2 },
  LARGE_PLANT:      { w: 1, h: 1 },
  PLANT:            { w: 1, h: 1 },
  PLANT_2:          { w: 1, h: 1 },
  BIN:              { w: 1, h: 1 },

  // ── Wall-mounted / zero-footprint items ───────────────────────────────────
  CLOCK:             { w: 0, h: 0 },
  LARGE_PAINTING:    { w: 0, h: 0 },
  SMALL_PAINTING:    { w: 0, h: 0 },
  SMALL_PAINTING_2:  { w: 0, h: 0 },
  COFFEE:            { w: 0, h: 0 },
};

/**
 * Resolve the footprint for a furniture type, handling variant suffixes
 * (e.g. "DESK_SIDE:left" → "DESK_SIDE", "WOODEN_CHAIR_SIDE:left" → "WOODEN_CHAIR_SIDE").
 */
export function resolveFootprint(type: string): FurnitureFootprint {
  // Exact match first
  if (FURNITURE_FOOTPRINTS[type]) return FURNITURE_FOOTPRINTS[type];

  // Strip variant suffix (e.g. ":left")
  const base = type.split(':')[0];
  if (FURNITURE_FOOTPRINTS[base]) return FURNITURE_FOOTPRINTS[base];

  // Unknown furniture — default to 1×1 blocked (safe fallback)
  return { w: 1, h: 1 };
}

/**
 * Convert a list of placed furniture items into an array of blocked tile cells
 * using the footprint registry. Cells from non-blocking items (w=0 or h=0)
 * are excluded.
 *
 * @param furniture  Array of placed furniture from the layout JSON
 * @returns          Array of {col, row} cells that should be non-walkable
 */
export function furnitureToBlockedCells(furniture: FurnitureItem[]): BlockedCell[] {
  const cells: BlockedCell[] = [];

  for (const item of furniture) {
    const fp = resolveFootprint(item.type);
    if (fp.w === 0 || fp.h === 0) continue; // non-blocking

    for (let dr = 0; dr < fp.h; dr++) {
      for (let dc = 0; dc < fp.w; dc++) {
        cells.push({ col: item.col + dc, row: item.row + dr });
      }
    }
  }

  return cells;
}
