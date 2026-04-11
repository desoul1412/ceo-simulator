import { describe, it, expect } from 'vitest';
import {
  buildOfficeGrid,
  sortByDepth,
  GRID_COLS,
  GRID_ROWS,
  ROLE_DESKS,
} from './isoProjection';

describe('buildOfficeGrid', () => {
  const tiles = buildOfficeGrid();

  it('produces GRID_COLS × GRID_ROWS tiles', () => {
    expect(tiles).toHaveLength(GRID_COLS * GRID_ROWS);
  });

  it('every tile has a valid zone type', () => {
    const validZones = new Set([
      'floor', 'ceo-desk', 'pm-desk', 'devops-desk',
      'frontend-desk', 'meeting', 'kitchen',
    ]);
    tiles.forEach(t => expect(validZones.has(t.zone)).toBe(true));
  });

  it('CEO desk zone exists in the grid', () => {
    const ceoDeskTiles = tiles.filter(t => t.zone === 'ceo-desk');
    expect(ceoDeskTiles.length).toBeGreaterThanOrEqual(1);
  });
});

describe('sortByDepth', () => {
  it('sorts by col + row ascending (painter\'s algorithm)', () => {
    const items = [
      { col: 5, row: 3 },
      { col: 0, row: 0 },
      { col: 2, row: 1 },
    ];
    const sorted = sortByDepth(items);
    expect(sorted[0]).toEqual({ col: 0, row: 0 }); // depth 0
    expect(sorted[1]).toEqual({ col: 2, row: 1 }); // depth 3
    expect(sorted[2]).toEqual({ col: 5, row: 3 }); // depth 8
  });

  it('does not mutate the original array', () => {
    const items = [{ col: 3, row: 2 }, { col: 0, row: 0 }];
    const original = [...items];
    sortByDepth(items);
    expect(items).toEqual(original);
  });
});

describe('ROLE_DESKS', () => {
  it('defines desk positions for all 4 roles', () => {
    expect(ROLE_DESKS).toHaveProperty('CEO');
    expect(ROLE_DESKS).toHaveProperty('PM');
    expect(ROLE_DESKS).toHaveProperty('DevOps');
    expect(ROLE_DESKS).toHaveProperty('Frontend');
  });

  it('all desk positions are within grid bounds', () => {
    Object.values(ROLE_DESKS).forEach(pos => {
      expect(pos.col).toBeGreaterThanOrEqual(0);
      expect(pos.col).toBeLessThan(GRID_COLS);
      expect(pos.row).toBeGreaterThanOrEqual(0);
      expect(pos.row).toBeLessThan(GRID_ROWS);
    });
  });
});
