---
tags: [architecture, operations, factory, sop]
date: 2026-04-08
status: active
---

# Zero-Human Software Factory — Operations Manual

Linked from: [[00-Index]]
Core Architecture: [[Office-Simulator-Architecture]]

---

## 1. System Overview

A single human operator ("The CEO") manages multiple concurrent software projects through autonomous AI agents. The framework replaces manual coding with a pipeline of automated research, documentation, subagent delegation, and test-driven execution.

### Core Philosophy

1. **Never Hallucinate** — Agents verify facts via Tavily and code syntax via Context7 before acting
2. **Read Before Writing** — Agents read `brain/` specs to establish context
3. **Document Autonomously** — Agents maintain the living markdown wiki
4. **Isolate Execution** — All code in isolated Git worktrees, verified via TDD before merging

---

## 2. Technology Stack

### A. The Brain (Memory & Documentation)
- **Obsidian (`./brain/`)** — Persistent cross-linked knowledge graph
- **Claude-Mem** — Vector memory engine for cross-session context compression

### B. The Truth Engine (Fact & Syntax Verification)
- **Tavily MCP** — Real-time web search (market research, competitor analysis, current events)
- **Context7 MCP** — Live developer documentation (`resolve-library-id` → `query-docs`)

### C. The Execution Engine (Building & Styling)
- **Paperclip (Supabase)** — Backend orchestrator: companies, agent budgets, SRE routines, heartbeats
- **Superpowers** — Rigid dev pipeline: Brainstorm → Plan → Worktree → Subagent → TDD
- **UI/UX Pro Max** — Design intelligence layer for consistent React design system

### D. The Dashboard (Visualization)
- **Pixel Office Canvas** — Canvas 2D game loop rendering agent activity in real-time
- **Management UI** — React 19 + Zustand + Tailwind v4 dashboard (goals, budgets, org chart)

---

## 3. Standard Operating Procedures

### SOP 1: Incepting a New Project

> "Spin up a new project for [Description]. 1. Use Tavily to research market/competitors. 2. Use Context7 for tech stack docs. 3. Draft business + technical architecture in `./brain/wiki/`. 4. Register the new company via Paperclip backend."

### SOP 2: Developing a Feature

> "Activate superpowers. Build [Feature Name]. Check Pre-Flight, read the wiki spec, isolate in git worktree, use TDD. Execute Post-Flight on merge."

### SOP 3: Handling Production Bugs

> (Automated via Paperclip SRE routine) "Review `./brain/raw/production-logs.txt`. If 500-level errors exist, activate superpowers. Create hotfix branch. Use Context7 to verify failing endpoint syntax. Write patch. Flag CEO for deployment approval."

### SOP 4: Project Archival

> "Execute archive. Update Obsidian frontmatter to `status: archived`. Summarize final state in `00-Index.md`. Halt Paperclip agent polling."

---

## 4. Known Failure Modes & Mitigations

### A. Infinite Testing Loop (Token Burner)
- **Trigger:** TDD loop fails → agent retries → hallucination spiral
- **Fix:** If test fails 3× consecutively, HALT. Log to `changelog.md`, ask CEO

### B. Wiki Bloat
- **Trigger:** Months of redundant markdown accumulation
- **Fix:** Weekly maintenance: consolidate, fix broken wikilinks, archive deprecated docs

### C. MCP Server Timeout
- **Trigger:** Tavily/Context7 fails to respond → Claude hallucinates fake data
- **Fix:** Graceful fallback, write `TODO-MCP-Failure.md`, notify user. Never fabricate results.

---

## 5. Token & Cost Optimization

| Strategy | Savings |
|----------|---------|
| Pre-flight spec reads (300 words) vs. full codebase scan | 10–50× cheaper |
| Hard budget caps per agent in Paperclip | Prevents infinite loops |
| Targeted MCP calls (only for new facts/APIs) | Avoids redundant external calls |
| Context7 caching (same lib within session) | Eliminates duplicate lookups |
