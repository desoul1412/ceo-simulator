-- Phase 4A: Auth + RLS — user-company membership + row-level security

-- User-company membership table
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner','admin','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);

-- Enable RLS on key tables (policies are permissive — service-role key bypasses them)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- Companies: users can see companies they're members of
CREATE POLICY companies_select ON companies FOR SELECT
  USING (id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY companies_update ON companies FOR UPDATE
  USING (id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role IN ('owner','admin')));

-- Agents: users can see agents in their companies
CREATE POLICY agents_select ON agents FOR SELECT
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY agents_modify ON agents FOR ALL
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role IN ('owner','admin')));

-- Tickets: users can see tickets in their companies
CREATE POLICY tickets_select ON tickets FOR SELECT
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY tickets_modify ON tickets FOR ALL
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role IN ('owner','admin')));

-- User companies: users can see their own memberships
CREATE POLICY user_companies_select ON user_companies FOR SELECT
  USING (user_id = auth.uid());
