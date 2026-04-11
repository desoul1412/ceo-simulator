-- Migration 019: users table (OSS multi-tenancy)
-- Adds a users table for authentication and ownership.
-- Also adds owner_id FK to companies table.

-- ─── 1. users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users may only read/update their own row; inserts are open for sign-up.
CREATE POLICY "users_select_own"  ON users FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "users_insert_open" ON users FOR INSERT  WITH CHECK (true);
CREATE POLICY "users_update_own"  ON users FOR UPDATE  USING (auth.uid() = id);
CREATE POLICY "users_delete_own"  ON users FOR DELETE  USING (auth.uid() = id);

-- ─── 2. companies.owner_id ───────────────────────────────────────────────────
-- Add owner_id so each company is tied to a specific user account.
-- Nullable initially to remain backwards-compatible with existing rows.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for lookups like "fetch all companies for this user".
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
