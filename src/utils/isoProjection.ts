/** Tile dimensions for the isometric grid */
export const TILE_W = 64;
export const TILE_H = 64;

/** Grid dimensions */
export const GRID_COLS = 8;
export const GRID_ROWS = 6;

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

      // CEO corner — top-left
      if (col <= 1 && row <= 1) zone = 'ceo-desk';
      // PM — top-right
      else if (col >= 5 && row <= 1) zone = 'pm-desk';
      // DevOps — mid-left
      else if (col <= 1 && row >= 2 && row <= 3) zone = 'devops-desk';
      // Frontend — mid-right
      else if (col >= 5 && row >= 2 && row <= 3) zone = 'frontend-desk';
      // Meeting — center
      else if (col >= 3 && col <= 4 && row >= 2 && row <= 3) zone = 'meeting';
      // Kitchen — bottom-right
      else if (col >= 6 && row >= 4) zone = 'kitchen';

      tiles.push({ col, row, zone });
    }
  }

  return tiles;
}

/** Desk coordinates for each role */
export const ROLE_DESKS: Record<string, { col: number; row: number }> = {
  CEO:      { col: 0, row: 0 },
  PM:       { col: 6, row: 0 },
  DevOps:   { col: 0, row: 2 },
  Frontend: { col: 6, row: 2 },
};

/** Idle wandering positions */
export const IDLE_POSITIONS = [
  { col: 2, row: 1 },
  { col: 3, row: 4 },
  { col: 5, row: 5 },
  { col: 1, row: 4 },
  { col: 4, row: 1 },
  { col: 7, row: 4 },
];

/** Meeting positions */
export const MEETING_POSITIONS = [
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 3, row: 3 },
  { col: 4, row: 3 },
];

/** Kitchen positions */
export const KITCHEN_POSITIONS = [
  { col: 6, row: 4 },
  { col: 7, row: 4 },
  { col: 6, row: 5 },
  { col: 7, row: 5 },
];

/** Sort entities by isometric depth (painter's algorithm) */
export function sortByDepth<T extends { col: number; row: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.col + a.row) - (b.col + b.row));
}
