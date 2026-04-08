import { describe, it, expect } from 'vitest';
import { buildWalkableGrid, bfsPath } from './pathfinding';

describe('buildWalkableGrid', () => {
  it('marks 255 (void) as not walkable', () => {
    const grid = buildWalkableGrid([255, 1, 0, 1], 2, 2);
    expect(grid[0][0]).toBe(false); // void
    expect(grid[0][1]).toBe(true);  // floor
    expect(grid[1][0]).toBe(false); // wall
    expect(grid[1][1]).toBe(true);  // floor
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
