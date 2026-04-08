---
tags: [assets, todo, raw]
date: 2026-04-08
status: active
---

# Asset TODO — PNG Generation Queue

All HIGH priority assets generated via HuggingFace FLUX.1-schnell (router API).
`game-assets` MCP registered in `.claude/settings.json` — restart Claude Code to activate.

## Queue

| Priority | Prompt                                                                      | Target Path                              | Status    |
|----------|-----------------------------------------------------------------------------|------------------------------------------|-----------|
| HIGH     | "32x32 pixel art dark sci-fi server room floor tile"                        | `public/assets/tiles/server-floor.png`  | ✅ Done   |
| HIGH     | "32x32 pixel art cyberpunk computer desk top-down view"                     | `public/assets/tiles/desk.png`          | ✅ Done   |
| HIGH     | "32x32 pixel art cyborg worker walking animation sprite sheet (4 frames), transparent background" | `public/assets/sprites/agent-1.png` | ✅ Done (128x32, 4 frames) |
| MED      | "16x16 pixel art neon floor indicator dot, cyan glow"                       | `public/assets/tiles/indicator.png`     | ✅ Done   |
| MED      | "32x32 pixel art kitchen counter top-down, sci-fi canteen"                  | `public/assets/tiles/kitchen.png`       | ✅ Done   |
| MED      | "32x32 pixel art meeting table top-down, holographic display"               | `public/assets/tiles/meeting.png`       | ✅ Done   |

## v2 Isometric Assets

| Priority | Prompt | Target Path | Status |
|----------|--------|-------------|--------|
| HIGH | "32x32 pixel art isometric office floor tile, light wood, seamless" | `public/assets/tiles/iso-floor.png` | ✅ Done (64×32) |
| HIGH | "32x32 pixel art isometric modern office desk with dual monitors" | `public/assets/tiles/iso-desk.png` | ✅ Done (64×64) |
| HIGH | "32x32 pixel art isometric character sprite, office worker, transparent background" | `public/assets/sprites/iso-worker-1.png` | ✅ Done (64×64) |
| MED | ISO wall segment (64×64) | `public/assets/iso-tiles/wall.png` | Not started |
| MED | ISO meeting table (128×64) | `public/assets/iso-tiles/meeting.png` | Not started |
| MED | ISO kitchen counter (64×64) | `public/assets/iso-tiles/kitchen.png` | Not started |
| MED | CEO sprite sheet 4-frame (256×64) | `public/assets/sprites/ceo.png` | Not started |
| MED | PM sprite sheet 4-frame (256×64) | `public/assets/sprites/pm.png` | Not started |
| MED | DevOps sprite sheet 4-frame (256×64) | `public/assets/sprites/devops.png` | Not started |
| MED | Frontend sprite sheet 4-frame (256×64) | `public/assets/sprites/frontend.png` | Not started |

## Notes

- Generated with `FLUX.1-schnell` at 256×256 then resized to target size with `PIL.Image.NEAREST`
- SVG placeholders retained alongside PNGs for fallback
- Sprite sheet `agent-1.png` is 128×32 (4 × 32px frames) — walk-cycle animation active in `AgentSprite.tsx`
- Regenerate with `game-assets` MCP (now registered) once Claude Code is restarted for higher fidelity
