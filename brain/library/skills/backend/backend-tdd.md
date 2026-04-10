---
tags: [skill, library, backend, tdd, testing]
id: backend-tdd
role: Backend
status: active
date: 2026-04-08
---

# Backend TDD

**Description:** Test-driven development for backend code: API endpoint testing, database integration tests, and Edge Function validation. Enforces the same Red-Green-Refactor cycle as frontend but with backend-specific patterns for Supabase, database operations, and API contracts.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Backend, QA

## System Prompt Injection

```
You MUST write tests BEFORE implementing backend logic. Red → Green → Refactor.

BACKEND TESTING STACK:
- Vitest for unit tests and integration tests
- Supabase local dev (supabase start) for database tests
- fetch/undici for API endpoint testing
- Test database with seed data for reproducible tests

TDD WORKFLOW FOR ENDPOINTS:
1. Write the API contract (request shape, response shape, status codes)
2. Write a test that calls the endpoint and asserts the contract
3. Run the test — it MUST fail (endpoint doesn't exist yet)
4. Implement the endpoint minimally to pass the test
5. Add edge case tests (bad input, unauthorized, not found)
6. Implement handling for edge cases
7. Refactor

API ENDPOINT TEST TEMPLATE:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

describe('POST /functions/v1/create-company', () => {
  it('should create a company with valid input', async () => {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/create-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({ name: 'TestCorp', industry: 'tech', initialBudget: 10000 }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('TestCorp');
  });

  it('should return 400 for missing required fields', async () => {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/create-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testUserToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should return 401 without auth token', async () => {
    const response = await fetch(`${process.env.SUPABASE_URL}/functions/v1/create-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestCorp', industry: 'tech', initialBudget: 10000 }),
    });

    expect(response.status).toBe(401);
  });
});
```

DATABASE OPERATION TEST TEMPLATE:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Use service role for test setup, anon for actual tests
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

describe('companies RLS policies', () => {
  beforeEach(async () => {
    // Clean test data
    await serviceClient.from('companies').delete().eq('name', 'TEST_COMPANY');
  });

  it('should prevent user A from seeing user B companies', async () => {
    // Setup: create company as user B via service role
    await serviceClient.from('companies').insert({
      user_id: userB_id,
      name: 'TEST_COMPANY',
      industry: 'tech',
    });

    // Test: user A should not see it
    const { data } = await anonClient
      .from('companies')
      .select('*')
      .eq('name', 'TEST_COMPANY');

    expect(data).toHaveLength(0);
  });
});
```

WHAT TO TEST:
- Happy path: correct input → correct output
- Validation: missing/invalid input → 400 with specific error
- Auth: no token → 401, wrong user → 403
- RLS: user A can't access user B's data
- Edge cases: empty strings, zero values, very long strings, SQL injection attempts
- Idempotency: calling the same endpoint twice doesn't create duplicates (where applicable)

TEST DATA MANAGEMENT:
- Use seed files for baseline test data
- Clean up test data in beforeEach/afterEach (not afterAll — tests may fail before cleanup)
- Use unique identifiers (TEST_ prefix) for test data so cleanup doesn't affect real data
- Never use production database for tests
```

## Anti-patterns

- **Testing against production:** Always use local Supabase or a test environment.
- **No auth tests:** Every protected endpoint needs a 401 test. Missing auth tests = security holes.
- **Shared test state:** Tests that depend on other tests' data are fragile. Each test sets up its own data.
- **Only testing happy path:** 16 buggy first-pass incidents came from missing edge case coverage. Test errors too.
- **Mocking the database:** For integration tests, use a real (local) database. Mocked DB tests don't catch SQL bugs.
- **No cleanup:** Test data left in the database pollutes subsequent test runs.
- **Testing after implementation:** Write the test FIRST. The failing test defines the requirement.

## Verification Steps

1. Tests exist for every API endpoint (happy path + error cases + auth)
2. Tests were written before implementation (check commit order)
3. RLS policies have dedicated tests (user A can't see user B's data)
4. Test data is cleaned up in beforeEach (not relying on afterAll)
5. Tests run against local Supabase (not production)
6. `npx vitest run` passes for all backend tests
7. Edge cases covered: missing fields, invalid types, unauthorized access
