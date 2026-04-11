-- Migration 018: project_env_vars table
-- Referenced in: server/index.ts (lines 1683, 1699, 1713, 1723)
-- Per-company secret / environment variable store (encrypted values recommended).

CREATE TABLE IF NOT EXISTS project_env_vars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  value           TEXT NOT NULL,                      -- store encrypted in production
  description     TEXT,
  is_secret       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, key)
);

CREATE INDEX IF NOT EXISTS project_env_vars_company_id_idx ON project_env_vars(company_id);

CREATE TRIGGER project_env_vars_updated_at
  BEFORE UPDATE ON project_env_vars
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE project_env_vars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_env_vars_all" ON project_env_vars FOR ALL USING (true);
