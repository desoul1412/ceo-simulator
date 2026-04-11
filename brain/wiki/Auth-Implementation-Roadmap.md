---
tags: [auth, implementation, roadmap, user-stories, acceptance-criteria]
date: 2026-04-11
status: active
---

# Auth Implementation Roadmap — User Stories & Acceptance Criteria

Linked from: [[Auth-System-Spec]], [[Factory-Operations-Manual]], [[00-Index]]

---

## Overview

This document breaks down [[Auth-System-Spec]] into **5 sequential phases**, each with **user stories**, **acceptance criteria**, and **engineering tasks**. Total estimated effort: **7-10 business days** for one full-stack engineer or team of 2.

---

## Phase 1: Database Setup & RLS Policies (2 days)

### Goal
Create secure database foundation with Row-Level Security (RLS) for multi-tenant data isolation.

### User Story 1.1: Add User Identity Table

**As a** System Architect  
**I want** a `public.users` table mirroring Supabase Auth  
**So that** we can track user metadata and enforce RLS policies

**Acceptance Criteria:**
- [ ] `public.users` table created with columns: `id (UUID FK to auth.users)`, `email`, `created_at`, `updated_at`, `metadata (JSONB)`
- [ ] Table has RLS enabled: `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`
- [ ] Policy created: users can only see/edit their own row
  ```sql
  CREATE POLICY "users_own_data" ON public.users FOR ALL USING (auth.uid() = id);
  ```
- [ ] ON DELETE CASCADE configured (deleting auth user cascades to public.users)
- [ ] Tested via Supabase dashboard: can insert row, verify SELECT filters to current user

**Tasks:**
- [ ] Write SQL migration file: `server/migrations/001-users-table.sql`
- [ ] Document schema in `brain/wiki/Database-Schema.md`
- [ ] Test with Supabase CLI: `supabase db push`
- [ ] Verify RLS policy works on local Postgres instance

---

### User Story 1.2: Add Company Ownership & RLS

**As a** Product Owner  
**I want** companies to be owned by a specific user  
**So that** users can only see their own companies

**Acceptance Criteria:**
- [ ] `companies` table has new columns:
  - `owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `created_by_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT`
- [ ] Index created: `CREATE INDEX idx_companies_owner_id ON public.companies(owner_id)`
- [ ] RLS policy created:
  ```sql
  CREATE POLICY "companies_owner_access" ON public.companies
    FOR ALL USING (auth.uid() = owner_id);
  ```
- [ ] Existing companies in test DB migrated: either assigned to a test user or flagged for manual review
- [ ] Tested via Supabase dashboard: User A cannot see User B's company

**Tasks:**
- [ ] Write migration: `server/migrations/002-companies-owner.sql`
- [ ] Create data migration script for existing companies (assign to seed user or alert ops)
- [ ] Add migration to CI/CD pipeline
- [ ] Load test with 100+ companies, verify query performance

---

### User Story 1.3: Cascade RLS to All Dependent Tables

**As a** Database Engineer  
**I want** RLS policies cascaded from `companies` to all child tables  
**So that** even if app logic is compromised, DB enforces isolation

**Acceptance Criteria:**
- [ ] RLS enabled and policies created for **all 17 tables**:
  - `agents`, `goals`, `delegations`, `activity_log`, `audit_log`, `tickets`, `ticket_comments`, `task_queue`, `merge_requests`, `sprints`, `project_plans`, `plan_comments`, `notifications`, `configs`, `env_vars`, `token_usage`, `agent_sessions`
- [ ] Each policy filters via `company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())`
- [ ] Cross-table test: Create User A with Company X, User B with Company Y → verify A cannot see Y's agents/tickets
- [ ] No performance regression: Queries on 10M rows with RLS still < 200ms

**Tasks:**
- [ ] Generate SQL for all 17 tables: `server/migrations/003-rls-cascade.sql`
- [ ] Write script to test each table's RLS via Supabase API
- [ ] Benchmark: `EXPLAIN ANALYZE` queries with/without RLS
- [ ] Document in wiki: which tables filter by company vs indirect access

---

## Phase 2: Backend Auth Endpoints (2 days)

### Goal
Implement core JWT-based auth handlers: signup, login, refresh, logout.

### User Story 2.1: Implement Signup Handler

**As a** New User  
**I want** to create an account with email + password  
**So that** I can access the CEO Simulator

**Acceptance Criteria:**
- [ ] `POST /auth/signup` endpoint created in `server/index.ts`
- [ ] Request validation:
  - [ ] Email format validated (regex or email-validator library)
  - [ ] Password length >= 8 chars
  - [ ] Rejects if email already registered (409 Conflict)
- [ ] Supabase Admin API called: `supabase.auth.admin.createUser({ email, password })`
- [ ] Entry created in `public.users` table with user ID
- [ ] JWT tokens generated:
  - [ ] **Access Token**: 15 min expiry, payload includes `{ sub, email, aud, role }`
  - [ ] **Refresh Token**: 7 day expiry, payload includes `{ sub, email, type: "refresh", ... }`
- [ ] Response: `{ access_token, refresh_token, user: { id, email }, expires_in: 900 }`
- [ ] Error handling:
  - [ ] 400: Invalid email/password
  - [ ] 409: Email already exists
  - [ ] 500: Supabase failure
- [ ] Integration test: signup → login with created account → can access `/api/companies`

**Tasks:**
- [ ] Create `server/middleware/authMiddleware.ts` with `verifyJWT()` helper
- [ ] Create `server/handlers/auth.ts` with `signupHandler()` function
- [ ] Add `jsonwebtoken` to `package.json` dependencies
- [ ] Set `SUPABASE_JWT_SECRET` in `.env.local` (read from Supabase dashboard)
- [ ] Write unit tests: `server/__tests__/auth.test.ts` (valid/invalid emails, password strength)
- [ ] Test via Postman: signup with valid/invalid inputs

---

### User Story 2.2: Implement Login Handler

**As an** Existing User  
**I want** to log in with email + password  
**So that** I can access my companies

**Acceptance Criteria:**
- [ ] `POST /auth/login` endpoint created
- [ ] Request: `{ email, password }`
- [ ] Supabase Admin API called: `supabase.auth.admin.signInWithPassword({ email, password })`
- [ ] On success: user ID extracted, same JWT tokens generated as signup
- [ ] Response: `{ access_token, refresh_token, user: { id, email }, expires_in: 900 }`
- [ ] Error handling:
  - [ ] 401: Invalid credentials (generic message, no user enumeration)
  - [ ] 429: Rate limit exceeded (5 attempts per minute per IP)
  - [ ] 500: Supabase failure
- [ ] Integration test: login → access protected endpoint → returns user-owned companies only

**Tasks:**
- [ ] Implement `loginHandler()` in `server/handlers/auth.ts`
- [ ] Add rate limiting middleware: implement token bucket or use `express-rate-limit`
- [ ] Write unit tests: valid/invalid credentials, rate limiting
- [ ] Load test: 100 concurrent login attempts, verify rate limiter works
- [ ] Verify no user enumeration (error message doesn't reveal if email exists)

---

### User Story 2.3: Implement Token Refresh Handler

**As a** Authenticated User  
**I want** to refresh my expired access token  
**So that** I stay logged in without re-entering credentials

**Acceptance Criteria:**
- [ ] `POST /auth/refresh` endpoint created
- [ ] Request: `{ refresh_token }`
- [ ] Validates refresh token:
  - [ ] Signature valid (matches JWT secret)
  - [ ] Not expired
  - [ ] Has `type: "refresh"` claim
- [ ] On success: new access token issued (same 15 min expiry)
- [ ] Optionally: refresh token rotated (new refresh token issued, old one marked revoked)
- [ ] Response: `{ access_token, refresh_token?, expires_in: 900 }`
- [ ] Error handling:
  - [ ] 401: Token expired or invalid signature
  - [ ] 403: Token revoked or wrong type
  - [ ] 500: JWT signing failure

**Tasks:**
- [ ] Implement `refreshTokenHandler()` in `server/handlers/auth.ts`
- [ ] Add `refresh_tokens` table (optional, for revocation tracking)
- [ ] Write unit tests: valid/expired/revoked tokens
- [ ] Test client-side refresh flow via Postman: login → wait 900s → refresh → verify new token works

---

### User Story 2.4: Implement Logout Handler

**As an** Authenticated User  
**I want** to explicitly log out  
**So that** my refresh token becomes invalid

**Acceptance Criteria:**
- [ ] `POST /auth/logout` endpoint created
- [ ] Request: `{ refresh_token }` (optional, for revocation)
- [ ] On success: refresh token marked revoked in DB (if tracking enabled)
- [ ] Response: `{ message: "Logged out successfully" }`
- [ ] Client-side token cleared: localStorage refresh token deleted
- [ ] Attempting to use revoked token returns 403 Forbidden

**Tasks:**
- [ ] Implement `logoutHandler()` in `server/handlers/auth.ts`
- [ ] If using `refresh_tokens` table: implement revocation check in `verifyJWT()`
- [ ] Write unit tests: valid logout, re-using same refresh token
- [ ] Test client-side: logout → try to use old refresh token → 403

---

## Phase 3: Middleware & Endpoint Protection (2 days)

### Goal
Protect all `/api/*` endpoints with JWT auth and company ownership checks.

### User Story 3.1: Apply Auth Middleware to All Protected Routes

**As a** Security Officer  
**I want** all business endpoints guarded by JWT middleware  
**So that** unauthenticated users cannot access data

**Acceptance Criteria:**
- [ ] `verifyJWT()` middleware applied globally:
  ```typescript
  app.use('/api', verifyJWT);
  ```
- [ ] Public endpoints exempted:
  - [ ] `POST /auth/signup`
  - [ ] `POST /auth/login`
  - [ ] `POST /auth/refresh`
  - [ ] `POST /auth/logout`
  - [ ] `GET /api/health` (optional, can add verifyJWTOptional)
- [ ] Middleware extracts user ID from JWT token
- [ ] `req.user` object attached with `{ id, email }`
- [ ] All 50+ endpoints in `server/index.ts` now require valid Authorization header
- [ ] Missing/invalid token returns 401 Unauthorized

**Tasks:**
- [ ] Update `server/index.ts`: add auth middleware before route definitions
- [ ] Create list of public vs protected endpoints in `brain/wiki/Endpoint-Registry.md`
- [ ] Write integration test: call protected endpoint without token → 401
- [ ] Write integration test: call protected endpoint with valid token → success

---

### User Story 3.2: Add Company Ownership Validation to All Endpoints

**As a** Product Lead  
**I want** each endpoint to validate the user owns the company  
**So that** User A cannot steal User B's data

**Acceptance Criteria:**
- [ ] For every endpoint with `companyId` in params/body:
  - [ ] Query DB for company with `owner_id = req.user.id`
  - [ ] Return 403 Forbidden if no match
  - [ ] Example:
    ```typescript
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .eq('owner_id', req.user!.id)
      .single();
    
    if (!company) return res.status(403).json({ error: 'Access denied' });
    ```
- [ ] Endpoints audited: 50+ (list in acceptance criteria details below)
- [ ] Security test: User A creates company X, User B attempts GET `/api/companies/X` → 403

**Sample Endpoints (full list in spec § 7.A):**
- [ ] `POST /api/assign-goal` — validate `companyId` in body
- [ ] `POST /api/companies/:id/review` — validate `:id` in params
- [ ] `GET /api/tasks/:companyId` — validate `:companyId`
- [ ] `GET /api/costs/:companyId` — validate `:companyId`
- [ ] `POST /api/hire-agent` — validate `companyId` in body
- [ ] `DELETE /api/agents/:agentId` — validate agent's company is owned by user
- [ ] (... 40+ more endpoints)

**Tasks:**
- [ ] Create checklist of all 50+ endpoints: `brain/wiki/Endpoint-Audit.md`
- [ ] For each endpoint: add company ownership query + 403 check
- [ ] Write parameterized integration tests for each endpoint class (params, body, agents, etc.)
- [ ] Run full endpoint test suite: all 50+ endpoints tested with User A/B isolation
- [ ] Performance test: verify ownership checks don't exceed 50ms per request

---

### User Story 3.3: Verify RLS Is Enforced

**As a** Database Architect  
**I want** PostgreSQL RLS policies to enforce data isolation  
**So that** if app logic is bypassed, DB still protects data

**Acceptance Criteria:**
- [ ] All 17 tables have RLS enabled
- [ ] RLS policies tested via Supabase dashboard:
  - [ ] User A logged in → can SELECT from `agents` table → only sees their company's agents
  - [ ] User A tries to UPDATE agent from User B's company → 0 rows affected
  - [ ] User A tries to INSERT into `tickets` for User B's company → fails (FK to wrong company)
- [ ] Service role (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS correctly (for daemon tasks)
- [ ] Cross-check: client-side auth + RLS + app-side ownership checks all aligned

**Tasks:**
- [ ] Test each RLS policy in Supabase dashboard: switch user context, verify filtering
- [ ] Write test SQL file: `server/__tests__/rls.test.sql`
- [ ] Verify service role key is **never exposed** to frontend
- [ ] Document RLS policy details in `brain/wiki/RLS-Policies.md`

---

## Phase 4: Frontend Auth Integration (2 days)

### Goal
Build login/signup UI and integrate JWT tokens into all API calls.

### User Story 4.1: Create Auth State Store

**As a** Frontend Developer  
**I want** a Zustand store for auth state  
**So that** login/logout is accessible app-wide

**Acceptance Criteria:**
- [ ] `src/store/authStore.ts` created with:
  - [ ] State: `user`, `accessToken`, `refreshToken`, `isLoading`, `error`
  - [ ] Actions: `signup()`, `login()`, `logout()`, `refreshAccessToken()`, `setTokens()`, `clearAuth()`
- [ ] Signup action:
  - [ ] `POST /auth/signup` with email/password
  - [ ] Stores tokens in state + localStorage (refresh token only)
  - [ ] Sets `isLoading` during request
- [ ] Login action: same pattern as signup
- [ ] Logout action:
  - [ ] `POST /auth/logout` with refresh token
  - [ ] Clears localStorage + state
  - [ ] Redirects to `/login`
- [ ] Token refresh: pulls from localStorage, calls `/auth/refresh`, updates state
- [ ] Error handling: catches network/auth errors, surfaces message in UI
- [ ] Unit test: mock fetch, verify state changes on signup/login/logout

**Tasks:**
- [ ] Implement `authStore.ts` using Zustand + async actions
- [ ] Write unit tests: signup flow, login flow, logout flow, error cases
- [ ] Verify localStorage is cleared on logout
- [ ] Test on real backend: signup → login → logout → cannot access protected routes

---

### User Story 4.2: Create Auth Pages (Login & Signup)

**As a** New User  
**I want** a login/signup page  
**So that** I can create an account and access the app

**Acceptance Criteria:**
- [ ] `src/pages/LoginPage.tsx` created:
  - [ ] Form: email + password fields
  - [ ] Submit button: calls `authStore.login()`
  - [ ] Error display: shows auth errors
  - [ ] Loading state: disables button during request
  - [ ] Link to signup page
  - [ ] On success: redirects to `/` (dashboard)
- [ ] `src/pages/SignupPage.tsx` created:
  - [ ] Form: email + password + confirm password fields
  - [ ] Password strength indicator (8+ chars, uppercase, number)
  - [ ] Submit button: calls `authStore.signup()`
  - [ ] Error display + loading state
  - [ ] Link to login page
  - [ ] On success: auto-redirects to `/` or shows "Welcome" screen
- [ ] Both pages styled: pixel art / HUD theme (see [[UI-Design-System]])
- [ ] Mobile responsive: stacks on mobile, centered on desktop
- [ ] Accessibility: ARIA labels, keyboard navigation, focus management

**Tasks:**
- [ ] Design mockup in Figma/CSS (pixel art frame, CRT scanlines, sci-fi font)
- [ ] Implement LoginPage + SignupPage
- [ ] Add client-side validation (email format, password strength)
- [ ] Test form submission: valid/invalid inputs, network errors, success flow
- [ ] E2E test: signup → logout → login → access dashboard

---

### User Story 4.3: Create Protected Route Component

**As a** Frontend Developer  
**I want** a `<ProtectedRoute>` component  
**So that** unauthenticated users are redirected to login

**Acceptance Criteria:**
- [ ] `src/components/ProtectedRoute.tsx` created
- [ ] Accepts `{ children }` prop
- [ ] Checks `authStore.user && authStore.accessToken`
- [ ] If missing: redirects to `/login` via `useNavigate()`
- [ ] If present: renders children
- [ ] Shows loading spinner while tokens load from localStorage
- [ ] Applied to all private routes in `src/App.tsx`:
  - [ ] `/` (dashboard)
  - [ ] `/company/:id` (company view)
  - [ ] `/company/:id/agents`
  - [ ] `/company/:id/goals`
  - [ ] `/company/:id/costs`
  - [ ] (... all non-auth routes)

**Tasks:**
- [ ] Implement ProtectedRoute component
- [ ] Update React Router config: wrap protected routes
- [ ] Test: unauthenticated user → redirects to `/login`
- [ ] Test: after login → can access all protected routes
- [ ] Test: refresh page → token persists from localStorage → no redirect

---

### User Story 4.4: Update API Calls to Include JWT

**As a** Frontend Developer  
**I want** all API calls to automatically include JWT tokens  
**So that** endpoints receive authenticated requests

**Acceptance Criteria:**
- [ ] `src/lib/api.ts` updated (or new `apiAuth.ts`):
  - [ ] `apiCall<T>(endpoint, options)` function that:
    - [ ] Adds `Authorization: Bearer <accessToken>` header
    - [ ] Adds `Content-Type: application/json` header
    - [ ] On 401 response: calls `authStore.refreshAccessToken()`
    - [ ] Retries request with new token
    - [ ] On refresh failure: redirects to `/login`
  - [ ] Replaces all `fetch()` calls in codebase with `apiCall()`
- [ ] All existing API functions refactored:
  - [ ] `fetchCompanies()`
  - [ ] `createCompany()`
  - [ ] `assignGoal()`
  - [ ] (... all CRUD functions in `src/lib/api.ts`)
- [ ] Error handling: network errors surface to user via toast/modal
- [ ] Test: make call with expired token → auto-refreshes → succeeds

**Tasks:**
- [ ] Create/update `src/lib/api.ts` with auth-aware fetch wrapper
- [ ] Search codebase for bare `fetch()` calls, replace with `apiCall()`
- [ ] Test with real backend: call endpoint with valid token → succeeds
- [ ] Test with real backend: call endpoint with expired token → auto-refreshes → succeeds
- [ ] Test with real backend: call endpoint with invalid token → redirects to login
- [ ] Load test: 100 concurrent requests with token refresh → all succeed

---

## Phase 5: Deployment & Monitoring (1 day)

### Goal
Deploy auth system to production and monitor for issues.

### User Story 5.1: Deploy RLS Policies to Production

**As an** DevOps Engineer  
**I want** RLS policies deployed to production Supabase  
**So that** production data is protected

**Acceptance Criteria:**
- [ ] All migration SQL files merged to `main` branch
- [ ] CI/CD pipeline configured to run Supabase migrations:
  - [ ] `supabase db push` in deploy script
  - [ ] Verify migrations applied before app starts
- [ ] Dry run: run migrations on staging, verify no data loss
- [ ] Production deploy: RLS policies applied, all 17 tables have policies
- [ ] Smoke test: login with test user → can see own companies → cannot see other users' companies
- [ ] Rollback plan: if RLS breaks production, have migration to disable policies

**Tasks:**
- [ ] Add Supabase migration scripts to CI/CD (GitHub Actions / Vercel)
- [ ] Create rollback migration: `server/migrations/rollback-001.sql`
- [ ] Document deployment steps in `brain/wiki/Deployment-Checklist.md`
- [ ] Test on staging environment: full login → data access flow

---

### User Story 5.2: Deploy Auth Endpoints to Production

**As a** DevOps Engineer  
**I want** auth endpoints deployed to production  
**So that** users can sign up and log in

**Acceptance Criteria:**
- [ ] Auth handlers merged to `main` branch
- [ ] `SUPABASE_JWT_SECRET` set as environment variable in Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (only on server, not exposed to frontend)
- [ ] Auth endpoints accessible: `https://ceo-simulator.vercel.app/auth/signup`
- [ ] HTTPS enforced (Vercel default)
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled on `/auth/login`
- [ ] Smoke test: signup → login → access dashboard

**Tasks:**
- [ ] Set env vars in Vercel dashboard
- [ ] Add auth endpoints to Vercel deployment config (`vercel.json`)
- [ ] Test auth flow on staging: signup → login → dashboard
- [ ] Load test: 1000 signup attempts → rate limiting triggers appropriately
- [ ] Verify HTTPS only: redirect HTTP → HTTPS

---

### User Story 5.3: Enable Auth Logging & Monitoring

**As a** Ops Team  
**I want** to log and monitor auth events  
**So that** we can detect security issues

**Acceptance Criteria:**
- [ ] All auth events logged to `activity_log` table:
  - [ ] `signup` — new user created
  - [ ] `login` — successful login
  - [ ] `login_failed` — invalid credentials
  - [ ] `logout` — user logged out
  - [ ] `token_refresh` — token refreshed
  - [ ] `token_expired` — token expired (refresh failed)
- [ ] Log format: `{ type, user_id, email, ip_address, timestamp, result }`
- [ ] Monitoring alerts set up:
  - [ ] 5+ failed logins from same IP in 5 min → alert
  - [ ] Unusual signup pattern (10+ new users in 1 hour) → alert
  - [ ] High token refresh rate → possible token theft → alert
- [ ] Dashboard created: `GET /admin/auth-logs` (admin only)
- [ ] Retention policy: logs kept for 90 days

**Tasks:**
- [ ] Update auth handlers to log events
- [ ] Add `auth_logs` table or use existing `activity_log` with filtering
- [ ] Set up Vercel monitoring alerts (or use Supabase logs)
- [ ] Create admin dashboard component for viewing auth logs
- [ ] Document monitoring thresholds in `brain/wiki/Security-Monitoring.md`

---

### User Story 5.4: Security Audit & Documentation

**As a** Security Officer  
**I want** the auth system audited against OWASP Top 10  
**So that** we meet security standards

**Acceptance Criteria:**
- [ ] OWASP Top 10 checklist completed:
  - [ ] ✅ Broken Access Control — RLS + app-side checks prevent unauthorized access
  - [ ] ✅ Cryptographic Failures — HTTPS enforced, tokens signed with strong secret
  - [ ] ✅ Injection — Supabase parameterized queries prevent SQL injection
  - [ ] ✅ Insecure Design — threat model documented
  - [ ] ✅ Security Misconfiguration — env vars for secrets, CORS restricted
  - [ ] ✅ Vulnerable Components — dependencies up-to-date, no known CVEs
  - [ ] ✅ Authentication Failures — rate limiting, strong password policy, secure token storage
  - [ ] ✅ Software Supply Chain — dependencies audited, lock file committed
  - [ ] ✅ Logging & Monitoring — auth logs captured, alerts configured
  - [ ] ✅ SSRF — N/A for this system
- [ ] Penetration test results: no critical/high findings
- [ ] Third-party security audit completed (if required)
- [ ] Security documentation published: `brain/wiki/Security-Model.md`
- [ ] Team trained: dev team understands RLS, JWT, threat model

**Tasks:**
- [ ] Run OWASP ZAP tool against deployed app
- [ ] Conduct code review: auth handlers, middleware, RLS policies
- [ ] Test common attacks: SQL injection, XSS, CSRF, token theft
- [ ] Write security architecture doc: threat model, trust boundaries
- [ ] Hold security training session with team

---

## Implementation Timeline

```
Week 1:
  Day 1-2: Phase 1 — Database setup (user table, company owner, RLS cascade)
  Day 3-4: Phase 2 — Auth endpoints (signup, login, refresh, logout)
  Day 5:   Phase 3.1 — Middleware + ownership validation (50+ endpoints)

Week 2:
  Day 1-2: Phase 3.2-3.3 — RLS testing & verification
  Day 3-4: Phase 4 — Frontend auth (store, pages, protected routes, API integration)
  Day 5:   Phase 5 — Deployment, monitoring, security audit
```

---

## Acceptance Criteria Summary

### Phase 1 ✅
- [ ] User table created + RLS tested
- [ ] Company owner_id added + RLS tested
- [ ] 17 tables have RLS cascade policies
- [ ] No performance regression

### Phase 2 ✅
- [ ] 4 auth endpoints working (signup, login, refresh, logout)
- [ ] JWT tokens valid + properly signed
- [ ] Error handling covers all cases
- [ ] Rate limiting on login

### Phase 3 ✅
- [ ] All 50+ endpoints protected by `verifyJWT`
- [ ] Each endpoint validates company ownership
- [ ] RLS prevents data leakage at DB level
- [ ] Cross-user isolation test passes

### Phase 4 ✅
- [ ] Auth store (Zustand) working
- [ ] Login/signup pages functional + styled
- [ ] Protected route component redirects unauthenticated users
- [ ] All API calls include JWT token
- [ ] Token refresh works on 401

### Phase 5 ✅
- [ ] RLS policies deployed to production
- [ ] Auth endpoints live on production
- [ ] Logging + monitoring enabled
- [ ] Security audit completed
- [ ] Team trained

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **RLS breaks production** | Test on staging first, keep rollback migration ready |
| **Token theft via XSS** | Store access token in memory, refresh token in httpOnly cookie (Phase 4 enhancement) |
| **Rate limit too strict** | Monitor login failures, adjust threshold if needed |
| **Large data set slow with RLS** | Test with 10M+ rows, optimize indexes |
| **Existing data without owner_id** | Assign to default/test user or manual review (Phase 1) |
| **Token refresh loop (401 → refresh → 401)** | Add max retry count, redirect to login after 2 failures |

---

## Success Metrics

- [ ] 100% of endpoints return 401 without valid JWT
- [ ] 100% of endpoints return 403 if company not owned by user
- [ ] 0 data leakage between users in security audit
- [ ] Login/signup page loads < 2s
- [ ] Token refresh completes < 500ms
- [ ] All 50+ endpoints have integration tests
- [ ] 95%+ test coverage for auth code

---

## References

- [[Auth-System-Spec]] — Full technical specification
- [[Factory-Operations-Manual]] — Project governance
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- JWT Best Practices: https://tools.ietf.org/html/rfc8725
