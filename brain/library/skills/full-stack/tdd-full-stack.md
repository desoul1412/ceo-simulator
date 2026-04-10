---
tags: [skill, library, fullstack, testing, tdd]
id: tdd-full-stack
role: Full-Stack
status: active
date: 2026-04-10
---

# TDD Full-Stack

**Description:** Apply Test-Driven Development across the full stack: database constraints, API endpoints, React components, and integration flows. Every layer gets a failing test before implementation.

**Tools:** Read, Edit, Write, Bash, Glob, Grep, Context7 MCP, Supabase MCP

**System Prompt Injection:**
```
When applying TDD across the full stack:

DATABASE LAYER TDD:
1. Write a test that exercises the schema constraint (e.g., insert invalid data, expect rejection).
2. Run test -- verify it fails (constraint doesn't exist yet).
3. Apply migration adding the constraint.
4. Run test -- verify it passes.
Example: Test that email column has UNIQUE constraint. Insert duplicate, expect error.

API LAYER TDD:
1. Write a test that calls the API endpoint with known input and expects specific output.
2. Run test -- verify it fails (endpoint doesn't exist yet).
3. Implement the endpoint with minimal logic.
4. Run test -- verify it passes.
Example: POST /api/tasks with { title: "Test" } expects 201 with { id, title, created_at }.

COMPONENT LAYER TDD:
1. Write a test that renders the component and asserts on visible output.
2. Run test -- verify it fails (component doesn't exist yet).
3. Implement the component with minimal markup.
4. Run test -- verify it passes.
Example: render(<TaskList tasks={[{title:"Test"}]} />) expects screen.getByText("Test").

INTEGRATION LAYER TDD:
1. Write a test that simulates user action and verifies full-stack effect.
2. Run test -- verify it fails.
3. Wire the layers together.
4. Run test -- verify it passes.
Example: Click "Add Task" button, type title, submit. Verify task appears in list and exists in database.

TOOLING:
- vitest: Unit tests, API tests, component tests
- @testing-library/react: Component rendering and interaction
- Supabase local: Database tests against local Supabase instance (supabase start)

RED-GREEN-REFACTOR AT EVERY LAYER:
- RED: Write the test. Watch it fail. Confirm it fails for the RIGHT reason (missing feature, not typo).
- GREEN: Write minimal code. No extra features. No "while I'm here" improvements.
- REFACTOR: Clean up. Keep tests green. Extract helpers if duplication appears.

THE IRON LAW APPLIES TO ALL LAYERS:
No production code without a failing test first.
No database migration without a failing constraint test.
No API endpoint without a failing request test.
No React component without a failing render test.
```

**Anti-Patterns:**
- Writing the component before the test ("I'll test it after")
- Testing implementation details instead of behavior (testing state variables instead of visible output)
- Mocking Supabase client in every test (use local Supabase for integration tests)
- Skipping database constraint tests ("the ORM handles that")
- Giant test files testing multiple features (one behavior per test)
- Tests that pass immediately (you're testing existing behavior, not new)

**Verification Steps:**
- [ ] Every new database constraint has a corresponding test
- [ ] Every API endpoint has request/response tests
- [ ] Every React component has render and interaction tests
- [ ] Red-Green-Refactor cycle followed for each test (watched it fail, then pass)
- [ ] No test passes immediately on first run
- [ ] Tests use real behavior assertions (visible text, API responses) not implementation details
- [ ] All tests pass: vitest run reports 0 failures
