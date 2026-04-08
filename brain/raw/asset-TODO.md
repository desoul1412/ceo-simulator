---
tags: [assets, todo, raw]
date: 2026-04-08
status: draft
---

# Asset TODO — PNG Generation Queue

`game-assets` MCP was not available at time of writing.
SVG placeholders have been generated at the paths below.
Replace with final PNG assets when MCP / external tool is available.

## Queue

| Priority | Prompt                                                                      | Target Path                              | Status      |
|----------|-----------------------------------------------------------------------------|------------------------------------------|-------------|
| HIGH     | "32x32 pixel art dark sci-fi server room floor tile"                        | `public/assets/tiles/server-floor.png`  | SVG placeholder exists |
| HIGH     | "32x32 pixel art cyberpunk computer desk top-down view"                     | `public/assets/tiles/desk.png`          | SVG placeholder exists |
| HIGH     | "32x32 pixel art cyborg worker walking animation sprite sheet (4 frames), transparent background" | `public/assets/sprites/agent-1.png` | SVG placeholder exists |
| MED      | "16x16 pixel art neon floor indicator dot, cyan glow"                       | `public/assets/tiles/indicator.png`     | Not started |
| MED      | "32x32 pixel art kitchen counter top-down, sci-fi canteen"                  | `public/assets/tiles/kitchen.png`       | Not started |
| MED      | "32x32 pixel art meeting table top-down, holographic display"               | `public/assets/tiles/meeting.png`       | Not started |

## How to replace

1. Generate PNG with tool of choice (MidJourney, Stable Diffusion, game-assets MCP)
2. Drop file at target path (overwrite SVG or add as `.png`)
3. Update `src/components/OfficeFloorPlan.tsx` — change the `src` references from `.svg` to `.png`
4. For `agent-1.png`: enable the sprite sheet CSS animation in `AgentSprite.tsx` (see [[Office-Simulator-Architecture]])
