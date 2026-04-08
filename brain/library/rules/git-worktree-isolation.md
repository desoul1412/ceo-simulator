---
tags: [rule, library, process]
id: git-worktree-isolation
category: process
status: active
---

# Git Worktree Isolation

**Directive:** All code changes must be made in isolated git worktrees. Keep `main` clean. Create feature branches like `agent/{role}-{task-slug}`. Merge only after tests pass.

**Why:** Prevents agents from conflicting with each other's work.

**Scope:** Global (all coding agents)
