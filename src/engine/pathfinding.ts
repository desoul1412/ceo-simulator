/** BFS pathfinding on a walkable tile grid */

import type { BlockedCell } from './furnitureFootprints';

export type WalkableGrid = boolean[][];  // true = walkable

/**
 * Build a walkable grid from flat tile data with an optional furniture overlay.
 *
 * @param tiles        Flat array of tile IDs (row-major). 255=void, 0=wall → not walkable.
 * @param cols         Number of columns in the grid.
 * @param rows         Number of rows in the grid.
 * @param blockedCells Optional list of furniture-occupied cells to mark non-walkable.
 *                     Produced by `furnitureToBlockedCells()` in furnitureFootprints.ts.
 *                     Out-of-bounds cells are silently ignored.
 *
 * @returns WalkableGrid  2D boolean array [row][col], true = agent can walk here.
 */
export function buildWalkableGrid(
  tiles: number[],
  cols: number,
  rows: number,
  blockedCells?: BlockedCell[]
): WalkableGrid {
  const grid: WalkableGrid = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const t = tiles[r * cols + c];
      row.push(t !== 255 && t !== 0); // walkable if not void and not wall
    }
    grid.push(row);
  }

  // Overlay furniture-blocked cells (if provided)
  if (blockedCells && blockedCells.length > 0) {
    for (const { col, row } of blockedCells) {
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        grid[row][col] = false;
      }
    }
  }

  return grid;
}

/** BFS from start to end, returns path as [col, row][] including start and end */
export function bfsPath(
  grid: WalkableGrid,
  start: [number, number],
  end: [number, number]
): [number, number][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const [sc, sr] = start;
  const [ec, er] = end;

  // Bounds check
  if (sr < 0 || sr >= rows || sc < 0 || sc >= cols) return [];
  if (er < 0 || er >= rows || ec < 0 || ec >= cols) return [];
  if (!grid[er][ec]) return []; // target not walkable

  if (sc === ec && sr === er) return [start];

  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const parent = new Map<string, string>();
  const key = (c: number, r: number) => `${c},${r}`;

  visited[sr][sc] = true;
  const queue: [number, number][] = [[sc, sr]];

  const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

  while (queue.length > 0) {
    const [cc, cr] = queue.shift()!;

    for (const [dc, dr] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;

      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      if (visited[nr][nc] || !grid[nr][nc]) continue;

      visited[nr][nc] = true;
      parent.set(key(nc, nr), key(cc, cr));

      if (nc === ec && nr === er) {
        // Reconstruct path
        const path: [number, number][] = [];
        let cur = key(ec, er);
        while (cur) {
          const [pc, pr] = cur.split(',').map(Number);
          path.unshift([pc, pr]);
          cur = parent.get(cur)!;
        }
        return path;
      }

      queue.push([nc, nr]);
    }
  }

  return []; // no path found
}
