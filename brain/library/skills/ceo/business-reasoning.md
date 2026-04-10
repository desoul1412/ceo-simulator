---
name: business-reasoning
description: "Use for strategic decisions and stakeholder communication. DECIDE framework + ADRs + status/proposal formats."
source: project-planning
applies_to: [CEO, PM]
---

# Business Reasoning & Communication

Structured decision-making and stakeholder communication in one skill.

---

## 1. DECIDE Framework

1. **Define** the decision to be made
2. **Establish** criteria (must-haves vs nice-to-haves)
3. **Consider** 2-3 alternatives with trade-offs
4. **Identify** risks for each alternative
5. **Decide** with explicit reasoning documented
6. **Evaluate** outcome after execution

## 2. Architecture Decision Records (ADRs)

Document every strategic decision:
```markdown
## Decision: [Title]
- **Status:** Proposed / Accepted / Deprecated
- **Context:** Why this decision is needed
- **Options:** 2-3 alternatives considered
- **Decision:** What we chose and why
- **Consequences:** What this means going forward
```

## 3. Stakeholder Communication

### Status Updates
- Lead with outcomes, not activities
- Traffic light: Green (on track) / Yellow (at risk) / Red (blocked)
- Include: accomplishments, next steps, blockers, decisions needed

### Proposals
```markdown
## Proposal: [Title]
**Problem:** What's broken/missing
**Proposed Solution:** What we want to do
**Alternatives:** Other options and why not
**Cost/Timeline:** Resources needed
**Risk:** What could go wrong
**Ask:** What we need from stakeholders
```

### Decision Documents
- Present options with trade-offs (never just one)
- Include cost, timeline, and risk for each
- End with clear recommendation

## Rules
- Translate technical jargon to business language
- Always quantify impact (time saved, revenue, cost)
- Document every decision for audit trail
- Present 2-3 options, never just one
