---
tags: [skill, library, frontend, tdd, testing]
id: frontend-tdd
role: Frontend
status: active
date: 2026-04-08
---

# Frontend TDD

**Description:** Test-driven development workflow for React components using Vitest and Testing Library. Based on critical friction data: 16 buggy first-pass code incidents traced to writing code before tests. This skill enforces the Red-Green-Refactor cycle for all frontend work.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Frontend, QA

## System Prompt Injection

```
You MUST write tests BEFORE implementation. This is non-negotiable.

TDD WORKFLOW — RED/GREEN/REFACTOR:

STEP 1 — RED (Write failing test):
Write a test that describes the desired behavior. Run it. It MUST fail.
If the test passes before you write implementation code, the test is wrong.

STEP 2 — GREEN (Minimum implementation):
Write the MINIMUM code to make the test pass. Not elegant. Not complete. Just passing.
Run the test. It MUST pass. If it doesn't, fix the implementation (not the test).

STEP 3 — REFACTOR (Clean up):
Now improve the code quality without changing behavior.
Run tests again. They MUST still pass. If they break, your refactor changed behavior.

REPEAT for the next behavior.

TESTING STACK:
- Vitest: test runner (vitest.config.ts)
- @testing-library/react: component rendering
- @testing-library/user-event: user interaction simulation
- @testing-library/jest-dom: DOM matchers (toBeInTheDocument, etc.)
- jsdom: browser environment for Vitest

TEST FILE CONVENTIONS:
- Location: alongside component (Feature.test.tsx next to Feature.tsx)
- Naming: describe('[ComponentName]') → it('should [behavior]')
- One behavior per test — if a test name has "and", split it

COMPONENT TEST TEMPLATE:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Feature } from './Feature';

describe('Feature', () => {
  it('should render the initial state', () => {
    render(<Feature value="test" />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Feature value="test" onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: /action/i }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
```

ZUSTAND STORE TEST TEMPLATE:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore';

describe('useGameStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useGameStore.setState({ score: 0 });
  });

  it('should increment score', () => {
    useGameStore.getState().incrementScore(10);
    expect(useGameStore.getState().score).toBe(10);
  });
});
```

WHAT TO TEST:
- Rendering: does the component show the right content for given props?
- Interaction: does clicking/typing trigger the right behavior?
- State changes: does the UI update when state changes?
- Edge cases: empty data, null props, error states
- Accessibility: can the element be found by role? (screen.getByRole)

WHAT NOT TO TEST:
- Implementation details (internal state, private functions)
- Third-party libraries (Zustand, React Router — they have their own tests)
- Styles/CSS (unless behavior depends on a class being applied)
- Exact DOM structure (test by role/text, not by class name or tag)

RUNNING TESTS:
- Single file: npx vitest run src/components/Feature/Feature.test.tsx
- Watch mode: npx vitest src/components/Feature/
- All tests: npx vitest run
- Coverage: npx vitest run --coverage

TDD CIRCUIT BREAKER:
If you find yourself:
1. Writing implementation before tests → STOP. Write the test first.
2. Modifying tests to match broken implementation → STOP. Fix the implementation.
3. Skipping tests "because it's simple" → STOP. Simple things break too.
4. With 0 tests after creating a component → the component is NOT done.
```

## Anti-patterns

- **Code-first:** Writing implementation then "adding tests later" (later never comes). 16 buggy incidents prove this pattern fails.
- **Testing implementation details:** Testing internal state names, DOM structure, or CSS classes. Test BEHAVIOR.
- **Snapshot abuse:** Snapshot tests break on any change and provide no behavioral insight. Avoid them.
- **Mocking everything:** Over-mocking hides integration bugs. Only mock external services and network calls.
- **Giant test files:** More than 200 lines in a test file means the component does too much. Split both.
- **No assertions:** A test that runs code but doesn't assert anything is a false sense of security.
- **Testing only happy path:** Every component should have at least one error/edge case test.

## Verification Steps

1. Test file exists for every component (*.test.tsx alongside *.tsx)
2. Tests were written BEFORE implementation (check git log: test commit before impl commit)
3. Tests pass: `npx vitest run` exits with 0
4. Tests cover: rendering, interaction, state changes, and at least one edge case
5. Tests use Testing Library queries (getByRole, getByText) not DOM queries (querySelector)
6. No `test.skip` or `test.todo` left in committed code without a tracking issue
7. Coverage is meaningful (not 100% lines, but all behaviors tested)
