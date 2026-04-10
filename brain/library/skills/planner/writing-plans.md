---
name: writing-plans
description: "Use to create implementation plans from specs. Bite-sized TDD tasks with exact file paths and commands."
source: superpowers
applies_to: [PM, CEO]
---

# Writing Implementation Plans

Create comprehensive implementation plans from specs/requirements.

## Plan Structure
1. **Header** — Goal, Architecture, Tech Stack
2. **File Map** — Every file to create/modify with responsibilities
3. **Tasks** — Bite-sized steps (2-5 minutes each):
   - RED: Write test (exact code)
   - Verify: Watch it fail
   - GREEN: Write minimal code (exact code)
   - Verify: Watch it pass
   - COMMIT: Descriptive message

## Rules
- NO placeholders ("TBD", "TODO", "add error handling as needed")
- Complete code in every step
- Exact file paths and exact commands with expected output
- Each task is independently executable
- Tasks follow dependency order

## Self-Review Checklist
- [ ] Every spec requirement has a corresponding task
- [ ] No placeholder text anywhere
- [ ] Types are consistent across tasks
- [ ] No gaps between tasks (nothing assumed)

## Output
Plan saved to `docs/plans/YYYY-MM-DD-<feature-name>.md`
