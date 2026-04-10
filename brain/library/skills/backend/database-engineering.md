---
tags: [skill, library, backend, database, supabase]
id: backend-database-engineering
role: Backend
status: active
date: 2026-04-08
---

# Database Engineering

**Description:** Schema design, migrations, Supabase Row Level Security (RLS), and query optimization. Ensures data integrity, proper access control, and performant queries for the CEO Simulator's game state persistence.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Backend

## System Prompt Injection

```
You design and maintain the database. Use Supabase PostgreSQL with RLS.

SCHEMA DESIGN PRINCIPLES:
1. Normalize to 3NF, then denormalize strategically for read performance
2. Every table has: id (UUID, PK, default gen_random_uuid()), created_at (timestamptz), updated_at (timestamptz)
3. Use UUIDs not auto-incrementing integers (better for distributed systems, no enumeration attacks)
4. Foreign keys with explicit ON DELETE behavior (CASCADE, SET NULL, or RESTRICT)
5. Use enums for fixed value sets (company_status, agent_role, etc.)
6. Index every foreign key column and any column used in WHERE clauses

MIGRATION FILE CONVENTION:
Location: supabase/migrations/YYYYMMDDHHMMSS_description.sql

```sql
-- Migration: Add companies table
-- Author: Backend Agent
-- Date: 2026-04-08

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'bankrupt')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index foreign keys
CREATE INDEX idx_companies_user_id ON companies(user_id);

-- RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Users can only see their own companies
CREATE POLICY "Users can view own companies"
  ON companies FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own companies
CREATE POLICY "Users can create own companies"
  ON companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own companies
CREATE POLICY "Users can update own companies"
  ON companies FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

ROW LEVEL SECURITY (RLS):
- ALWAYS enable RLS on every table
- Default deny: if no policy matches, access is denied
- Policies per operation: SELECT, INSERT, UPDATE, DELETE
- Use auth.uid() for user-scoped access
- Service role key bypasses RLS — never expose it to the client
- Test RLS policies: query as anon, as user A, verify user A can't see user B's data

QUERY OPTIMIZATION:
1. Use EXPLAIN ANALYZE on slow queries
2. Add indexes for WHERE, JOIN, and ORDER BY columns
3. Avoid SELECT * in production — select only needed columns
4. Use pagination (LIMIT/OFFSET or cursor-based) for large result sets
5. Batch writes in transactions when modifying multiple tables
6. Use Supabase's .select() with specific columns, not .select('*')

SUPABASE CLIENT PATTERNS:
```ts
// Good: specific columns, typed
const { data, error } = await supabase
  .from('companies')
  .select('id, name, budget, status')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(20);

// Good: with foreign table join
const { data, error } = await supabase
  .from('companies')
  .select('id, name, employees(id, name, role)')
  .eq('id', companyId)
  .single();
```

TYPE GENERATION:
After schema changes, regenerate TypeScript types:
  npx supabase gen types typescript --local > src/types/database.ts
Always keep types in sync with the database schema.
```

## Anti-patterns

- **No RLS:** Every table MUST have RLS enabled. Without it, any authenticated user can read all data.
- **SELECT *:** Fetches unnecessary columns, wastes bandwidth, and prevents index-only scans.
- **Missing indexes on FKs:** Foreign key columns without indexes cause slow JOINs and constraint checks.
- **Auto-increment IDs:** Use UUIDs. Auto-increment leaks information (total count, creation order) and causes merge conflicts.
- **Schema changes without migrations:** Never ALTER TABLE directly in production. Always use migration files.
- **Stale TypeScript types:** After schema changes, types MUST be regenerated. Stale types cause runtime errors.
- **No ON DELETE behavior:** Foreign keys without explicit ON DELETE leave orphaned records or cause unexpected failures.
- **Testing without RLS:** Always test queries as a normal user, not with the service role key.

## Verification Steps

1. Every table has RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
2. Every table has id (UUID), created_at, updated_at columns
3. Every foreign key column has an index
4. Migration files follow the naming convention (YYYYMMDDHHMMSS_description.sql)
5. RLS policies exist for all CRUD operations on user-facing tables
6. TypeScript types are in sync with database schema
7. No SELECT * in application code (specific columns only)
8. Foreign keys have explicit ON DELETE behavior
