# Skills Directory

Organized skills for the CEO Simulator factory. Optimized to eliminate redundancy — overlapping skills merged, new business roles added.

## Structure

```
skills/
  _shared/                    Cross-role skills (engineering + business)
    quality-engineering.md      TDD + test strategy + completion gates (merged)
    systematic-debugging.md     Root cause analysis before fixes
    git-worktree-isolation.md   Isolated branches for feature work
    tavily-research.md          Web search, extract, crawl, research
    context7-docs.md            Up-to-date library documentation

  ceo/                        CEO Agent — strategic leadership
    strategic-delegation.md     Break goals into subtasks for 9 agent roles
    business-reasoning.md       DECIDE framework + ADRs + stakeholder comms (merged)

  planner/                    Planner Agent — architecture & planning
    project-planning.md         8-phase planning from intake to handoff
    discovery.md                Requirements + brainstorming combined (merged)
    writing-plans.md            Bite-sized TDD implementation plans

  frontend-designer/          Frontend Designer Agent — UI/UX
    ui-ux-pro-max.md            67 styles, 161 palettes, design systems
    react-development.md        React 19 + TypeScript patterns
    css-tailwind.md             Tailwind v4 + design tokens

  backend/                    Backend Agent — APIs & data
    api-design.md               RESTful patterns, Supabase integration
    database.md                 PostgreSQL schemas, migrations

  devops/                     DevOps Agent — infrastructure
    devops-ci.md                CI/CD, deployment, monitoring
    infrastructure-management.md  Supabase, Vercel, orchestrator

  marketer/                   Marketer Agent — growth & acquisition
    product-launch.md           Go-to-market, launch timeline
    seo-growth.md               Technical SEO, content optimization
    analytics-and-metrics.md    KPI dashboards, funnel analysis
    social-and-ads.md           Social strategy, paid advertising
    brand-positioning.md        Value proposition, messaging framework

  content-writer/             Content Writer Agent — copy & docs
    copywriting.md              AIDA/PAS frameworks, landing pages
    technical-writing.md        API docs, changelogs, user guides
    content-strategy.md         Topic clusters, editorial calendar, repurposing

  sales/                      Sales Agent — pricing & retention
    pricing-and-conversion.md   Value-based pricing, funnel optimization
    customer-success.md         Onboarding, retention, churn prevention

  operations/                 Operations Agent — process & compliance
    process-and-finance.md      SOPs, budgets, automation, capacity
    compliance.md               ToS, privacy policy, GDPR/CCPA
```

## Agent Models (10 agents)

| Agent | Role | Skills | Model | Budget | Focus |
|-------|------|--------|-------|--------|-------|
| CEO | CEO | 4 | opus | $25 | Strategy, delegation, decisions |
| Planner | PM | 5 | sonnet | $15 | Requirements, architecture, plans |
| Frontend Designer | Frontend | 7 | sonnet | $15 | UI/UX, React, Tailwind |
| Backend | Backend | 7 | sonnet | $15 | APIs, database, integrations |
| DevOps | DevOps | 7 | sonnet | $10 | CI/CD, infra, deployment |
| QA | QA | 2 | haiku | $5 | Testing, quality gates |
| Marketer | Marketer | 6 | sonnet | $10 | Growth, SEO, ads, brand |
| Content Writer | Content | 5 | haiku | $5 | Copy, docs, blog, email |
| Sales | Sales | 4 | sonnet | $10 | Pricing, conversion, retention |
| Operations | Operations | 3 | haiku | $5 | Budget, SOPs, compliance |

**Total budget: $115** | **Total unique skills: 25** (down from 28, with 4 new roles added)

## Optimization Notes

### Skills Merged (3 merges, -4 redundant files)
1. **quality-engineering** = TDD + verification-before-completion + quality-assurance
2. **discovery** = brainstorming + requirements-gathering
3. **business-reasoning** expanded to absorb stakeholder-communication

### Skills Shared Across Roles
| Skill | Used By |
|-------|---------|
| quality-engineering | Frontend, Backend, DevOps, QA |
| systematic-debugging | Frontend, Backend, DevOps, QA |
| git-worktree-isolation | Frontend, Backend, DevOps |
| tavily-research | CEO, Planner, Backend, DevOps, Marketer, Sales, Content Writer |
| context7-docs | Frontend, Backend, DevOps, Planner |
| analytics-and-metrics | Marketer, Sales, Operations |
| seo-growth | Marketer, Content Writer |
| database | Backend, DevOps |

### Non-Engineering Agents Don't Get
- TDD / quality-engineering (they don't write code)
- systematic-debugging
- git-worktree-isolation
- context7-docs

## Sources
- **superpowers** — TDD, debugging, verification, brainstorming, plans, git worktrees
- **project-planning** — 476 planning/business skills (curated to ~15 most valuable)
- **ui-ux-pro-max** — Design intelligence (67 styles, 161 palettes)
- **context7** — Up-to-date library documentation
- **tavily** — Web search and research
- **internal** — Project-specific skills
