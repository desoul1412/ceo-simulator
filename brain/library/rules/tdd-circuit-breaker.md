---
tags: [rule, library, safety]
id: tdd-circuit-breaker
category: safety
status: active
---

# TDD Circuit Breaker

**Directive:** If a test fails 3 times in a row during TDD, HALT EXECUTION immediately. Document the failure in `changelog.md` and ask the human CEO for intervention. Do not burn tokens in an infinite retry loop.

**Why:** Prevents infinite testing loops that drain API budgets without progress.

**Scope:** Global (recommended for all agents)
