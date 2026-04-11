---
tags: [auth, security, multi-tenancy, jwt, rls]
date: 2026-04-11
status: active
---

# Auth System Specification — JWT + Per-User Company Isolation

Linked from: [[00-Index]], [[Factory-Operations-Manual]], [[Office-Simulator-Architecture]]

---

## 1. Overview

The CEO Simulator currently has **zero authentication**. All endpoints are public, and there is no per-user company isolation. This spec defines a JWT-based auth system that enables:

- **User Signup & Login** — email + password registration, login token issuance
- **Token Refresh** — short-lived access tokens + long-lived refresh tokens
- **Per-User Company Ownership** — each company belongs to a user; other users cannot see/edit it
- **Per-User Session Context** — authenticated requests carry user ID for RLS filtering
- **Middleware Protection** — all endpoints guarded by middleware that verifies JWT and attaches user context

---

## 2. Database Schema Changes

### A. New Table: `auth.users`

Supabase Auth manages this automatically via `auth.users`, but we need a mirror `public.users` table for RLS + metadata.

```sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- For future: name, avatar, preferences, etc.
);

-- RLS: Users can only view/edit their own row
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_data" ON public.users
  FOR ALL USING (auth.uid() = id);
```

### B. Modify Table: `companies`

Add owner tracking and visibility constraints:

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

### C. Cascade RLS to Dependent Tables

All tables with `company_id` FK must inherit the owner check via RLS:

```sql
-- agents, goals, delegations, tickets, sprints, etc.
-- Example for agents:
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_access_via_company" ON public.agents
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
```

**Apply same pattern to:**
- `agents`
- `goals`
- `delegations`
- `activity_log`
- `audit_log`
- `tickets`
- `ticket_comments`
- `task_queue`
- `merge_requests`
- `sprints`
- `project_plans`
- `plan_comments`
- `notifications`
- `configs`
- `env_vars`
- `token_usage`
- `agent_sessions`

### D. New Table: `auth.refresh_tokens`

Store long-lived refresh tokens in Supabase Auth's schema (automatic via Supabase) or custom table:

```sql
-- Optional: If you want to manage refresh tokens manually (not recommended — use Supabase sessions)
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
Store: access_token in memory (or secure httpOnly cookie), refresh_token in localStorage
  ↓
All API requests: Authorization: Bearer <access_token>
```

#### Server-Side (Express + Supabase)
```
Middleware: verifyJWT() → extract user_id from JWT → attach to req.user
  ↓
All business endpoints: Check req.user exists, query with RLS filters
  ↓
When access_token expires: Client calls POST /auth/refresh
  ↓
Server validates refresh_token, issues new access_token
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
1. Validate email format, password strength (8+ chars, numbers + uppercase)
2. Call `supabase.auth.admin.createUser({ email, password })`
3. Create entry in `public.users` table
4. Generate JWT tokens:
   - **Access Token** (15 min expiry): `{ sub: userId, email, iat, exp }`
   - **Refresh Token** (7 days expiry): Store in `refresh_tokens` table or Supabase sessions
5. Return tokens + user metadata

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "expires_in": 900
}
```

**Error Cases:**
- `400 Bad Request` — Invalid email/password
- `409 Conflict` — Email already exists
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
1. Validate email/password against `auth.users` via Supabase
2. Call `supabase.auth.signInWithPassword({ email, password })`
3. If valid, extract user ID from auth session
4. Generate JWT tokens (same as signup)
5. Return tokens + user metadata

**Response:** Same format as signup

**Error Cases:**
- `401 Unauthorized` — Invalid credentials
- `429 Too Many Requests` — Rate limit exceeded (implement token bucket)
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
1. Validate refresh_token signature + expiry
2. If valid, extract user_id from token payload
3. Issue new access_token (15 min expiry)
4. Optionally rotate refresh_token (issue new one, mark old as revoked)
5. Return new tokens

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_in": 900
}
```

**Error Cases:**
- `401 Unauthorized` — Invalid/expired refresh token
- `403 Forbidden` — Token revoked
- `500 Internal Error` — JWT signing failure

### E. Logout Flow

**Endpoint:** `POST /auth/logout`

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Backend Logic:**
1. Revoke refresh_token in `refresh_tokens` table (set `revoked = true`)
2. Optionally call `supabase.auth.admin.deleteSession(sessionId)`
3. Return success

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

## 4. JWT Token Structure

### A. Access Token (Short-lived)

**Algorithm:** HS256 (HMAC SHA-256)  
**Secret:** `SUPABASE_JWT_SECRET` (from Supabase dashboard)  
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
**Expiry:** 7 days (604,800 seconds)

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

### A. Implementation Pattern

**File:** `server/middleware/authMiddleware.ts`

```typescript
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
  token?: string;
}

/**
 * Middleware: Verify JWT and attach user context to request
 */
export function verifyJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
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
 * Middleware: Optional auth (attach user if token present, don't reject if missing)
 */
export function verifyJWTOptional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without user context
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
  } catch (error) {
    // Silently fail; continue without user context
  }

  next();
}
```

### B. Apply to Express App

**File:** `server/index.ts`

```typescript
import { verifyJWT, verifyJWTOptional } from './middleware/authMiddleware';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Public auth endpoints (no JWT required)
app.post('/auth/signup', signupHandler);
app.post('/auth/login', loginHandler);
app.post('/auth/refresh', refreshTokenHandler);
app.post('/auth/logout', logoutHandler);

// Optional auth — useful for public APIs that track users if authenticated
app.get('/api/health', verifyJWTOptional, healthHandler);

// Protected endpoints — all require valid JWT
app.use('/api', verifyJWT);

app.get('/api/companies/:id', async (req, res) => {
  // req.user.id is now guaranteed to exist
  const { id } = req.params;
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return res.status(400).json({ error });
  if (!data) return res.status(404).json({ error: 'Company not found' });
  
  // RLS automatically filters: user can only see if they own it
  res.json(data);
});

// ... rest of endpoints
```

---

## 6. Auth Endpoint Handlers

### A. Signup Handler

**File:** `server/handlers/auth.ts`

```typescript
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabaseAdmin';

interface SignupRequest {
  email: string;
  password: string;
}

export async function signupHandler(req: Request<{}, {}, SignupRequest>, res: Response) {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for demo; remove for production
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user!.id;

    // Create user metadata in public.users
    await supabase.from('users').insert({
      id: userId,
      email,
    });

    // Generate JWT tokens
    const secret = process.env.SUPABASE_JWT_SECRET!;
    const now = Math.floor(Date.now() / 1000);

    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        aud: 'authenticated',
        role: 'authenticated',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        sub: userId,
        email,
        aud: 'authenticated',
        role: 'authenticated',
        type: 'refresh',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    return res.status(201).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: userId,
        email,
      },
      expires_in: 900,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function loginHandler(req: Request<{}, {}, SignupRequest>, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userId = authData.user.id;

    const secret = process.env.SUPABASE_JWT_SECRET!;

    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        aud: 'authenticated',
        role: 'authenticated',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        sub: userId,
        email,
        aud: 'authenticated',
        role: 'authenticated',
        type: 'refresh',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    return res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: userId,
        email,
      },
      expires_in: 900,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refreshTokenHandler(
  req: Request<{}, {}, { refresh_token: string }>,
  res: Response
) {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const secret = process.env.SUPABASE_JWT_SECRET!;
    const decoded = jwt.verify(refresh_token, secret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    }) as { sub: string; email: string; type?: string };

    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Not a refresh token' });
    }

    const accessToken = jwt.sign(
      {
        sub: decoded.sub,
        email: decoded.email,
        aud: 'authenticated',
        role: 'authenticated',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    return res.status(200).json({
      access_token: accessToken,
      refresh_token, // Can optionally rotate here
      expires_in: 900,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    console.error('Token refresh error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logoutHandler(
  req: Request<{}, {}, { refresh_token?: string }>,
  res: Response
) {
  // For simplicity, just return success
  // In production, you'd revoke the refresh_token in the DB
  return res.status(200).json({ message: 'Logged out successfully' });
}
```

---

## 7. Endpoints: Current Status & Auth Mapping

### A. Current Unprotected Endpoints (from `server/index.ts`)

| Endpoint | Method | Requires Auth | Company Filter | Notes |
|----------|--------|---------------|-----------------|-------|
| `/api/health` | GET | ❌ Optional | N/A | Health check, can be public |
| `/api/assign-goal` | POST | ✅ **YES** | `req.body.companyId` | Task assignment |
| `/api/companies/:id/review` | POST | ✅ **YES** | `req.params.id` | CEO review |
| `/api/tasks/:companyId` | GET | ✅ **YES** | `req.params.companyId` | Task queue |
| `/api/costs/:companyId` | GET | ✅ **YES** | `req.params.companyId` | Budget analytics |
| `/api/process-queue` | POST | ✅ **YES** | `req.body.companyId` | Queue processing |
| `/api/queue-status/:companyId` | GET | ✅ **YES** | `req.params.companyId` | Queue status |
| `/api/worktrees` | GET | ✅ **YES** | `req.body.companyId` | Git worktrees |
| `/api/hire-agent` | POST | ✅ **YES** | `req.body.companyId` | Agent hiring |
| `/api/agents/:agentId` | DELETE | ✅ **YES** | *(indirect via agent)* | Agent deletion |
| `/api/configs` | GET | ✅ **YES** | N/A | Agent configs |
| `/api/configs/effective/:agentId` | GET | ✅ **YES** | *(indirect)* | Effective config |
| `/api/configs` | POST | ✅ **YES** | `req.body.scope_id` | Config creation |
| `/api/configs/:id` | PATCH | ✅ **YES** | *(indirect)* | Config update |
| `/api/configs/:id` | DELETE | ✅ **YES** | *(indirect)* | Config deletion |
| `/api/companies/:companyId/repo` | POST | ✅ **YES** | `req.params.companyId` | Repo init |
| `/api/companies/:companyId/repo/sync` | POST | ✅ **YES** | `req.params.companyId` | Repo sync |
| `/api/companies/:companyId/repo` | GET | ✅ **YES** | `req.params.companyId` | Repo status |
| `/api/companies/:companyId/repo` | DELETE | ✅ **YES** | `req.params.companyId` | Repo deletion |
| `/api/repos` | GET | ✅ **YES** | `req.body.companyId` | List repos |
| `/api/tickets/:companyId` | GET | ✅ **YES** | `req.params.companyId` | Tickets list |
| `/api/ticket-status/:companyId` | GET | ✅ **YES** | `req.params.companyId` | Ticket status |
| `/api/approve/:ticketId` | POST | ✅ **YES** | *(indirect)* | Ticket approval |
| `/api/reject/:ticketId` | POST | ✅ **YES** | *(indirect)* | Ticket rejection |
| `/api/approve-all/:companyId` | POST | ✅ **YES** | `req.params.companyId` | Bulk approval |
| **... (40+ more)** | | | | See full list below |

### B. Full Endpoint Auth Checklist

All 50+ endpoints require:

1. ✅ **Add `verifyJWT` middleware** to `app.use('/api', verifyJWT)`
2. ✅ **Extract user ID** from `req.user.id`
3. ✅ **Add company ownership check** before returning data
4. ✅ **Validate company_id belongs to user** via query filter:
   ```typescript
   const { data: company } = await supabase
     .from('companies')
     .select('*')
     .eq('id', companyId)
     .eq('owner_id', req.user!.id) // ← Enforce ownership
     .single();
   
   if (!company) {
     return res.status(403).json({ error: 'Access denied' });
   }
   ```

### C. Migration Strategy

**Phase 1 (Quick):** Apply RLS policies + apply `verifyJWT` to all `/api/*` routes
```typescript
app.use('/api', verifyJWT);
```

**Phase 2 (Systematic):** Audit each endpoint, add company ownership checks where `companyId` is extracted from params/body:
- All endpoints with `req.params.companyId` → validate ownership
- All endpoints with `req.body.companyId` → validate ownership
- All endpoints with `req.params.agentId` → validate agent belongs to company owned by user

**Phase 3 (Testing):** Write integration tests for each endpoint to verify RLS is enforced

---

## 8. RLS Implications for Multi-Tenancy

### A. Core RLS Strategy

Every table with a `company_id` must have a policy like:

```sql
CREATE POLICY "user_can_access_company_data" ON <table>
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
```

**Why?**
- **Data Isolation:** Even if a user bypasses app logic, PostgreSQL enforces visibility
- **Fallback Security:** RLS is the last line of defense
- **Performance:** RLS filters at DB level (no app-side filtering needed)

### B. Tables Requiring RLS

| Table | Company FK | RLS Policy |
|-------|-----------|-----------|
| `companies` | N/A | `owner_id = auth.uid()` |
| `agents` | `company_id` | Via company ownership |
| `goals` | `company_id` | Via company ownership |
| `delegations` | `company_id` | Via company ownership |
| `activity_log` | `company_id` | Via company ownership |
| `audit_log` | `company_id` | Via company ownership |
| `tickets` | `company_id` | Via company ownership |
| `ticket_comments` | *(via ticket)* | Via ticket access |
| `task_queue` | `company_id` | Via company ownership |
| `merge_requests` | `company_id` | Via company ownership |
| `sprints` | `company_id` | Via company ownership |
| `project_plans` | `company_id` | Via company ownership |
| `plan_comments` | *(via plan)* | Via plan access |
| `notifications` | `company_id` | Via company ownership |
| `configs` | `scope_id` (company) | Via company ownership |
| `env_vars` | `company_id` | Via company ownership |
| `token_usage` | *(via agent)* | Via agent access |
| `agent_sessions` | *(via agent)* | Via agent access |

### C. Example: Cascade RLS from Companies to Agents

**Agents table:**
```sql
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_via_company_ownership" ON public.agents
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
```

**Tickets table (inherits via agent):**
```sql
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_via_company_ownership" ON public.tickets
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );
```

### D. Admin Override via Service Role

The server-side `supabaseAdmin` client (using `SUPABASE_SERVICE_ROLE_KEY`) **bypasses RLS**. This is safe for:
- Daemon operations (heartbeat processor, ticket processor)
- System-wide operations (backups, migrations)
- But **never expose this to front-end** (service key must stay on server)

---

## 9. Client-Side Auth State Management

### A. Zustand Store for Auth

**File:** `src/store/authStore.ts`

```typescript
import { create } from 'zustand';

export interface AuthState {
  user: { id: string; email: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: AuthState['user']) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('refreshToken', refreshToken);
    set({ accessToken, refreshToken });
  },
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
      if (!res.ok) throw new Error(await res.text());
      const { access_token, refresh_token, user } = await res.json();
      set({ user, accessToken: access_token, refreshToken: refresh_token, isLoading: false });
      localStorage.setItem('refreshToken', refresh_token);
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
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
      if (!res.ok) throw new Error(await res.text());
      const { access_token, refresh_token, user } = await res.json();
      set({ user, accessToken: access_token, refreshToken: refresh_token, isLoading: false });
      localStorage.setItem('refreshToken', refresh_token);
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
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
      set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
      localStorage.removeItem('refreshToken');
    }
  },

  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    try {
      const res = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) throw new Error('Token refresh failed');
      const { access_token } = await res.json();
      set({ accessToken: access_token });
    } catch (error) {
      set({ user: null, accessToken: null, refreshToken: null });
      localStorage.removeItem('refreshToken');
      throw error;
    }
  },
}));
```

### B. Protected Route Component

**File:** `src/components/ProtectedRoute.tsx`

```typescript
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !accessToken) {
      navigate('/login');
    }
  }, [user, accessToken, navigate]);

  if (!user || !accessToken) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}
```

### C. Attach JWT to All API Calls

**File:** `src/lib/api.ts` (update existing)

```typescript
import { useAuthStore } from '@/store/authStore';

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const { accessToken, refreshAccessToken } = useAuthStore.getState();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  let res = await fetch(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  // If 401, try refreshing token
  if (res.status === 401) {
    try {
      await refreshAccessToken();
      const newToken = useAuthStore.getState().accessToken;
      res = await fetch(endpoint, {
        ...options,
        headers: {
          ...options?.headers,
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Redirect to login
      window.location.href = '/login';
      throw error;
    }
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.statusText}`);
  }

  return res.json();
}
```

---

## 10. Migration Checklist

### Phase 1: Database Setup (1 day)
- [ ] Create `public.users` table + RLS
- [ ] Add `owner_id` to `companies` table
- [ ] Create RLS policies for all 17 dependent tables
- [ ] Test RLS with Supabase dashboard queries

### Phase 2: Backend Auth (2 days)
- [ ] Write auth handlers (signup, login, refresh, logout)
- [ ] Implement `verifyJWT` middleware
- [ ] Add auth endpoints to Express app
- [ ] Add JWT token signing logic
- [ ] Test auth flow manually via Postman

### Phase 3: Endpoint Protection (2 days)
- [ ] Apply `verifyJWT` middleware to all `/api/*` routes
- [ ] Audit 50+ endpoints, add company ownership checks
- [ ] Write unit tests for auth + RLS enforcement
- [ ] Test cross-user isolation (User A cannot see User B's companies)

### Phase 4: Frontend Integration (2 days)
- [ ] Build `authStore.ts` with Zustand
- [ ] Create `ProtectedRoute` component
- [ ] Build login/signup pages
- [ ] Update all API calls to include JWT
- [ ] Test token refresh on 401 responses

### Phase 5: Deployment & Monitoring (1 day)
- [ ] Deploy RLS policies to production
- [ ] Enable logging for auth failures
- [ ] Set up alerts for unusual auth patterns
- [ ] Perform security audit (OWASP Top 10)
- [ ] Document auth system for ops team

---

## 11. Security Considerations

### A. Attack Vectors & Mitigations

| Attack | Vector | Mitigation |
|--------|--------|-----------|
| **Brute Force** | Guess password | Rate limit `/auth/login` (5 attempts/min/IP) |
| **Token Theft** | XSS → steal access token | Store tokens in memory + httpOnly cookies for refresh |
| **Session Fixation** | Reuse old refresh token | Implement token rotation + expiry checks |
| **Privilege Escalation** | Modify JWT client-side | Verify signature server-side (always) |
| **CSRF** | Forged cross-origin request | Use SameSite cookie flag + CSRF token |
| **RLS Bypass** | SQL injection in RLS policy | Use parameterized queries (Supabase does this) |

### B. Best Practices

1. **HTTPS Only** — Never transmit tokens over unencrypted connections
2. **Secure Storage** — Keep `SUPABASE_JWT_SECRET` as env var, never in code
3. **Token Expiry** — Access tokens 15 min, refresh tokens 7 days (rotate if possible)
4. **Rate Limiting** — Implement per-IP rate limits on auth endpoints
5. **Audit Logging** — Log all auth events (signup, login, logout, token refresh)
6. **CORS** — Restrict allowed origins to your domain
7. **HSTS** — Enable HTTP Strict Transport Security

---

## 12. Future Enhancements

- [ ] OAuth 2.0 integration (Google, GitHub, Slack)
- [ ] Two-factor authentication (TOTP/SMS)
- [ ] Passwordless login (magic links via email)
- [ ] Social login (share company access with other users)
- [ ] API keys for programmatic access
- [ ] SSO integration (SAML for enterprise)
- [ ] Session management UI (revoke active sessions)
- [ ] Audit log viewer (admin dashboard)

---

## References

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **JWT.io:** https://jwt.io/
- **OWASP Auth Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- **Supabase RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
