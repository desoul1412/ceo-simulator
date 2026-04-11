import { describe, it, expect } from 'vitest';
import { buildWalkableGrid, bfsPath, validateReachability } from './pathfinding';
import {
  resolveFootprint,
  furnitureToBlockedCells,
  FURNITURE_FOOTPRINTS,
  type FurnitureItem,
} from './furnitureFootprints';

describe('buildWalkableGrid', () => {
  it('marks 255 (void) as not walkable', () => {
    const grid = buildWalkableGrid([255, 1, 0, 1], 2, 2);
    expect(grid[0][0]).toBe(false); // void
    expect(grid[0][1]).toBe(true);  // floor
    expect(grid[1][0]).toBe(false); // wall
    expect(grid[1][1]).toBe(true);  // floor
  });
});

describe('buildWalkableGrid — blockedCells overlay', () => {
  // 3×3 all-floor grid (tile id = 1 everywhere)
  const allFloor = Array(9).fill(1);

  it('without blockedCells all floor tiles remain walkable', () => {
    const grid = buildWalkableGrid(allFloor, 3, 3);
    expect(grid[1][1]).toBe(true);
  });

  it('marks a single furniture cell as non-walkable', () => {
    const grid = buildWalkableGrid(allFloor, 3, 3, [{ col: 1, row: 1 }]);
    expect(grid[1][1]).toBe(false);
    expect(grid[0][0]).toBe(true); // others unaffected
  });

  it('marks multiple cells from a 2×1 desk footprint', () => {
    const grid = buildWalkableGrid(allFloor, 3, 3, [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
    expect(grid[0][0]).toBe(false);
    expect(grid[0][1]).toBe(false);
    expect(grid[0][2]).toBe(true);
  });

  it('silently ignores out-of-bounds blocked cells', () => {
    // Should not throw
    const grid = buildWalkableGrid(allFloor, 3, 3, [
      { col: 99, row: 99 },
      { col: -1, row: 0 },
    ]);
    // All cells still walkable (nothing in bounds was blocked)
    expect(grid[0][0]).toBe(true);
    expect(grid[2][2]).toBe(true);
  });

  it('does not un-block a tile that was already a wall', () => {
    // tile 0 = wall at (0,0), add it to blocked too
    const grid = buildWalkableGrid([0, 1, 1, 1, 1, 1, 1, 1, 1], 3, 3, [
      { col: 0, row: 0 },
    ]);
    expect(grid[0][0]).toBe(false); // still false (was wall already)
  });
});

describe('furnitureFootprints', () => {
  it('chairs resolve to non-blocking footprint (w:0, h:0)', () => {
    expect(FURNITURE_FOOTPRINTS['CUSHIONED_CHAIR_FRONT']).toEqual({ w: 0, h: 0 });
    expect(FURNITURE_FOOTPRINTS['WOODEN_CHAIR_SIDE']).toEqual({ w: 0, h: 0 });
  });

  it('resolveFootprint handles variant suffix (:left)', () => {
    // DESK_SIDE:left → DESK_SIDE → {w:1, h:2}
    expect(resolveFootprint('DESK_SIDE:left')).toEqual({ w: 1, h: 2 });
    expect(resolveFootprint('WOODEN_CHAIR_SIDE:left')).toEqual({ w: 0, h: 0 });
  });

  it('resolveFootprint returns 1×1 safe fallback for unknown type', () => {
    expect(resolveFootprint('UNKNOWN_FUTURE_ITEM')).toEqual({ w: 1, h: 1 });
  });

  it('furnitureToBlockedCells excludes chair cells', () => {
    const items: FurnitureItem[] = [
      { uid: 'c1', type: 'CUSHIONED_CHAIR_FRONT', col: 4, row: 4 },
      { uid: 'c2', type: 'WOODEN_CHAIR_SIDE:left', col: 9, row: 13 },
    ];
    const cells = furnitureToBlockedCells(items);
    expect(cells).toHaveLength(0);
  });

  it('furnitureToBlockedCells returns correct cells for a 2×1 desk', () => {
    const items: FurnitureItem[] = [
      { uid: 'd1', type: 'DESK_FRONT', col: 3, row: 2 },
    ];
    const cells = furnitureToBlockedCells(items);
    expect(cells).toEqual([
      { col: 3, row: 2 },
      { col: 4, row: 2 },
    ]);
  });

  it('furnitureToBlockedCells returns correct cells for a 1×2 side desk', () => {
    const items: FurnitureItem[] = [
      { uid: 'd2', type: 'DESK_SIDE', col: 3, row: 12 },
    ];
    const cells = furnitureToBlockedCells(items);
    expect(cells).toEqual([
      { col: 3, row: 12 },
      { col: 3, row: 13 },
    ]);
  });

  it('furnitureToBlockedCells handles mixed blocking/non-blocking items', () => {
    const items: FurnitureItem[] = [
      { uid: 'desk', type: 'DESK_FRONT', col: 0, row: 0 },
      { uid: 'chair', type: 'CUSHIONED_CHAIR_FRONT', col: 1, row: 2 },
      { uid: 'clock', type: 'CLOCK', col: 6, row: 0 },
    ];
    const cells = furnitureToBlockedCells(items);
    // Only desk contributes (2 cells); chair and clock are non-blocking
    expect(cells).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
    ]);
  });

  it('integration: furniture cells block pathfinding', () => {
    // 5×5 all-floor grid; desk blocks col 2 row 0 and col 3 row 0
    const tiles = Array(25).fill(1);
    const items: FurnitureItem[] = [
      { uid: 'desk', type: 'DESK_FRONT', col: 2, row: 0 },
    ];
    const blockedCells = furnitureToBlockedCells(items);
    const grid = buildWalkableGrid(tiles, 5, 5, blockedCells);

    expect(grid[0][2]).toBe(false);
    expect(grid[0][3]).toBe(false);
    expect(grid[0][0]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateReachability
// ---------------------------------------------------------------------------

describe('validateReachability', () => {
  // Helper: build a WalkableGrid directly from a 2-D boolean array
  const g = (rows: boolean[][]): boolean[][] => rows;

  it('fully-connected open grid → reachable:true, no unreachable cells', () => {
    const grid = g(Array.from({ length: 4 }, () => Array(4).fill(true)));
    const result = validateReachability(grid, [0, 0]);
    expect(result.reachable).toBe(true);
    expect(result.unreachableCells).toHaveLength(0);
  });

  it('returns reachable:true when there are no walkable cells at all', () => {
    const grid = g([[false, false], [false, false]]);
    const result = validateReachability(grid, [0, 0]);
    expect(result.reachable).toBe(true);
    expect(result.unreachableCells).toHaveLength(0);
  });

  it('returns reachable:true for an empty grid', () => {
    const result = validateReachability([], [0, 0]);
    expect(result.reachable).toBe(true);
  });

  it('detects a single isolated walkable cell', () => {
    /*
     *  T F T
     *  F F F
     *  T F T
     *
     *  Corners are walkable but not connected to each other (all edges are walls).
     *  Start at top-left [col=0, row=0]; only that cell is "visited".
     */
    const grid = g([
      [true, false, true],
      [false, false, false],
      [true, false, true],
    ]);
    const result = validateReachability(grid, [0, 0]);
    expect(result.reachable).toBe(false);
    // Three other walkable corners are unreachable
    expect(result.unreachableCells).toHaveLength(3);
    // Check one of them is present
    expect(result.unreachableCells).toContainEqual([2, 0]);
  });

  it('detects an island cut off by a wall of furniture', () => {
    /*
     *  5×5 grid; column 2 is a wall → left side (col 0-1) and right side (col 3-4)
     *  are isolated from each other.
     *  Start on the left; right side cells are unreachable.
     */
    const grid: boolean[][] = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (__, c) => c !== 2),
    );
    const result = validateReachability(grid, [0, 0]);
    expect(result.reachable).toBe(false);
    // Right side: col 3 and 4 for every row → 10 cells
    expect(result.unreachableCells).toHaveLength(10);
    result.unreachableCells.forEach(([c]) => expect(c).toBeGreaterThanOrEqual(3));
  });

  it('when start is non-walkable all walkable cells are unreachable', () => {
    const grid = g([[true, true], [true, true]]);
    const result = validateReachability(grid, [0, 0]); // (0,0) is walkable, use a wall
    // Make start a wall: rebuild with top-left as wall
    const walledGrid = g([[false, true], [true, true]]);
    const r2 = validateReachability(walledGrid, [0, 0]);
    expect(r2.reachable).toBe(false);
    expect(r2.unreachableCells).toHaveLength(3); // the three remaining walkable cells
  });

  it('when start is out-of-bounds all walkable cells are unreachable', () => {
    const grid = g([[true, true], [true, true]]);
    const result = validateReachability(grid, [99, 99]);
    expect(result.reachable).toBe(false);
    expect(result.unreachableCells).toHaveLength(4);
  });

  it('integration: office layout with furniture island', () => {
    // 5×5 floor; a ring of desks blocks off the center cell
    const tiles = Array(25).fill(1);
    const blockedCells = [
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 3, row: 2 },
      { col: 2, row: 3 },
    ];
    const grid = buildWalkableGrid(tiles, 5, 5, blockedCells);
    const result = validateReachability(grid, [0, 0]);
    expect(result.reachable).toBe(false);
    expect(result.unreachableCells).toContainEqual([2, 2]); // center is isolated
  });
});

describe('bfsPath', () => {
  // Simple 5x5 grid, all walkable
  const open: boolean[][] = Array.from({ length: 5 }, () => Array(5).fill(true));

  it('returns single-element path for same start/end', () => {
    const path = bfsPath(open, [2, 2], [2, 2]);
    expect(path).toEqual([[2, 2]]);
  });

  it('finds a path between two points', () => {
    const path = bfsPath(open, [0, 0], [4, 4]);
    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([4, 4]);
  });

  it('returns shortest path (Manhattan distance)', () => {
    const path = bfsPath(open, [0, 0], [3, 0]);
    // BFS on grid = Manhattan distance + 1 (includes start)
    expect(path.length).toBe(4);
  });

  it('navigates around walls', () => {
    // Wall in the middle
    const walled = open.map(row => [...row]);
    walled[1][1] = false;
    walled[1][2] = false;
    walled[1][3] = false;

    const path = bfsPath(walled, [0, 0], [0, 2]);
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual([0, 2]);
    // Should go around the wall (longer than direct 3-step path)
    expect(path.length).toBeGreaterThanOrEqual(3);
  });

  it('returns empty array when no path exists', () => {
    // Completely walled off target
    const blocked: boolean[][] = [
      [true, false, true],
      [false, false, false],
      [true, false, true],
    ];
    const path = bfsPath(blocked, [0, 0], [2, 2]);
    expect(path).toEqual([]);
  });

  it('returns empty when target is a wall', () => {
    const path = bfsPath([[true, false], [true, true]], [0, 0], [1, 0]);
    expect(path).toEqual([]);
  });
});
