/**
 * Sprite Atlas — metadata for Modern tiles character spritesheets.
 *
 * All character sprites are 16x16 px per tile, but each character frame
 * is 16 wide x 32 tall (head + body = 2 tiles stacked).
 *
 * Spritesheet layouts (all 16x16 base):
 *   {name}_idle_anim_16x16.png  — 384x32  → 24 frames × 1 row  (6 per direction: down/left/right/up)
 *   {name}_run_16x16.png        — 384x32  → 24 frames × 1 row  (6 per direction)
 *   {name}_sit_16x16.png        — 384x32  → 24 frames × 1 row  (6 per direction)
 *   {name}_sit2_16x16.png       — 384x32  → same
 *   {name}_sit3_16x16.png       — 384x32  → same
 *   {name}_phone_16x16.png      — 144x32  → 9 frames × 1 row
 *   {name}_16x16.png            — 384x224 → full walk sheet (7 rows)
 *
 * Available characters: Adam, Alex, Amelia, Bob
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type Direction = 'down' | 'left' | 'right' | 'up';
export type AnimState = 'idle' | 'walk' | 'run' | 'sit' | 'phone';
export type CharacterName = 'Adam' | 'Alex' | 'Amelia' | 'Bob';

export interface SpriteFrame {
  x: number;       // source X in spritesheet (px)
  y: number;       // source Y in spritesheet (px)
  w: number;       // frame width (px)
  h: number;       // frame height (px)
}

export interface AnimSequence {
  sheet: string;           // relative path to spritesheet
  frames: SpriteFrame[];   // ordered frames for this animation
  frameDuration: number;   // ms per frame
  loop: boolean;
}

export interface CharacterAtlas {
  name: CharacterName;
  animations: Record<AnimState, Record<Direction, AnimSequence>>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TILE = 16;
const FRAME_W = 16;
const FRAME_H = 32; // 2 tiles tall
const CHARS_PATH = '/assets/modern-tiles/Characters_free';
const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract frames from a single-row spritesheet with N frames per direction */
function extractDirectionalFrames(
  framesPerDir: number,
): Record<Direction, SpriteFrame[]> {
  const result = {} as Record<Direction, SpriteFrame[]>;
  DIRECTIONS.forEach((dir, dirIndex) => {
    const frames: SpriteFrame[] = [];
    for (let f = 0; f < framesPerDir; f++) {
      frames.push({
        x: (dirIndex * framesPerDir + f) * FRAME_W,
        y: 0,
        w: FRAME_W,
        h: FRAME_H,
      });
    }
    result[dir] = frames;
  });
  return result;
}

/** Build animation sequences for a character sheet file */
function buildSequences(
  name: CharacterName,
  state: string,
  framesPerDir: number,
  frameDuration: number,
  loop: boolean,
): Record<Direction, AnimSequence> {
  const sheet = `${CHARS_PATH}/${name}_${state}_16x16.png`;
  const dirFrames = extractDirectionalFrames(framesPerDir);
  const result = {} as Record<Direction, AnimSequence>;
  for (const dir of DIRECTIONS) {
    result[dir] = { sheet, frames: dirFrames[dir], frameDuration, loop };
  }
  return result;
}

// ── Character Atlas Builder ──────────────────────────────────────────────────

function buildCharacterAtlas(name: CharacterName): CharacterAtlas {
  return {
    name,
    animations: {
      idle: buildSequences(name, 'idle_anim', 6, 180, true),
      walk: buildSequences(name, 'run', 6, 120, true),  // use run sheet for walking
      run:  buildSequences(name, 'run', 6, 80, true),
      sit:  buildSequences(name, 'sit', 6, 200, true),
      phone: buildSequences(name, 'phone', 3, 250, true), // phone has fewer frames (9 total / ~3 per dir)
    },
  };
}

// ── Exported Atlases ─────────────────────────────────────────────────────────

export const CHARACTER_ATLASES: Record<CharacterName, CharacterAtlas> = {
  Adam:   buildCharacterAtlas('Adam'),
  Alex:   buildCharacterAtlas('Alex'),
  Amelia: buildCharacterAtlas('Amelia'),
  Bob:    buildCharacterAtlas('Bob'),
};

// ── Role → Character Mapping ─────────────────────────────────────────────────

/** Maps agent roles to RPG character sprites */
export const ROLE_CHARACTER_MAP: Record<string, CharacterName> = {
  // Engineering roles
  CEO:          'Bob',
  PM:           'Amelia',
  Frontend:     'Alex',
  Backend:      'Adam',
  DevOps:       'Adam',
  QA:           'Amelia',
  Designer:     'Alex',
  'Full-Stack': 'Adam',
  // Business roles
  Marketer:        'Amelia',
  'Content Writer': 'Alex',
  Sales:           'Bob',
  Operations:      'Bob',
  // Data & AI roles
  'Data Architect':  'Adam',
  'Data Scientist':  'Amelia',
  'AI Engineer':     'Alex',
  Automation:        'Adam',
};

/** Maps agent DB status to sprite animation state */
export function statusToAnimState(status: string): AnimState {
  switch (status) {
    case 'working':   return 'sit';
    case 'break':     return 'idle';
    case 'idle':      return 'idle';
    case 'paused':    return 'phone';
    case 'throttled': return 'phone';
    default:          return 'idle';
  }
}

// ── Tile Atlas (Room Builder + Interiors) ────────────────────────────────────

export const TILESET_PATHS = {
  roomBuilder: '/assets/modern-tiles/Interiors_free/32x32/Room_Builder_free_32x32.png',
  interiors:   '/assets/modern-tiles/Interiors_free/32x32/Interiors_free_32x32.png',
  deskEssentials: '/assets/desk-essentials/spritesheet.png',
} as const;

export const TILE_SIZE = TILE;
export const RENDER_TILE_SIZE = 32; // render at 2x for crisp pixels

// ── Image Preloader ──────────────────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

/** Preload all character spritesheets for a given character */
export async function preloadCharacter(name: CharacterName): Promise<void> {
  const atlas = CHARACTER_ATLASES[name];
  const sheets = new Set<string>();
  for (const stateAnims of Object.values(atlas.animations)) {
    for (const seq of Object.values(stateAnims)) {
      sheets.add(seq.sheet);
    }
  }
  await Promise.all([...sheets].map(preloadImage));
}

/** Preload all characters used by current agent roles */
export async function preloadAllCharacters(): Promise<void> {
  const names = new Set(Object.values(ROLE_CHARACTER_MAP));
  await Promise.all([...names].map(preloadCharacter));
}
