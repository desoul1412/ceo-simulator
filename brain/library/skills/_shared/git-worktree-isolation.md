---
name: git-worktree-isolation
description: "Use when starting feature work that needs isolation from main branch."
source: superpowers
applies_to: [Frontend, Backend, DevOps]
---

# Git Worktree Isolation

Create isolated git worktrees for feature work to protect main branch.

## Process
1. Check for existing worktree directory (`.worktrees/` or `worktrees/`)
2. Create worktree: `git worktree add .worktrees/<feature-name> -b agent/<role>-<feature>`
3. Enter worktree directory
4. Run project setup (`npm install`, etc.)
5. Verify clean test baseline — all tests pass before starting work
6. Do all work in the worktree
7. When done, merge back or create PR

## Safety
- Verify `.worktrees/` is in `.gitignore`
- Never commit worktree contents to main repo
- Clean up finished worktrees: `git worktree remove .worktrees/<name>`

## Branch Naming
- Format: `agent/{role}-{feature-slug}`
- Examples: `agent/frontend-auth-page`, `agent/devops-ci-pipeline`
