---
name: devops-ci
description: "Use when managing infrastructure, CI/CD, deployment, and monitoring."
source: internal
applies_to: [DevOps]
---

# DevOps & CI/CD

Manage infrastructure, deployment pipelines, and monitoring.

## Stack
- Vercel (SPA deployment) — config in `vercel.json`
- Supabase (managed PostgreSQL + Realtime)
- GitHub Actions (CI/CD)
- Node.js 20+ runtime

## Deployment
- Frontend: Vercel auto-deploys from `main` branch
- Server: Local orchestrator on `:3001` (not deployed to cloud)
- Database: Supabase manages PostgreSQL

## CI/CD Patterns
- Run `npm run build` and `npm run test` before merge
- Use git worktrees for isolated agent work
- Branch naming: `agent/{role}-{feature-slug}`
- Never force-push to main

## Monitoring
- Heartbeat daemon tracks agent liveness (alive/stale/dead)
- Audit log records every tool call, approval, and budget check
- Token usage tracked per agent per session
- Budget auto-throttle on exhaustion

## Environment Variables
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (frontend)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (server)
- Never commit `.env` files
