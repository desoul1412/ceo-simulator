---
name: quality-engineering
description: "Use for all testing, verification, and quality work. Combines TDD, test strategy, and completion gates."
source: superpowers + internal
applies_to: [Frontend, Backend, DevOps, QA]
---

# Quality Engineering

Unified skill covering test-driven development, test strategy, and evidence-based completion.

---

## 1. TDD Cycle (RED-GREEN-REFACTOR)

**Iron Law:** No production code without a failing test first.

### RED
1. Write ONE minimal test showing expected behavior
2. Run test — watch it FAIL
3. Verify failure reason matches expectation (not typos/imports)

### GREEN
1. Write the SIMPLEST code to make the test pass
2. No over-engineering, no "while I'm here" additions
3. Run ALL tests — verify nothing else broke

### REFACTOR
1. Clean up while keeping tests green
2. Extract functions, rename, remove duplication
3. Run ALL tests after each refactor

### TDD Rules
- If test passes immediately — it proves nothing. Rewrite.
- If you wrote code before the test — delete it, test first.
- One test at a time. Never batch.
- **Circuit Breaker:** If a test fails 3 times in a row → HALT. Document in changelog and escalate.

---

## 2. Test Strategy

### Test Types (use the right level)
| Type | When | Tool |
|------|------|------|
| **Unit** | Individual functions/components | vitest |
| **Integration** | API endpoints, DB queries | vitest + Supabase branch |
| **E2E** | Full user flows | vitest + real browser |
| **Regression** | After every bug fix | vitest |

### Test Plan Template
```markdown
## Feature: [Name]
### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Test Cases
1. **Happy path** — Expected behavior with valid input
2. **Edge cases** — Boundary values, empty states, max limits
3. **Error cases** — Invalid input, network failures, timeouts
4. **Regression** — Previously broken scenarios
```

### Anti-Patterns (avoid)
- Testing mocks instead of real code
- Test-only methods that don't exist in production
- Mocking critical paths (use real DB via Supabase branches)
- Testing implementation details instead of behavior

---

## 3. Completion Gates

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

### Gate Function
1. **IDENTIFY** — What command proves this claim?
2. **RUN** — Execute FULL command (fresh, not cached)
3. **READ** — Full output, check exit code, count failures
4. **VERIFY** — Does output actually confirm the claim?
5. **ONLY THEN** — Make the claim

### Evidence Requirements
| Claim | Required Evidence |
|-------|------------------|
| Tests pass | `npm run test` output with 0 failures, exit 0 |
| Build succeeds | `npm run build` output with exit 0 |
| Linter clean | Linter output with 0 errors |
| Bug fixed | Regression test passes (RED then GREEN) |
| Feature complete | All acceptance criteria verified |

### Red Flags
- Using "should", "probably", "seems to work"
- Expressing satisfaction before running verification
- Partial verification (one test, not all)
- Trusting success reports without checking output
