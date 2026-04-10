---
name: project-planning
description: "Use when starting a new project or major feature. 8-phase planning from intake to handoff."
source: project-planning
applies_to: [PM, CEO]
---

# Project Planning (8-Phase)

Comprehensive project planning producing both technical handoffs and business proposals.

## Phases

### Phase 0: Intake & Sizing
- Classify: Small (skip research/strategy), Medium (skip research), Large (all phases)
- Create project folder structure

### Phase 1: Requirements & Discovery
- Business case, users, success metrics
- Non-functional requirements (performance, scalability, security)
- Integration mapping and stakeholder identification
- Output: `overview.md`

### Phase 2: Feasibility & Research (Large only)
- Technical landscape research
- Compliance and licensing assessment
- Competitive analysis and benchmarking
- Output: `research.md`

### Phase 3: Solution Strategy (Large only)
- Build/buy/extend decisions
- Phasing and migration path
- KPIs and business model definition

### Phase 4: Technology Evaluation (Medium + Large)
- Evaluate 2-3 candidates per technology layer
- Score on maturity, community, cost, team fit
- Output: `tech-stack.md`

### Phase 5: Solution Architecture (All)
- **Data-first**: Define schemas before design
- C4 diagrams (Context > Container > Component > Code)
- Security, observability, deployment topology
- Output: `architecture.md`

### Phase 6: Implementation Handoff (All)
- AI-implementation-ready technical handoff
- Implementation phases with dependencies
- Output: `handoff.md`

### Phase 7: Business Proposal (All)
- Translate technical plan to business language
- Output: `business-proposal.md`

## Rules
- **GATE RULE**: Never proceed without user confirmation
- **DATA-FIRST**: Define data contracts before architecture
- **ADR RULE**: Log all significant decisions
- **SCOPE RULE**: Defer out-of-scope ideas to "Future Scope"
