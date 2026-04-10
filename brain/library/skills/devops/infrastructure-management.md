---
name: infrastructure-management
description: "Use when setting up or modifying infrastructure. Covers Supabase, Vercel, and local orchestrator."
source: project-planning
applies_to: [DevOps]
---

# Infrastructure Management

## Supabase Operations
- Branch management: create test branches, run migrations, merge
- Edge functions for serverless compute
- RLS policy management for security
- Database backups and point-in-time recovery

## Vercel Operations
- SPA deployment with `vercel.json` rewrites
- Environment variable management
- Preview deployments for PRs
- Custom domain configuration

## Local Orchestrator
- Express server on `:3001`
- Heartbeat daemon (30s interval)
- Agent runtime management (Claude SDK, HTTP, Bash)
- Git worktree isolation per agent task
- Session persistence across heartbeats

## Runbook
1. Start frontend: `npm run dev` (`:5173`)
2. Start orchestrator: `npm run server` (`:3001`)
3. Check daemon status: `GET /api/daemon/status`
4. Toggle daemon: `POST /api/daemon/start` or `/stop`
5. Monitor agents: check `audit_log` table
