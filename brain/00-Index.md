---
tags: [index, meta]
date: 2026-04-08
status: active
---

# CEO Simulator — Master Index

## Architecture
- [[UI-Design-System]] — Pixel Art / HUD design tokens, color system, component rules
- [[Office-Simulator-Architecture]] — **v3 Paperclip + Pixel Agents hybrid** — Canvas 2D office, BFS pathfinding, Paperclip management UI, goal hierarchy, agent CRUD

## Management Pages (v3 — Paperclip-inspired)
- [ ] `<Dashboard />` — pixel office canvas + goal panel + activity feed + budget HUD
- [ ] `<AgentsPage />` — hire/fire agents, configure skills/permissions
- [ ] `<AgentDetail />` — individual agent config, budget, activity log
- [ ] `<GoalsPage />` — goal tree with cascading delegation
- [ ] `<CostsPage />` — per-agent, per-goal budget analytics
- [ ] `<OrgChartPage />` — visual CEO → reports hierarchy
- [ ] `<SettingsPage />` — company config, office layout editor

## Canvas Engine (v3 — Pixel Agents-inspired)
- [ ] `<PixelOfficeCanvas />` — Canvas 2D game loop, tile renderer, sprite animator
- [ ] `pathfinding.ts` — BFS on walkable tile grid
- [ ] `canvasRenderer.ts` — tile/furniture/character/speech-bubble draw functions
- [ ] `spriteAnimator.ts` — frame selection from sprite sheets

## State (v3)
- [x] `src/store/dashboardStore.ts` — Zustand (needs expansion for agent CRUD, goal trees, office layout)
- [ ] `src/hooks/useCompanySimulation.ts` — Canvas game loop + business tick engine

## Legacy v1 (archived on master @ `1bfff5e`)
- [x] `<OfficeFloorPlan />` — 15×15 top-down CSS Grid
- [x] `<AgentSprite />` — orthographic sprite, walk-cycle
- [x] `<HudPanel />` — KPI sidebar
- [x] `useAgentPolling()` — flat simulation hook
- [x] 15/15 vitest tests passing

## Assets
- ISO tiles needed: `public/assets/iso-tiles/` — see [[asset-TODO]]
- Role sprites needed: `public/assets/sprites/ceo.png`, `pm.png`, `devops.png`, `frontend.png`
- v1 tiles (32×32 PNGs + SVGs): `public/assets/tiles/` — retained for reference

## Research
- Raw findings: `brain/raw/`

## Meta
- [[changelog]] — Full history of changes
