-- Migration 003: goals table
-- Goals represent high-level objectives. Tickets reference goal_ancestry (JSONB path).
-- Referenced indirectly in ticketProcessor.ts via t.goal_ancestry

CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  parent_goal_id  UUID REFERENCES goals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',      -- 'active' | 'completed' | 'cancelled'
  ancestry        TEXT[] NOT NULL DEFAULT '{}',        -- breadcrumb of parent goal titles
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goals_company_id_idx ON goals(company_id);
CREATE INDEX IF NOT EXISTS goals_agent_id_idx ON goals(agent_id);
CREATE INDEX IF NOT EXISTS goals_parent_goal_id_idx ON goals(parent_goal_id);

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_all" ON goals FOR ALL USING (true);
