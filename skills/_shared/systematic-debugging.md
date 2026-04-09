---
name: systematic-debugging
description: "Use when diagnosing any bug or failure. Finds root cause before attempting fixes."
source: superpowers
applies_to: [Frontend, Backend, DevOps, QA]
---

# Systematic Debugging

**Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.

## Phase 1: Root Cause Investigation
1. Read error messages carefully — the full stack trace
2. Reproduce the issue consistently
3. Check recent changes (git log, git diff)
4. Trace data flow backward from the failure point

## Phase 2: Pattern Analysis
1. Find a working example of similar functionality
2. Compare working vs broken — identify differences
3. Understand the dependency chain

## Phase 3: Hypothesis & Testing
1. Form a SINGLE specific hypothesis (write it down)
2. Test minimally — change ONE variable at a time
3. Verify the hypothesis before continuing
4. If stuck after 3 attempts: question architecture, not code

## Phase 4: Implementation
1. Create a failing test that reproduces the bug
2. Implement a SINGLE fix at the root cause
3. Verify fix works — test passes
4. Run full test suite — no regressions

## Red Flags (STOP if you're doing these)
- Applying quick fixes without understanding why
- Changing multiple things at once
- Skipping the test step
- 3+ fix attempts on the same issue
