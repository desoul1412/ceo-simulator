---
tags: [library, index]
date: 2026-04-08
status: active
---

# Config Library — Skills, Rules, MCP Servers, Agent Presets

This library contains reusable configuration templates for the CEO Simulator.
Import these when creating agents, configuring projects, or setting up global defaults.

## Skills (General)
- [[react-development]] — React components, TypeScript, hooks
- [[typescript]] — Strong typing, generics, strict mode
- [[api-design]] — REST/GraphQL endpoint architecture
- [[tdd]] — Test-driven development with vitest
- [[documentation]] — Specs and docs in Obsidian markdown
- [[devops-ci]] — CI/CD, Docker, deployment automation
- [[database]] — SQL, Supabase, schema design, migrations
- [[css-tailwind]] — Tailwind CSS v4, responsive design

## Skills (Per-Role)

### CEO (`skills/ceo/`)
- [[strategic-planning]] — Goal decomposition, delegation strategy, resource allocation
- [[budget-management]] — Token budget optimization, cost-aware delegation
- [[team-orchestration]] — Hiring decisions, skill matching, workload balancing

### PM (`skills/pm/`)
- [[requirements-engineering]] — User stories, acceptance criteria, spec-first development
- [[sprint-planning]] — Phase decomposition, handoff docs, milestone tracking
- [[risk-assessment]] — Dependency analysis, blocker identification, contingency plans

### Frontend (`skills/frontend/`)
- [[react-mastery]] — React 19, hooks, Zustand state management, component patterns
- [[ui-ux-design-system]] — Design tokens, responsive patterns, accessibility, Tailwind v4
- [[frontend-tdd]] — Vitest, Testing Library, TDD-first component testing
- [[canvas-rendering]] — Canvas 2D, pixel art, sprite animation, game loops

### Backend (`skills/backend/`)
- [[api-architecture]] — REST design, Supabase Edge Functions, error handling
- [[database-engineering]] — Schema design, migrations, Supabase RLS, query optimization
- [[backend-tdd]] — Integration tests, API testing, TDD-first for endpoints
- [[agent-sdk-integration]] — Claude Agent SDK, session management, streaming

### DevOps (`skills/devops/`)
- [[deployment-verification]] — Pre-deploy checks, target verification, post-deploy validation
- [[docker-infrastructure]] — Docker, docker-compose, container orchestration
- [[ci-cd-pipelines]] — GitHub Actions, automated testing, release management
- [[environment-management]] — Env vars, secrets, multi-environment config

### QA (`skills/qa/`)
- [[test-strategy]] — Test pyramid, coverage targets, when to test what
- [[automated-testing]] — Vitest, Playwright, CI integration
- [[data-validation]] — Pipeline validation, shape checks, duplicate detection

### Designer (`skills/designer/`)
- [[pixel-art-hud]] — Pixel art, HUD, sci-fi, CRT scanlines, neon colors
- [[responsive-design]] — Mobile-first, breakpoints, touch targets, viewport scaling
- [[design-tokens]] — CSS custom properties, Tailwind v4 CSS-first, component consistency

### Data Engineer (`skills/data-engineer/`)
- [[pipeline-debugging]] — Validate each step, print shape/sample, catch silent drops
- [[pandas-mastery]] — groupby, merge, apply patterns, avoiding column loss
- [[data-quality]] — Dedup, type checking, bounds validation, >100% share detection

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
