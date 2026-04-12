---
tags: [ci, cd, github-actions, vite, vercel, spec]
date: 2026-04-12
status: active
---

# CI/CD Pipeline Spec

> Part of [[Factory-Operations-Manual]] — Task 1.1.6

## Overview

A GitHub Actions CI pipeline that enforces quality gates before any Vercel deployment.

## Pipeline Jobs

```
push / PR
   │
   ├─► lint        (ESLint — npm run lint)
   ├─► type-check  (tsc --noEmit)
   ├─► test        (vitest run)
   │
   └─► build  ──[needs: lint + type-check + test]──► dist artifact
          │
          ├─► deploy         [main/master only, needs: build]  → production Vercel
          └─► deploy-preview [PRs only, needs: build]          → preview Vercel URL + PR comment
```

## Acceptance Criteria

- [ ] All four checks (lint, type-check, test, build) must be green before deploy runs
- [ ] Feature branch pushes run lint + type-check + test + build but do NOT deploy
- [ ] PRs get a preview Vercel URL commented automatically
- [ ] Main branch merges auto-deploy to production
- [ ] `concurrency` block cancels stale in-progress runs on the same ref

## Secrets Required

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel personal access token |
| `VITE_SUPABASE_URL` | Supabase project URL (for build/test env) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

> ⚠️ Secrets must be configured in GitHub repo Settings → Secrets → Actions.

## File Location

`.github/workflows/ci.yml`

## Stack Notes

- This project uses **Vite** (not Next.js). Task spec mentioned `next lint`/`next build` — adapted to `npm run lint` / `npm run build` (Vite equivalents).
- TypeScript references project (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`) — `tsc --noEmit` resolves both.
- Vitest is the test runner; `npm test` maps to `vitest run`.

## Data Flow

```
Developer push
  → GitHub Actions trigger
  → npm ci (cached node_modules)
  → parallel: [lint] [type-check] [test]
  → sequential: [build] (only if all 3 pass)
  → conditional: [deploy] or [deploy-preview]
  → Vercel production / preview URL
```
