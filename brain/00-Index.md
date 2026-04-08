---
tags: [index, meta]
date: 2026-04-08
status: active
---

# CEO Simulator — Master Index

## Architecture
- [[UI-Design-System]] — Pixel Art / HUD design tokens, color system, component rules
- [[Office-Simulator-Architecture]] — **v2 isometric dashboard** — data model, projection math, state management, component tree, TDD targets, v1 migration notes

## Views (v2)
- [ ] `<GlobalDashboard />` — company card grid, add company CTA
- [ ] `<CompanyDetail />` — iso office + CEO panel + delegation feed + HUD
- [ ] `<IsometricOffice />` — 20×12 iso tile grid + IsoAgent overlay
- [ ] `<CeoGoalPanel />` — user goal input → CEO delegation
- [ ] `<DelegationFeed />` — live task progress per employee
- [ ] `<CompanyHud />` — budget meter, KPIs

## State (v2)
- [ ] `src/store/dashboardStore.ts` — Zustand root store
- [ ] `src/hooks/useCompanySimulation.ts` — per-company tick + CEO delegation engine
- [ ] `src/utils/isoProjection.ts` — `isoToScreen()`, painter-sort

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
