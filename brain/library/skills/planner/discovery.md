---
name: discovery
description: "Use before any implementation. Combines brainstorming, requirements gathering, and design exploration into one flow."
source: superpowers + project-planning
applies_to: [PM, CEO, Frontend]
---

# Discovery (Brainstorming + Requirements)

Unified pre-implementation skill: explore context, gather requirements, design options, get approval.

---

## Phase 1: Explore & Research
1. Read project files, docs, recent commits for context
2. Identify stakeholders and users affected
3. Map integrations and dependencies
4. Use Tavily for market/competitor research if needed

## Phase 2: Clarify Requirements
Ask questions ONE at a time to capture:

```markdown
## Feature: [Name]
**Business Case:** Why are we building this?
**Users:** Who will use it? What are their pain points?
**Success Metrics:** How do we measure success? (KPIs, targets)

### Functional Requirements
1. [FR-001] The system must...

### Non-Functional Requirements
1. [NFR-001] Response time < 200ms
2. [NFR-002] Support N concurrent users

### Constraints
- Budget, timeline, technical limitations

### Out of Scope
- Explicitly list what we're NOT building
```

## Phase 3: Design Options
1. Propose 2-3 approaches with trade-offs (never just one option)
2. Present design in manageable sections
3. Get explicit approval after each section
4. Self-review: check for placeholders, contradictions, ambiguity, scope creep

## Phase 4: Document & Approve
1. Write approved design to spec file
2. Get stakeholder sign-off before handoff to engineering
3. Output: `docs/specs/YYYY-MM-DD-<topic>-design.md`

## Rules
- Never skip to implementation without a design document
- Never assume requirements — ask
- Document decisions with reasoning (ADRs)
- Defer out-of-scope ideas to "Future Scope" section
