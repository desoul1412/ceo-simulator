---
tags: [skill, library, fullstack, feature]
id: end-to-end-features
role: Full-Stack
status: active
date: 2026-04-10
---

# End-to-End Features

**Description:** Build complete features spanning React frontend, API/edge functions, and Supabase database. Design the data model, build the API, wire the UI, and test the full flow.

**Tools:** Read, Edit, Write, Bash, Glob, Grep, Context7 MCP, Supabase MCP (execute_sql, apply_migration, deploy_edge_function)

**System Prompt Injection:**
```
When building end-to-end features:
1. DESIGN ORDER: Database schema -> API/Edge Function -> React component -> Integration test. Bottom-up ensures each layer has a solid foundation.
2. DATABASE LAYER:
   - Design schema in Supabase. Use migrations (never manual DDL).
   - Row Level Security (RLS) policies for every table. Default deny -- explicitly grant.
   - Indexes on foreign keys and frequently queried columns.
   - created_at/updated_at on every table.
3. API LAYER:
   - Use Supabase Edge Functions (Deno) for custom logic.
   - Or use Supabase client directly from React for simple CRUD.
   - Validate inputs. Return typed responses. Handle errors with consistent format: { error: string, code: string }.
   - Use Supabase Auth for authentication. Verify JWT in edge functions.
4. FRONTEND LAYER:
   - React 19 + TypeScript. Functional components with hooks.
   - Tailwind CSS v4 for styling (CSS-first config).
   - Custom hooks for data fetching: return { data, loading, error }.
   - Handle all UI states: loading, error, empty, success.
   - Optimistic updates for user-facing mutations.
5. INTEGRATION:
   - Wire frontend to API. Test the full flow: UI action -> API call -> DB mutation -> UI update.
   - Test with Supabase local dev (supabase start) when possible.
   - Verify RLS policies work correctly (test as different user roles).
6. TESTING:
   - Unit tests for business logic (vitest).
   - Component tests for React components (@testing-library/react).
   - Integration tests for full flow (API -> DB -> response).
   - TDD: write failing test first at each layer.
7. COMMIT STRATEGY:
   - Commit 1: Database migration
   - Commit 2: API/edge function + tests
   - Commit 3: React component + tests
   - Commit 4: Integration wiring + integration tests
   Each commit is independently reviewable and deployable.
```

**Anti-Patterns:**
- Building UI before the data model is designed
- Missing RLS policies (security vulnerability)
- No input validation on API endpoints
- Components without loading/error/empty state handling
- Skipping integration tests ("unit tests are enough")
- One giant commit for the entire feature

**Verification Steps:**
- [ ] Schema designed with migrations (not manual DDL)
- [ ] RLS policies defined for every new table
- [ ] API validates inputs and returns typed responses
- [ ] Frontend handles loading, error, empty, and success states
- [ ] Full flow tested: UI action -> API -> DB -> UI update
- [ ] TDD applied at each layer (database, API, frontend)
- [ ] Separate commits for each layer (DB, API, UI, integration)
