---
tags: [index, meta]
date: 2026-04-08
status: active
---

# CEO Simulator — Master Index

## Architecture
- [[UI-Design-System]] — Pixel Art / HUD design tokens, color system, component rules
- [[Office-Simulator-Architecture]] — CSS Grid layout, state management, animation strategy
- [[Architecture]] — System overview, component tree, data flow (stub)

## Features
- [x] `<OfficeFloorPlan />` — 15×15 CSS Grid office map with wall/desk/meeting/kitchen zones
- [x] `<AgentSprite />` — Absolutely-positioned agents with smooth CSS transition movement
- [x] `<HudPanel />` — Real-time KPI sidebar (productivity %, agent status feed)
- [x] `useAgentPolling()` — Simulation tick engine, 3–5 s jitter, 3 mock agents
- [ ] Dashboard HUD — Extended KPI overlay (revenue, tasks)
- [ ] Pathfinding — A* or grid-aware movement instead of random teleport

## Assets
- Tiles: `public/assets/tiles/` (server-floor.svg, desk.svg — SVG placeholders)
- Sprites: `public/assets/sprites/` (agent-1.svg — SVG placeholder)
- PNG generation queue: [[asset-TODO]]

## Research
- Raw findings: `brain/raw/`

## Tests
- 15 tests passing: `src/hooks/useAgentPolling.test.ts` + `src/components/OfficeFloorPlan.test.tsx`
- Runner: `npm test` (vitest)

## Meta
- [[changelog]] — Full history of changes
