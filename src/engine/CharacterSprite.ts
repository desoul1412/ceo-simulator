/**
 * CharacterSprite — animated character with state machine using Modern tiles spritesheets.
 *
 * Uses SpriteAtlas data to render characters from the Modern tiles character sheets.
 * Supports animation states: idle, walk, run, sit, phone — mapped from agent DB status.
 */

import {
  type CharacterName,
  type AnimState,
  type Direction,
  CHARACTER_ATLASES,
  ROLE_CHARACTER_MAP,
  statusToAnimState,
  preloadImage,
} from './SpriteAtlas';

export interface CharacterSpriteState {
  id: string;
  character: CharacterName;
  animState: AnimState;
  direction: Direction;
  frameIndex: number;
  frameTick: number;         // accumulated ms since last frame change
  pixelX: number;
  pixelY: number;
  label: string;
  labelColor: string;
  speechBubble: string | null;
  heartbeat: 'alive' | 'stale' | 'dead';
}

export function createCharacterSprite(
  id: string,
  role: string,
  pixelX: number,
  pixelY: number,
  label: string,
  labelColor: string,
): CharacterSpriteState {
  return {
    id,
    character: ROLE_CHARACTER_MAP[role] ?? 'Adam',
    animState: 'idle',
    direction: 'down',
    frameIndex: 0,
    frameTick: 0,
    pixelX,
    pixelY,
    label,
    labelColor,
    speechBubble: null,
    heartbeat: 'alive',
  };
}

export function updateSpriteAnimation(sprite: CharacterSpriteState, dtMs: number): void {
  const atlas = CHARACTER_ATLASES[sprite.character];
  const seq = atlas.animations[sprite.animState]?.[sprite.direction];
  if (!seq) return;

  sprite.frameTick += dtMs;
  if (sprite.frameTick >= seq.frameDuration) {
    sprite.frameTick -= seq.frameDuration;
    if (seq.loop) {
      sprite.frameIndex = (sprite.frameIndex + 1) % seq.frames.length;
    } else if (sprite.frameIndex < seq.frames.length - 1) {
      sprite.frameIndex++;
    }
  }
}

export function setSpriteState(sprite: CharacterSpriteState, dbStatus: string, isWalking: boolean): void {
  const newState: AnimState = isWalking ? 'walk' : statusToAnimState(dbStatus);
  if (newState !== sprite.animState) {
    sprite.animState = newState;
    sprite.frameIndex = 0;
    sprite.frameTick = 0;
  }
}

// Image cache for rendering
const sheetCache = new Map<string, HTMLImageElement>();

async function getSheet(src: string): Promise<HTMLImageElement | null> {
  const cached = sheetCache.get(src);
  if (cached) return cached;
  try {
    const img = await preloadImage(src);
    sheetCache.set(src, img);
    return img;
  } catch {
    return null;
  }
}

/**
 * Render a character sprite onto a canvas context.
 * Must be called after sheets are preloaded (use preloadCharacter/preloadAllCharacters).
 */
export function renderCharacterSprite(
  ctx: CanvasRenderingContext2D,
  sprite: CharacterSpriteState,
): void {
  const atlas = CHARACTER_ATLASES[sprite.character];
  const seq = atlas.animations[sprite.animState]?.[sprite.direction];
  if (!seq) return;

  const frame = seq.frames[sprite.frameIndex % seq.frames.length];
  if (!frame) return;

  // Try to get cached image synchronously
  const img = sheetCache.get(seq.sheet);
  if (!img) {
    // Trigger async load for next frame
    getSheet(seq.sheet);
    return;
  }

  // Character frames are 16x32 — draw so feet align with tile position
  const drawX = Math.round(sprite.pixelX);
  const drawY = Math.round(sprite.pixelY - (frame.h - 16)); // offset so feet at tile

  ctx.drawImage(
    img,
    frame.x, frame.y, frame.w, frame.h,
    drawX, drawY, frame.w, frame.h,
  );

  // Role label above head
  if (sprite.label) {
    ctx.save();
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = sprite.labelColor;
    ctx.shadowColor = sprite.labelColor;
    ctx.shadowBlur = 3;
    ctx.fillText(sprite.label, drawX + frame.w / 2, drawY - 3);
    ctx.restore();
  }

  // Status indicator dot
  const indicatorX = drawX + frame.w / 2 + 8;
  const indicatorY = drawY - 1;
  ctx.save();
  if (sprite.heartbeat === 'alive' && sprite.animState !== 'idle') {
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 3;
  } else if (sprite.heartbeat === 'stale') {
    ctx.fillStyle = '#ff8800';
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 2;
  } else if (sprite.heartbeat === 'dead') {
    ctx.fillStyle = '#ff2244';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 2;
  } else {
    ctx.fillStyle = '#4a5568';
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.arc(indicatorX, indicatorY, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Speech bubble
  if (sprite.speechBubble) {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.font = '7px monospace';
    const text = sprite.speechBubble.length > 16
      ? sprite.speechBubble.slice(0, 14) + '..'
      : sprite.speechBubble;
    const metrics = ctx.measureText(text);
    const bw = Math.ceil(metrics.width) + 8;
    const bh = 11;
    const bx = Math.round(drawX + frame.w / 2 - bw / 2);
    const by = Math.round(drawY - bh - 6);

    ctx.fillStyle = '#050810';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

    ctx.fillStyle = '#e0eaf4';
    ctx.textAlign = 'center';
    ctx.fillText(text, Math.round(drawX + frame.w / 2), by + 8);
    ctx.restore();
  }
}
