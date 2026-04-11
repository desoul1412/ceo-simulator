---
tags: [skill, ceo, project-overview]
date: 2026-04-08
status: active
---

# CEO Skill: Project Overview Generation

## Purpose
When the CEO agent is assigned to review a project, this skill defines how to analyze a repository and generate structured project overview documents.

## Trigger
Activated when the CEO receives a goal containing "review project", "generate overview", or "project analysis".

## Process

### Step 1: Repository Analysis
Read the following files from the project repository:
- `README.md` — Project description and setup instructions
- `package.json` — Dependencies, scripts, project metadata
- `src/` directory structure — Architecture overview
- `.env.example` or environment docs — Required environment variables
- `tsconfig.json` / build configs — Tech stack details

### Step 2: Generate Structured Output
Produce the following plan documents as structured JSON:

#### Summary Plan
```json
{
  "type": "summary",
  "title": "Project Summary",
  "content": "One-paragraph summary of the project: what it does, tech stack, current state, and key metrics (file count, dependency count, test coverage if available)."
}
```

#### Master Execution Plan
```json
{
  "type": "master_plan",
  "title": "Master Execution Plan",
  "content": "Prioritized list of work items to advance the project:\n1. [HIGH] ...\n2. [MED] ...\n3. [LOW] ...\n\nDependency graph. Risk assessment. Timeline estimate."
}
```

#### Hiring Plan
```json
{
  "type": "hiring_plan",
  "title": "Hiring Plan",
  "content": "[{\"role\": \"Frontend\", \"name\": null, \"reason\": \"Build React UI components\"}, ...]"
}
```

#### Environment Variables
```json
{
  "type": "env_vars",
  "title": "Environment Requirements",
  "content": "List of required env vars:\n- SUPABASE_URL: Supabase project URL\n- SUPABASE_ANON_KEY: Public anon key\n- ANTHROPIC_API_KEY: Claude API key"
}
```

### Step 3: Save to Brain
Save generated plans to the Obsidian vault:
- `brain/{project-name}/summary.md`
- `brain/{project-name}/master-plan.md`
- `brain/{project-name}/hiring-plan.md`
- `brain/{project-name}/env-vars.md`

Each file should include YAML frontmatter with tags, date, and status.

## Output Format
The CEO should call the `/api/companies/:id/plans` endpoint for each plan type to persist the results in the database for display in the [[ProjectOverview]] UI.

## Related Skills
- [[strategic-delegation]] — After overview, CEO delegates tasks from the master plan
- [[team-orchestration]] — Hiring plan feeds into team composition
- [[budget-management]] — Overview includes cost projections
