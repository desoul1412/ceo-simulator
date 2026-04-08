---
tags: [library, index]
date: 2026-04-08
status: active
---

# Config Library — Skills, Rules, MCP Servers, Agent Presets

This library contains reusable configuration templates for the CEO Simulator.
Import these when creating agents, configuring projects, or setting up global defaults.

## Skills
- [[react-development]] — React components, TypeScript, hooks
- [[typescript]] — Strong typing, generics, strict mode
- [[api-design]] — REST/GraphQL endpoint architecture
- [[tdd]] — Test-driven development with vitest
- [[documentation]] — Specs and docs in Obsidian markdown
- [[devops-ci]] — CI/CD, Docker, deployment automation
- [[database]] — SQL, Supabase, schema design, migrations
- [[css-tailwind]] — Tailwind CSS v4, responsive design

## Rules
- [[tdd-circuit-breaker]] — Halt after 3 test failures (safety)
- [[mcp-fallback]] — Graceful fallback on MCP timeout (safety)
- [[pre-flight-docs]] — Read specs before coding (process)
- [[post-flight-update]] — Update docs after completion (process)
- [[no-hallucination]] — Verify facts via Tavily/Context7 (quality)
- [[git-worktree-isolation]] — Isolated branches per agent (process)

## MCP Servers
- [[tavily]] — Web search for market research
- [[context7]] — Live API documentation lookup
- [[supabase]] — Database operations and schema management

## Agent Presets
- [[frontend-developer]] — React + TypeScript + Tailwind + TDD
- [[backend-developer]] — API + Database + TypeScript + TDD
- [[project-manager]] — Documentation + Requirements + Research
- [[devops-engineer]] — CI/CD + Infrastructure + Docker
- [[qa-engineer]] — Testing + Automation + Bug Triage
