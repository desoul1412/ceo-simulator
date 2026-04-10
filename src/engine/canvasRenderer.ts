/**
 * Canvas 2D rendering functions for the pixel-art office.
 * Matches pixel-agents asset format: 16px tiles, 16×32 character frames.
 */

import type { LoadedAssets } from './assetLoader';

// ── Constants (matching pixel-agents) ────────────────────────────────────────

export const TILE_SIZE = 16;
export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 32;
export const CHAR_FRAMES_PER_ROW = 7;

// Character directions in sprite sheet row order
export const CHAR_DIRECTIONS = ['down', 'up', 'right'] as const;
export type CharDirection = typeof CHAR_DIRECTIONS[number];

// ── Layout types ─────────────────────────────────────────────────────────────

export interface OfficeLayout {
  cols: number;
  rows: number;
  tiles: number[];        // flat array, 255=void, 0=wall, 1-9=floor type
  furniture: FurnitureItem[];
}

export interface FurnitureItem {
  uid: string;
  type: string;           // e.g. "DESK_FRONT", "PC_FRONT_OFF", "SOFA_SIDE:left"
  col: number;
  row: number;
}

export interface CharacterRenderState {
  id: string;
  charIndex: number;      // 0-5 → which sprite sheet
  pixelX: number;         // current interpolated pixel X
  pixelY: number;         // current interpolated pixel Y
  direction: CharDirection;
  frameIndex: number;     // 0-6 animation frame
  isWalking: boolean;
  label: string;          // role name shown above
  labelColor: string;     // role neon color
  speechBubble: string | null;
  heartbeat: 'alive' | 'stale' | 'dead';
}

// ── HSB Color Application ────────────────────────────────────────────────────

interface TileColor {
  h: number;
  s: number;
  b: number;
  c: number;
}

/**
 * Apply HSB color shift to a tile by drawing the floor tile,
 * then overlaying a colored rect with multiply blend.
 * Simplified: we use the hue to pick a CSS hsl color overlay.
 */
function hsbToRgba(tc: TileColor): string {
  // Map HSB-style adjustments to a usable overlay color
  const h = ((tc.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, 50 + tc.s));
  const l = Math.max(5, Math.min(85, 50 + tc.b / 2));
  const a = Math.max(0.1, Math.min(0.6, 0.3 + Math.abs(tc.c) / 200));
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// ── Render Functions ─────────────────────────────────────────────────────────

export function renderTiles(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  assets: LoadedAssets,
  tileColors?: (TileColor | null)[]
) {
  const { cols, rows, tiles } = layout;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const tileType = tiles[idx];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      if (tileType === 255) continue; // void

      if (tileType === 0) {
        // Wall — draw dark rect (simplified, proper bitmask walls in future)
        ctx.fillStyle = '#1a1e2e';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        // Wall top edge highlight
        ctx.fillStyle = '#2a3040';
        ctx.fillRect(x, y, TILE_SIZE, 1);
        continue;
      }

      // Floor tile (1-9 → floor_1..floor_8, fallback to floor_0)
      const floorIdx = Math.min(tileType, assets.floors.length - 1);
      const floorImg = assets.floors[floorIdx];
      if (floorImg) {
        ctx.drawImage(floorImg, x, y, TILE_SIZE, TILE_SIZE);
      }

      // Apply tile color overlay if present
      if (tileColors) {
        const tc = tileColors[idx];
        if (tc) {
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = hsbToRgba(tc);
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
  }
}

export function renderFurniture(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureItem[],
  assets: LoadedAssets
) {
  for (const item of furniture) {
    // Resolve asset name: "PC_SIDE:left" → key="PC_SIDE", mirror=true
    const [assetKey, modifier] = item.type.split(':');
    const img = assets.furniture.get(assetKey);
    if (!img) continue;

    const x = item.col * TILE_SIZE;
    const y = item.row * TILE_SIZE;

    if (modifier === 'left') {
      // Mirror horizontally
      ctx.save();
      ctx.translate(x + img.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y);
    }
  }
}

export function renderCharacter(
  ctx: CanvasRenderingContext2D,
  char: CharacterRenderState,
  assets: LoadedAssets
) {
  const sheet = assets.characters[char.charIndex % assets.characters.length];
  if (!sheet) return;

  // Frame selection from sprite sheet
  // Rows: 0=down, 1=up, 2=right
  let dirRow = CHAR_DIRECTIONS.indexOf(char.direction);
  let mirror = false;
  if (char.direction === 'left' as string) {
    dirRow = 2; // use 'right' row
    mirror = true;
  }
  if (dirRow < 0) dirRow = 0;

  const frame = char.isWalking ? (char.frameIndex % CHAR_FRAMES_PER_ROW) : 0;
  const sx = frame * CHAR_FRAME_W;
  const sy = dirRow * CHAR_FRAME_H;

  // Draw character — offset Y by -CHAR_FRAME_H + TILE_SIZE so feet align with tile
  const drawX = Math.round(char.pixelX);
  const drawY = Math.round(char.pixelY - (CHAR_FRAME_H - TILE_SIZE));

  ctx.save();
  if (mirror) {
    ctx.translate(drawX + CHAR_FRAME_W, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, 0, 0, CHAR_FRAME_W, CHAR_FRAME_H);
  } else {
    ctx.drawImage(sheet, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, drawX, drawY, CHAR_FRAME_W, CHAR_FRAME_H);
  }
  ctx.restore();

  // Role label above head
  if (char.label) {
    ctx.save();
    ctx.font = '4px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = char.labelColor;
    ctx.shadowColor = char.labelColor;
    ctx.shadowBlur = 2;
    ctx.fillText(char.label, drawX + CHAR_FRAME_W / 2, drawY - 2);
    ctx.restore();
  }
}

export function renderSpeechBubble(
  ctx: CanvasRenderingContext2D,
  char: CharacterRenderState
) {
  if (!char.speechBubble) return;

  const drawX = Math.round(char.pixelX);
  const drawY = Math.round(char.pixelY - (CHAR_FRAME_H - TILE_SIZE));

  ctx.save();
  ctx.font = '3px monospace';
  const text = char.speechBubble.length > 20
    ? char.speechBubble.slice(0, 18) + '..'
    : char.speechBubble;
  const metrics = ctx.measureText(text);
  const bw = metrics.width + 4;
  const bh = 7;
  const bx = drawX + CHAR_FRAME_W / 2 - bw / 2;
  const by = drawY - bh - 4;

  // Bubble background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, by, bw, bh);

  // Text
  ctx.fillStyle = '#e0eaf4';
  ctx.textAlign = 'center';
  ctx.fillText(text, drawX + CHAR_FRAME_W / 2, by + 5);
  ctx.restore();
}

/** Full frame render */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  characters: CharacterRenderState[],
  assets: LoadedAssets,
  tileColors?: (TileColor | null)[]
) {
  const w = layout.cols * TILE_SIZE;
  const h = layout.rows * TILE_SIZE;

  // Clear
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, w, h);

  // Tiles
  renderTiles(ctx, layout, assets, tileColors);

  // Furniture (behind characters)
  renderFurniture(ctx, layout.furniture, assets);

  // Characters sorted by Y (painter's algorithm)
  const sorted = [...characters].sort((a, b) => a.pixelY - b.pixelY);
  for (const char of sorted) {
    renderCharacter(ctx, char, assets);
  }

  // Speech bubbles on top
  for (const char of sorted) {
    renderSpeechBubble(ctx, char);
  }
}
