---
tags: [index, meta]
date: 2026-04-13
status: active
---

# CEO Simulator — Brain Index

> The Obsidian vault for the Zero-Human Software Factory.
> This is a **local mirror** of brain content stored in Supabase.

## Structure

```
brain/
├── 00-Index.md          ← you are here
├── changelog.md         ← primary activity log (source of truth)
├── wiki/                ← architecture specs, design docs
│   ├── Factory-Operations-Manual.md
│   ├── Office-Simulator-Architecture.md
│   ├── UI-Design-System.md
│   ├── Paperclip-Gap-Analysis.md
│   └── ...
├── raw/                 ← scratch notes, asset TODOs
├── {company-slug}/      ← per-project content (auto-generated)
│   ├── summary.md       ← project summary (updated on sprint end)
│   ├── {agent-slug}/    ← per-agent brain
│   │   ├── soul.md      ← role, system prompt, skills, config
│   │   ├── context.md   ← current task, sprint, team
│   │   └── memory.md    ← completed tasks, learned skills
│   ├── plans/{id}/      ← CEO planning session outputs
│   │   ├── 00-index.md
│   │   ├── overview.md, architecture.md, hiring_plan.md, ...
│   └── sprints/{name}/
│       └── dependency-graph.md
└── .obsidian/           ← vault config
```

## Key Links

- [[changelog]] — Full history of changes (890+ entries)
- [[Factory-Operations-Manual]] — SOPs, execution pipeline, failure modes
- [[Office-Simulator-Architecture]] — v3 Pixel Agents hybrid design
- [[UI-Design-System]] — Pixel art / HUD design tokens

## Data Flow

- **Presets, skills, rules** → Supabase `department_roles` + `agent_skills` tables (source of truth)
- **Agent memory** → Supabase `agents.memory` JSONB (primary), mirrored to `brain/{company}/{agent}/memory.md`
- **Plans** → Supabase `project_plans` + persisted to `brain/{company}/plans/`
- **Changelog** → Appended by circuit breaker on failures, updated by session summaries
- **Wiki** → Manual specs, read by agents during pre-flight

## Notes

- `brain/library/` was removed (2026-04-13) — all presets, skills, rules, MCP configs are in Supabase
- `brain/agents/` was removed (2026-04-13) — per-agent brains live under `brain/{company-slug}/` now
- Local brain files are optional mirrors — the system works without them via Supabase
