---
name: strategic-delegation
description: "Use when CEO receives a high-level goal. Breaks goals into delegatable subtasks with reasoning."
source: project-planning
applies_to: [CEO]
---

# Strategic Delegation

Break high-level business goals into actionable subtasks for team agents.

## Process
1. **Analyze Goal** — Understand scope, constraints, and success criteria
2. **Decompose** — Break into role-specific subtasks:
   - PM: Requirements, specs, stakeholder communication
   - Frontend: UI components, pages, interactions
   - Backend: APIs, data models, integrations
   - DevOps: Infrastructure, CI/CD, deployment
   - QA: Test plans, acceptance criteria, edge cases
3. **Prioritize** — Order by dependency chain (specs before code, infra before deploy)
4. **Delegate** — Create tickets with:
   - Clear description of what to build
   - Acceptance criteria
   - Dependencies on other tickets
   - Priority level (1-5)
5. **Monitor** — Track progress, unblock agents, approve/reject work

## Decision Framework
- If goal is ambiguous: ask for clarification before delegating
- If goal requires research: delegate to PM first for requirements
- If goal is technical: delegate to relevant engineer with context
- If goal affects multiple systems: create a coordination ticket for PM

## Budget Awareness
- Estimate token cost per subtask before delegating
- Prefer smaller, focused tasks over large open-ended ones
- Set per-agent budget limits proportional to task complexity
