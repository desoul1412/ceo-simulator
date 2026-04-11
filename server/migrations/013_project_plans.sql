-- Migration 013: project_plans table
-- Referenced in: server/index.ts (lines 104, 1251, 1261, 1275, 1286, 1521)
-- Stores CEO-generated project plans with role-based task breakdown.

CREATE TABLE IF NOT EXISTS project_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'active' | 'completed' | 'cancelled'
  plan_data       JSONB NOT NULL DEFAULT '{}',       -- structured plan: phases, roles, tasks
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_plans_company_id_idx ON project_plans(company_id);
CREATE INDEX IF NOT EXISTS project_plans_status_idx ON project_plans(status);

CREATE TRIGGER project_plans_updated_at
  BEFORE UPDATE ON project_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_plans_all" ON project_plans FOR ALL USING (true);
