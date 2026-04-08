---
tags: [index, meta]
date: 2026-04-08
status: active
---

# CEO Simulator — Master Index

## Architecture
- [[Factory-Operations-Manual]] — **Zero-Human Software Factory** — SOPs, failure modes, token optimization, execution pipeline
- [[Paperclip-Gap-Analysis]] — **Feature audit** — 14 Paperclip features vs current state, prioritized roadmap
- [[UI-Design-System]] — Pixel Art / HUD design tokens, color system, component rules
- [[Office-Simulator-Architecture]] — **v3 Paperclip + Pixel Agents hybrid** — Canvas 2D office, BFS pathfinding, Paperclip management UI, goal hierarchy, agent CRUD

## Navigation (React Router — 13 routes)
- [x] `<MasterDashboard />` `/` — company grid with mini pixel canvases
- [x] `<CompanyView />` `/company/:id` — pixel office + goal panel + feeds
- [x] `<AgentsPage />` `/company/:id/agents` — agent card grid + hire button
- [x] `<AgentDetail />` `/company/:id/agents/:id` — individual agent config (shell)
- [x] `<GoalsPage />` `/company/:id/goals` — goal tree + delegation progress
- [x] `<DocumentsPage />` `/company/:id/documents` — brain/ vault browser (shell)
- [x] `<CostsPage />` `/company/:id/costs` — budget analytics
- [x] `<OrgChartPage />` `/company/:id/org-chart` — CEO → reports hierarchy
- [x] `<SettingsPage />` `/settings` — General, Skills, MCP, Rules tabs
- [x] `<NavBar />` — top navigation with context-aware company tabs

## Canvas Engine (v3 — Pixel Agents-inspired)
- [ ] `<PixelOfficeCanvas />` — Canvas 2D game loop, tile renderer, sprite animator
- [ ] `pathfinding.ts` — BFS on walkable tile grid
- [ ] `canvasRenderer.ts` — tile/furniture/character/speech-bubble draw functions
- [ ] `spriteAnimator.ts` — frame selection from sprite sheets

## Backend (Supabase + Vercel)
- [x] Supabase schema: `companies`, `agents`, `goals`, `delegations`, `activity_log`
- [x] `src/lib/supabase.ts` — Client with offline fallback
- [x] `src/lib/api.ts` — CRUD: fetchCompanies, createCompany, assignGoal, tickCompany, sendHeartbeat
- [x] `src/hooks/useRealtimeSync.ts` — Realtime agent/company updates
- [x] `vercel.json` — SPA deployment config
- [x] Vercel deployment — **LIVE** at `https://ceo-simulator-iota.vercel.app`
- [x] Agent heartbeat system (alive/stale/dead) + canvas pulse visuals
- [x] `src/components/ActivityFeed.tsx` — Realtime activity log panel
- [ ] Auth (user accounts + per-user companies)

## State (v3)
- [x] `src/store/dashboardStore.ts` — Zustand + Supabase sync (optimistic local + background persist)
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
