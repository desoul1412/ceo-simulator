/** Tile dimensions for the pixel-art grid */
export const TILE_W = 16;
export const TILE_H = 16;

/** Grid dimensions (matches default-layout-1.json) */
export const GRID_COLS = 30;
export const GRID_ROWS = 22;

/** Zone definitions — map tile coords to zone types */
export type ZoneType = 'floor' | 'ceo-desk' | 'pm-desk' | 'devops-desk' | 'frontend-desk' | 'meeting' | 'kitchen';

export interface TileDef {
  col: number;
  row: number;
  zone: ZoneType;
}

/** Build the office tile map */
export function buildOfficeGrid(): TileDef[] {
  const tiles: TileDef[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      let zone: ZoneType = 'floor';
      // CEO room (top-left)
      if (col >= 1 && col <= 13 && row >= 1 && row <= 9) zone = 'ceo-desk';
      // PM room (top-right)
      else if (col >= 15 && col <= 28 && row >= 1 && row <= 9) zone = 'pm-desk';
      // DevOps room (bottom-left)
      else if (col >= 1 && col <= 13 && row >= 11 && row <= 20) zone = 'devops-desk';
      // Lounge (bottom-right)
      else if (col >= 15 && col <= 28 && row >= 11 && row <= 20) zone = 'kitchen';
      tiles.push({ col, row, zone });
    }
  }
  return tiles;
}

/** Desk coordinates for each role (matches new 30x22 layout) */
export const ROLE_DESKS: Record<string, { col: number; row: number }> = {
  CEO:            { col: 4, row: 3 },
  PM:             { col: 18, row: 3 },
  Frontend:       { col: 9, row: 3 },
  Backend:        { col: 24, row: 3 },
  DevOps:         { col: 4, row: 14 },
  QA:             { col: 9, row: 14 },
  Marketer:       { col: 18, row: 14 },
  'Content Writer': { col: 22, row: 14 },
  Sales:          { col: 24, row: 14 },
  Operations:     { col: 6, row: 17 },
};

/** Idle wandering positions (lounge area, bottom-right) */
export const IDLE_POSITIONS = [
  { col: 20, row: 15 },
  { col: 22, row: 14 },
  { col: 24, row: 16 },
  { col: 17, row: 15 },
  { col: 19, row: 17 },
  { col: 25, row: 18 },
];

/** Meeting positions (CEO room center) */
export const MEETING_POSITIONS = [
  { col: 7, row: 6 },
  { col: 6, row: 7 },
  { col: 8, row: 7 },
  { col: 7, row: 8 },
];

/** Kitchen / break positions (lounge sofas) */
export const KITCHEN_POSITIONS = [
  { col: 21, row: 14 },
  { col: 21, row: 16 },
  { col: 19, row: 15 },
  { col: 23, row: 15 },
];

/** Sort entities by depth (painter's algorithm) */
export function sortByDepth<T extends { col: number; row: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.col + a.row) - (b.col + b.row));
}
