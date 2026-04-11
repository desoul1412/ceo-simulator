-- Migration 015: configs table
-- Referenced in: server/index.ts (lines 697, 712, 722-724, 752, 776, 788)
-- Hierarchical key-value config store: global → company → agent.

CREATE TABLE IF NOT EXISTS configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT NOT NULL DEFAULT 'global',   -- 'global' | 'company' | 'agent'
  scope_id        UUID,                              -- NULL for global, company.id or agent.id otherwise
  key             TEXT NOT NULL,
  value           TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, scope_id, key)
);

CREATE INDEX IF NOT EXISTS configs_scope_idx ON configs(scope, scope_id);

CREATE TRIGGER configs_updated_at
  BEFORE UPDATE ON configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "configs_all" ON configs FOR ALL USING (true);
