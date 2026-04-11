---
tags: [auth, security, multi-tenancy, jwt, rls]
date: 2026-04-11
status: active
---

# Auth System Specification — JWT + Per-User Company Isolation

Linked from: [[00-Index]], [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]]

> **Spec version:** 2.0 — Complete endpoint audit (57 endpoints), full RLS mapping, migration checklist.  
> **Last updated:** 2026-04-11  

---

## 1. Overview

The CEO Simulator currently has **zero authentication**. All endpoints in `server/index.ts` are public, and there is no per-user company isolation. This spec defines a JWT-based auth system that enables:

- **User Signup & Login** — email + password registration, login token issuance
- **Token Refresh** — short-lived access tokens + long-lived refresh tokens
- **Per-User Company Ownership** — each company belongs to a user; other users cannot see/edit it
- **Per-User Session Context** — authenticated requests carry user ID for RLS filtering
- **Middleware Protection** — all endpoints guarded by middleware that verifies JWT and attaches user context
- **Daemon Safety** — heartbeat/processing daemons use service-role key and never expose user tokens

---

## 2. Database Schema Changes

### A. New Table: `public.users`

Supabase Auth manages the primary identity via `auth.users`, but we need a mirror `public.users` table for RLS metadata and profile data.

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- name, avatar, preferences, etc.
);

-- RLS: Users can only view/edit their own row
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON public.users
  FOR ALL USING (auth.uid() = id);
```

### B. Modify Table: `companies`

Add owner tracking and enforce per-user visibility:

```sql
ALTER TABLE public.companies ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.companies ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.companies ALTER COLUMN owner_id SET NOT NULL;

-- RLS: Users can only see/edit companies they own
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_owner_access" ON public.companies
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX idx_companies_owner_id ON public.companies(owner_id);
```

### C. Cascade RLS to All Dependent Tables

Every table that references `company_id` must gate access through company ownership:

```sql
-- Template (apply to each table listed in Section 8.B):
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<table>_via_company_ownership" ON public.<table>
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
```

**Apply to all 17 dependent tables** — see Section 8 for full list.

### D. Optional: `public.refresh_tokens`

Supabase manages sessions natively. Only needed if you build a custom refresh flow outside Supabase sessions:

```sql
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON public.refresh_tokens(token);
```

---

## 3. Auth Flow — JWT Implementation

### A. Client-Server Architecture

#### Client-Side (React)
```
User → [Email + Password] → POST /auth/signup or /auth/login
  ↓
Response: { access_token, refresh_token, user: { id, email } }
  ↓
Store: access_token in memory (never localStorage), refresh_token in localStorage
  ↓
All API requests: Authorization: Bearer <access_token>
  ↓
On 401: Auto-call POST /auth/refresh → retry original request
```

#### Server-Side (Express + Supabase)
```
Middleware: verifyJWT() → extract user_id from JWT → attach to req.user
  ↓
All business endpoints: Check req.user exists, query with RLS filters
  ↓
When access_token expires: Client calls POST /auth/refresh
  ↓
Server validates refresh_token, issues new access_token (+ rotated refresh_token)
```

### B. Signup Flow

**Endpoint:** `POST /auth/signup`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password-16+"
}
```

**Backend Logic:**
1. Validate email format via regex
2. Validate password: 8+ chars, must contain numbers and uppercase
3. Call `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
4. Insert into `public.users` table
5. Generate JWT tokens:
   - **Access Token** (15 min expiry): `{ sub: userId, email, iat, exp, aud: "authenticated", role: "authenticated" }`
   - **Refresh Token** (7 days expiry): Same payload + `type: "refresh"`
6. Return tokens + user metadata

**Response (201):**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": { "id": "uuid", "email": "user@example.com" },
  "expires_in": 900
}
```

**Error Cases:**
- `400 Bad Request` — Invalid email format or weak password
- `409 Conflict` — Email already registered
- `500 Internal Error` — Supabase failure

### C. Login Flow

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password-16+"
}
```

**Backend Logic:**
1. Call `supabase.auth.admin.signInWithPassword({ email, password })`
2. If valid, extract `userId` from auth session
3. Generate JWT tokens (identical to signup)
4. Return tokens + user metadata

**Response (200):** Same format as signup

**Error Cases:**
- `401 Unauthorized` — Invalid credentials
- `429 Too Many Requests` — Rate limit exceeded (implement token bucket: 5 attempts/min/IP)
- `500 Internal Error` — Supabase failure

### D. Token Refresh Flow

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Backend Logic:**
1. Verify refresh_token signature + expiry using `SUPABASE_JWT_SECRET`
2. Confirm `decoded.type === "refresh"`
3. Issue new access_token (15 min)
4. **Rotate** the refresh_token: issue new 7-day token, mark old as revoked in `public.refresh_tokens`
5. Return new token pair

**Response (200):**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 900
}
```

**Error Cases:**
- `400 Bad Request` — Missing token
- `401 Unauthorized` — Expired token
- `403 Forbidden` — Revoked or invalid token (not a refresh token type)
- `500 Internal Error` — JWT signing failure

### E. Logout Flow

**Endpoint:** `POST /auth/logout`

**Request:** `Authorization: Bearer <access_token>` (and optionally `{ "refresh_token": "..." }` in body)

**Backend Logic:**
1. Mark `refresh_token` as `revoked = true` in `public.refresh_tokens`
2. Optionally call `supabase.auth.admin.signOut(sessionId)`
3. Return success

**Response (200):**
```json
{ "message": "Logged out successfully" }
```

---

## 4. JWT Token Structure

### A. Access Token (Short-lived)

**Algorithm:** HS256 (HMAC SHA-256)  
**Secret:** `SUPABASE_JWT_SECRET` (from Supabase dashboard, env only)  
**Expiry:** 15 minutes

**Payload:**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "iat": 1712816400,
  "exp": 1712817300,
  "aud": "authenticated",
  "role": "authenticated"
}
```

### B. Refresh Token (Long-lived)

**Algorithm:** HS256  
**Secret:** `SUPABASE_JWT_SECRET`  
**Expiry:** 7 days

**Payload:**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "iat": 1712816400,
  "exp": 1713421200,
  "aud": "authenticated",
  "role": "authenticated",
  "type": "refresh"
}
```

---

## 5. Middleware: Auth Guard

### A. Implementation

**File:** `server/middleware/authMiddleware.ts`

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
  token?: string;
}

/**
 * Middleware: Verify JWT and attach user context — BLOCKS if missing/invalid
 */
export function verifyJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const secret = process.env.SUPABASE_JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secret!, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    }) as { sub: string; email: string };

    req.user = { id: decoded.sub, email: decoded.email };
    req.token = token;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Token verification failed' });
  }
}

/**
 * Middleware: Optional auth — attach user if present, continue without if missing
 */
export function verifyJWTOptional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  const token = authHeader.slice(7);
  const secret = process.env.SUPABASE_JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secret!, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    }) as { sub: string; email: string };
    req.user = { id: decoded.sub, email: decoded.email };
    req.token = token;
  } catch {
    // Silent fail — no user context attached
  }
  next();
}

/**
 * Utility: Verify that req.body.companyId or req.params.companyId belongs to req.user
 * Use AFTER verifyJWT middleware on endpoints where you need ownership enforcement.
 */
export async function assertCompanyOwnership(
  supabase: any,
  userId: string,
  companyId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .single();
  return !!data;
}
```

### B. Register on Express App

```typescript
// server/index.ts

import { verifyJWT, verifyJWTOptional } from './middleware/authMiddleware';

// ── Public auth endpoints (no JWT required) ────────────────────────────────
app.post('/auth/signup', signupHandler);
app.post('/auth/login', loginHandler);
app.post('/auth/refresh', refreshTokenHandler);
app.post('/auth/logout', logoutHandler);

// ── Optional auth ──────────────────────────────────────────────────────────
app.get('/api/health', verifyJWTOptional, healthHandler);

// ── All protected API endpoints ────────────────────────────────────────────
// Single middleware line that gates all /api/* routes
app.use('/api', verifyJWT);
```

---

## 6. Auth Endpoint Handlers

### File: `server/handlers/auth.ts`

```typescript
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseAdmin';

// ── Signup ───────────────────────────────────────────────────────────────────
export async function signupHandler(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for demo; disable for production + send verify email
    });

    if (authError) {
      if (authError.message.includes('already registered')) return res.status(409).json({ error: 'Email already registered' });
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user!.id;
    await supabase.from('users').insert({ id: userId, email });

    const { access_token, refresh_token } = generateTokens(userId, email);

    return res.status(201).json({ access_token, refresh_token, user: { id: userId, email }, expires_in: 900 });
  } catch (err) {
    console.error('[signup] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Login ────────────────────────────────────────────────────────────────────
export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const { data: authData, error } = await supabase.auth.admin.signInWithPassword({ email, password });
    if (error || !authData.user) return res.status(401).json({ error: 'Invalid credentials' });

    const { access_token, refresh_token } = generateTokens(authData.user.id, email);
    return res.status(200).json({ access_token, refresh_token, user: { id: authData.user.id, email }, expires_in: 900 });
  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Token Refresh ────────────────────────────────────────────────────────────
export async function refreshTokenHandler(req: Request, res: Response) {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const secret = process.env.SUPABASE_JWT_SECRET!;
    const decoded = jwt.verify(refresh_token, secret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    }) as { sub: string; email: string; type?: string };

    if (decoded.type !== 'refresh') return res.status(403).json({ error: 'Not a refresh token' });

    const { access_token, refresh_token: new_refresh_token } = generateTokens(decoded.sub, decoded.email);

    // TODO: Revoke old refresh token in public.refresh_tokens, store new one
    return res.status(200).json({ access_token, refresh_token: new_refresh_token, expires_in: 900 });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return res.status(401).json({ error: 'Refresh token expired' });
    if (err instanceof jwt.JsonWebTokenError) return res.status(403).json({ error: 'Invalid refresh token' });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────
export async function logoutHandler(req: Request, res: Response) {
  // TODO: Mark refresh_token as revoked in public.refresh_tokens
  return res.status(200).json({ message: 'Logged out successfully' });
}

// ── Helper: Generate token pair ───────────────────────────────────────────────
function generateTokens(userId: string, email: string) {
  const secret = process.env.SUPABASE_JWT_SECRET!;
  const base = { sub: userId, email, aud: 'authenticated', role: 'authenticated' };

  const access_token = jwt.sign(base, secret, { algorithm: 'HS256', expiresIn: '15m' });
  const refresh_token = jwt.sign({ ...base, type: 'refresh' }, secret, { algorithm: 'HS256', expiresIn: '7d' });

  return { access_token, refresh_token };
}
```

---

## 7. Complete Endpoint Auth Mapping

> **Audit source:** `server/index.ts` — full scan as of 2026-04-11  
> **Total endpoints:** 57 (excluding auth routes)

### A. Public / Optional Auth Endpoints

| # | Endpoint | Method | Auth Level | Reason |
|---|----------|--------|------------|--------|
| 1 | `/api/health` | GET | ❌ Optional | Health check; safe to expose; include user info if authenticated |

### B. Core Company & Agent Operations (Require JWT + Ownership Check)

| # | Endpoint | Method | Auth Level | Company ID Source | Notes |
|---|----------|--------|------------|-------------------|-------|
| 2 | `/api/assign-goal` | POST | ✅ JWT + Ownership | `req.body.companyId` | Triggers CEO AI agent — high impact |
| 3 | `/api/companies/:id/review` | POST | ✅ JWT + Ownership | `req.params.id` | CEO project review |
| 4 | `/api/tasks/:companyId` | GET | ✅ JWT + Ownership | `req.params.companyId` | View task queue |
| 5 | `/api/costs/:companyId` | GET | ✅ JWT + Ownership | `req.params.companyId` | Budget analytics |
| 6 | `/api/process-queue` | POST | ✅ JWT + Ownership | `req.body.companyId` | Processes next task |
| 7 | `/api/queue-status/:companyId` | GET | ✅ JWT + Ownership | `req.params.companyId` | Queue status |
| 8 | `/api/hire-agent` | POST | ✅ JWT + Ownership | `req.body.companyId` | Modifies company roster |
| 9 | `/api/agents/:agentId` | DELETE | ✅ JWT + Agent→Company | indirect via `agent.company_id` | Fire agent |
| 10 | `/api/agents/:agentId/inject-skill` | POST | ✅ JWT + Agent→Company | indirect | Runtime skill injection |
| 11 | `/api/agents/:agentId` | PATCH | ✅ JWT + Agent→Company | indirect | Update agent config |
| 12 | `/api/agents/:agentId/lifecycle` | PATCH | ✅ JWT + Agent→Company | indirect | Pause/throttle/terminate |
| 13 | `/api/agents/:agentId/budget` | PATCH | ✅ JWT + Agent→Company | indirect | Adjust per-agent budget |

### C. Configs (Require JWT — Scope-aware ownership)

| # | Endpoint | Method | Auth Level | Notes |
|---|----------|--------|------------|-------|
| 14 | `/api/configs` | GET | ✅ JWT | Filter by `scope_id` (company) → validate ownership |
| 15 | `/api/configs/effective/:agentId` | GET | ✅ JWT + Agent→Company | Effective config merge |
| 16 | `/api/configs` | POST | ✅ JWT + Ownership | `scope_id` must be owned company |
| 17 | `/api/configs/:id` | PATCH | ✅ JWT + Config→Company | Validate config's scope_id ownership |
| 18 | `/api/configs/:id` | DELETE | ✅ JWT + Config→Company | Validate ownership before delete |

### D. Repository Management (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Company ID Source |
|---|----------|--------|------------|-------------------|
| 19 | `/api/companies/:companyId/repo` | POST | ✅ JWT + Ownership | `req.params.companyId` |
| 20 | `/api/companies/:companyId/repo/sync` | POST | ✅ JWT + Ownership | `req.params.companyId` |
| 21 | `/api/companies/:companyId/repo` | GET | ✅ JWT + Ownership | `req.params.companyId` |
| 22 | `/api/companies/:companyId/repo` | DELETE | ✅ JWT + Ownership | `req.params.companyId` |
| 23 | `/api/repos` | GET | ✅ JWT | Returns server-side list; filter to user's companies |
| 24 | `/api/worktrees` | GET | ✅ JWT | Server-internal list; scope to user-owned companies |

### E. Tickets & Approval Gates (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Company ID Source |
|---|----------|--------|------------|-------------------|
| 25 | `/api/tickets/:companyId` | GET | ✅ JWT + Ownership | `req.params.companyId` |
| 26 | `/api/ticket-status/:companyId` | GET | ✅ JWT + Ownership | `req.params.companyId` |
| 27 | `/api/approve/:ticketId` | POST | ✅ JWT + Ticket→Company | Look up ticket, verify company ownership |
| 28 | `/api/reject/:ticketId` | POST | ✅ JWT + Ticket→Company | Look up ticket, verify company ownership |
| 29 | `/api/approve-all/:companyId` | POST | ✅ JWT + Ownership | `req.params.companyId` |

### F. Merge Requests (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Company ID Source |
|---|----------|--------|------------|-------------------|
| 30 | `/api/companies/:id/merge-requests` | GET | ✅ JWT + Ownership | `req.params.id` |
| 31 | `/api/merge-requests/:id/merge` | POST | ✅ JWT + MR→Company | Looks up MR, validates via `company_id` |
| 32 | `/api/merge-requests/:id/reject` | POST | ✅ JWT + MR→Company | Looks up MR, validates |
| 33 | `/api/merge-requests/:id/revert` | POST | ✅ JWT + MR→Company | Looks up MR, validates |
| 34 | `/api/merge-requests/:id/diff` | GET | ✅ JWT + MR→Company | Looks up MR, validates |

### G. Sprints (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Company ID Source |
|---|----------|--------|------------|-------------------|
| 35 | `/api/companies/:id/sprints` | GET | ✅ JWT + Ownership | `req.params.id` |
| 36 | `/api/companies/:id/sprints` | POST | ✅ JWT + Ownership | `req.params.id` |
| 37 | `/api/sprints/:id` | PATCH | ✅ JWT + Sprint→Company | Look up sprint's `company_id`, verify ownership |
| 38 | `/api/sprints/:id/tickets` | GET | ✅ JWT + Sprint→Company | Look up sprint's `company_id` |
| 39 | `/api/sprints/:id/complete` | POST | ✅ JWT + Sprint→Company | High-impact: triggers auto-sprint creation |

### H. Project Plans (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Notes |
|---|----------|--------|------------|-------|
| 40 | `/api/companies/:id/plans` | GET | ✅ JWT + Ownership | `req.params.id` |
| 41 | `/api/companies/:id/plans` | POST | ✅ JWT + Ownership | `req.params.id` |
| 42 | `/api/plans/:id` | PATCH | ✅ JWT + Plan→Company | Validate plan's `company_id` ownership |
| 43 | `/api/plans/:id/approve` | POST | ✅ JWT + Plan→Company | **Critical** — triggers auto-hiring + sprint creation |
| 44 | `/api/plans/:id/comments` | POST | ✅ JWT + Plan→Company | Comment on plan |
| 45 | `/api/plans/:id/comments` | GET | ✅ JWT + Plan→Company | Read plan comments |

### I. Brain / File Operations (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Notes |
|---|----------|--------|------------|-------|
| 46 | `/api/companies/:id/brain/update-summary` | POST | ✅ JWT + Ownership | Writes to filesystem — `brain/<slug>/summary.md` |
| 47 | `/api/companies/:companyId/agents/:agentId/brain/init` | POST | ✅ JWT + Ownership | Initializes agent brain directory |
| 48 | `/api/companies/:companyId/agents/:agentId/brain/update-memory` | POST | ✅ JWT + Ownership | Appends to agent memory.md |

### J. Notifications (Require JWT — User-scoped)

> ⚠️ **Current issue:** Notification endpoints have no `company_id` filter — they return ALL notifications. After auth is added, these must be filtered to the authenticated user's companies.

| # | Endpoint | Method | Auth Level | Required Change |
|---|----------|--------|------------|-----------------|
| 49 | `/api/notifications` | GET | ✅ JWT | Add `.in('company_id', userCompanyIds)` filter |
| 50 | `/api/notifications/:id/read` | POST | ✅ JWT + Ownership | Verify notification's `company_id` is user-owned |
| 51 | `/api/notifications/read-all` | POST | ✅ JWT | Scope `.update()` to user's company IDs only |
| 52 | `/api/notifications/count` | GET | ✅ JWT | Scope count to user's companies |

### K. Environment Variables (Require JWT + Ownership)

| # | Endpoint | Method | Auth Level | Notes |
|---|----------|--------|------------|-------|
| 53 | `/api/companies/:id/env-vars` | GET | ✅ JWT + Ownership | Returns masked secrets |
| 54 | `/api/companies/:id/env-vars` | POST | ✅ JWT + Ownership | `req.params.id` |

### L. Daemon Control (Require JWT — Internal/Admin only)

> ⚠️ **Security Risk:** Daemon start/stop/status endpoints are extremely powerful. They control background processing across ALL companies. Post-auth, these should be further restricted to admin users or an internal service secret.

| # | Endpoint | Method | Auth Level | Additional Restriction |
|---|----------|--------|------------|------------------------|
| 55 | `/api/daemon/start` | POST | ✅ JWT + Admin flag | Consider `INTERNAL_SECRET` header as extra gate |
| 56 | `/api/daemon/stop` | POST | ✅ JWT + Admin flag | Same as above |
| 57 | `/api/daemon/status` | GET | ✅ JWT | Read-only; lower risk |

---

## 8. RLS Implications for Multi-Tenancy

### A. Core RLS Strategy

Every table with a `company_id` column must have this RLS policy applied:

```sql
CREATE POLICY "user_can_access_company_data" ON <table>
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
```

**Why RLS is the correct approach:**
- **Defense in depth:** Even if app-layer logic has a bug, PostgreSQL enforces visibility at query time
- **Zero overhead for correct queries:** RLS filters at DB level, no round-trip needed
- **Service role bypass:** Daemon operations (`supabaseAdmin`) use `SUPABASE_SERVICE_ROLE_KEY` which **bypasses RLS** — safe for system operations, never expose to client

### B. Tables Requiring RLS (Complete List)

| Table | Company FK | RLS Policy Pattern | Special Notes |
|-------|-----------|-------------------|---------------|
| `companies` | N/A — `owner_id` | `owner_id = auth.uid()` | Root policy; all others cascade from this |
| `agents` | `company_id` | Via company ownership | |
| `goals` | `company_id` | Via company ownership | |
| `delegations` | `company_id` | Via company ownership | |
| `activity_log` | `company_id` | Via company ownership | |
| `audit_log` | `company_id` | Via company ownership | |
| `tickets` | `company_id` | Via company ownership | |
| `ticket_comments` | via `ticket_id → company_id` | Join through tickets | |
| `task_queue` | `company_id` | Via company ownership | |
| `merge_requests` | `company_id` | Via company ownership | |
| `sprints` | `company_id` | Via company ownership | |
| `project_plans` | `company_id` | Via company ownership | |
| `plan_comments` | via `plan_id → company_id` | Join through project_plans | |
| `notifications` | `company_id` | Via company ownership | |
| `configs` | `scope_id` (company) | When `scope = 'company'` | Global configs: accessible to all authenticated users |
| `project_env_vars` | `company_id` | Via company ownership | Extra care: contains secrets |
| `token_usage` | via `agent_id → company_id` | Join through agents | |
| `agent_sessions` | via `agent_id → company_id` | Join through agents | |

### C. Ticket Comments — Join-Based RLS

```sql
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_comments_via_company" ON public.ticket_comments
  FOR ALL USING (
    ticket_id IN (
      SELECT id FROM public.tickets
      WHERE company_id IN (
        SELECT id FROM public.companies WHERE owner_id = auth.uid()
      )
    )
  );
```

### D. Global Configs — Multi-Level Access

```sql
-- Global scope configs: any authenticated user can read
CREATE POLICY "global_configs_read" ON public.configs
  FOR SELECT USING (scope = 'global');

-- Company scope: only company owner
CREATE POLICY "company_configs_access" ON public.configs
  FOR ALL USING (
    scope = 'global'
    OR (scope IN ('company', 'agent') AND scope_id::uuid IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    ))
  );
```

### E. Admin Override via Service Role Key

`server/supabaseAdmin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS entirely. This is **intentional** for:
- Heartbeat daemon (`heartbeatDaemon.ts`) — processes all active companies
- Ticket processor (`ticketProcessor.ts`) — runs background job execution
- System-wide operations (sprint auto-completion, brain updates)

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.** It must remain server-only.

---

## 9. Client-Side Auth State Management

### A. Zustand Auth Store

**File:** `src/store/authStore.ts`

```typescript
import { create } from 'zustand';

export interface AuthState {
  user: { id: string; email: string } | null;
  accessToken: string | null;  // In-memory only — NOT persisted
  refreshToken: string | null; // localStorage
  isLoading: boolean;
  error: string | null;

  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null,
  isLoading: false,
  error: null,

  clearAuth: () => {
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null });
  },

  signup: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { access_token, refresh_token, user } = await res.json();
      localStorage.setItem('refreshToken', refresh_token);
      set({ user, accessToken: access_token, refreshToken: refresh_token, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { access_token, refresh_token, user } = await res.json();
      localStorage.setItem('refreshToken', refresh_token);
      set({ user, accessToken: access_token, refreshToken: refresh_token, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      }
    } finally {
      localStorage.removeItem('refreshToken');
      set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem('refreshToken');
      set({ user: null, accessToken: null, refreshToken: null });
      throw new Error('Token refresh failed');
    }
    const { access_token, refresh_token } = await res.json();
    localStorage.setItem('refreshToken', refresh_token);
    set({ accessToken: access_token, refreshToken: refresh_token });
  },
}));
```

### B. Protected Route Component

**File:** `src/components/ProtectedRoute.tsx`

```typescript
import { useAuthStore } from '@/store/authStore';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### C. API Fetch Wrapper with Auto-Refresh

**File:** `src/lib/api.ts` (update existing)

```typescript
import { useAuthStore } from '@/store/authStore';

export async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { accessToken, refreshAccessToken } = useAuthStore.getState();

  if (!accessToken) throw new Error('Not authenticated');

  const makeRequest = (token: string) =>
    fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await makeRequest(accessToken);

  // Auto-refresh on 401 and retry
  if (res.status === 401) {
    try {
      await refreshAccessToken();
      const newToken = useAuthStore.getState().accessToken!;
      res = await makeRequest(newToken);
    } catch {
      window.location.href = '/login';
      throw new Error('Session expired — redirecting to login');
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `API error: ${res.statusText}`);
  }

  return res.json();
}
```

---

## 10. New Routes Required

The following **new frontend routes** must be added to React Router:

| Route | Component | Notes |
|-------|-----------|-------|
| `/login` | `<LoginPage />` | Email + password form, calls `authStore.login()` |
| `/signup` | `<SignupPage />` | Registration form, calls `authStore.signup()` |
| `/logout` | redirect | Clear auth store, redirect to `/login` |

All existing routes (`/`, `/company/:id`, etc.) should be wrapped in `<ProtectedRoute>`.

---

## 11. Migration Checklist

### Phase 1: Database Setup (1 day)
- [ ] Create `public.users` table + RLS policy
- [ ] Add `owner_id` column to `companies` table + index
- [ ] Write and run RLS policies for all 17 dependent tables (see Section 8.B)
- [ ] Test RLS isolation via Supabase dashboard — verify User A cannot read User B's companies
- [ ] Backfill `owner_id` for any existing company rows (assign to a migration user or delete orphans)

### Phase 2: Backend Auth Endpoints (2 days)
- [ ] Create `server/middleware/authMiddleware.ts` — `verifyJWT` + `verifyJWTOptional` + `assertCompanyOwnership`
- [ ] Create `server/handlers/auth.ts` — signup, login, refresh, logout handlers
- [ ] Register auth endpoints in `server/index.ts`
- [ ] Add `app.use('/api', verifyJWT)` to protect all API routes
- [ ] Add `SUPABASE_JWT_SECRET` to `.env` and Vercel secrets
- [ ] Install `jsonwebtoken` + `@types/jsonwebtoken` package

### Phase 3: Endpoint Ownership Enforcement (2 days)
- [ ] Audit all 57 endpoints — add `assertCompanyOwnership` calls where `companyId` is extracted
- [ ] Fix indirect endpoints (agentId → company_id lookup → ownership check)
- [ ] Fix notification endpoints to filter by user's company IDs
- [ ] Add admin guard to daemon endpoints (`/api/daemon/*`)
- [ ] Write integration tests for RLS enforcement (User A cannot call User B's endpoints)

### Phase 4: Frontend Integration (2 days)
- [ ] Create `src/store/authStore.ts`
- [ ] Create `src/components/ProtectedRoute.tsx`
- [ ] Build `/login` and `/signup` pages (Pixel Art / HUD style — see [[UI-Design-System]])
- [ ] Update `src/lib/api.ts` with `apiCall` wrapper + auto-refresh
- [ ] Wrap all existing routes in `<ProtectedRoute>`
- [ ] Test token expiry + refresh cycle

### Phase 5: Deployment & Monitoring (1 day)
- [ ] Deploy RLS policies to production Supabase project `qdhengvarelfdtmycnti`
- [ ] Enable Supabase Auth email confirmation for production
- [ ] Add rate limiting middleware (`express-rate-limit`) on `/auth/login` (5 req/min/IP)
- [ ] Set up alerting for unusual auth failure rates
- [ ] Run OWASP Top 10 security checklist
- [ ] Document admin user creation process for factory seed data

---

## 12. Security Considerations

### A. Attack Vectors & Mitigations

| Attack | Vector | Mitigation |
|--------|--------|-----------|
| **Brute Force** | Guess password | Rate limit `/auth/login`: 5 attempts/min/IP via `express-rate-limit` |
| **Token Theft (XSS)** | JS reads access token | Store access token in memory only; refresh token in `localStorage` (acceptable for SPAs) |
| **Session Fixation** | Reuse old refresh token after logout | Token rotation on every refresh; logout revokes token in DB |
| **Privilege Escalation** | Modify JWT payload client-side | HS256 signature verified server-side on every request |
| **CSRF** | Forged request from external site | `SameSite=Strict` cookie flag; CORS restricted to known origins |
| **RLS Bypass** | SQL injection in app code | Use Supabase parameterized queries; RLS as second line of defense |
| **Daemon Abuse** | Call `/api/daemon/start` to trigger processing | Add admin JWT claim or `INTERNAL_SECRET` header check |
| **Stale Tokens** | Old token used after role change | Short 15-min expiry limits window; refresh flow re-validates user state |

### B. Best Practices

1. **HTTPS Only** — All tokens transmitted over TLS; set `HSTS` header
2. **Secure Secret Storage** — `SUPABASE_JWT_SECRET` only in environment vars (Vercel secrets), never committed
3. **Access Token Memory-Only** — Never `localStorage.setItem('accessToken', ...)` — XSS would steal it
4. **Rotate Refresh Tokens** — Issue new refresh token on every `/auth/refresh` call
5. **CORS Restriction** — Keep existing `cors()` config (localhost + `.vercel.app` only)
6. **Audit Log** — Log all auth events (signup, login, logout, token refresh) to `audit_log` table
7. **Email Verification** — Enable Supabase email confirmation in production (disable `email_confirm: true` in `createUser()`)

---

## 13. Future Enhancements

- [ ] OAuth 2.0 — Google, GitHub (Supabase supports natively)
- [ ] Two-factor authentication (TOTP via `otpauth`)
- [ ] Passwordless magic link login (Supabase `signInWithOtp`)
- [ ] Multi-user company sharing (owner + collaborators with role-based access)
- [ ] API keys for programmatic agent access (no user session required)
- [ ] SSO / SAML for enterprise customers
- [ ] Session management UI — list + revoke active sessions
- [ ] Audit log viewer — display auth events in Settings page

---

## References

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Supabase RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
- **JWT.io debugger:** https://jwt.io/
- **jsonwebtoken npm:** https://www.npmjs.com/package/jsonwebtoken
- **OWASP Auth Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- **express-rate-limit:** https://www.npmjs.com/package/express-rate-limit
- **Project Supabase ID:** `qdhengvarelfdtmycnti`
- Related: [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]], [[Provider-Abstraction-Spec]]
