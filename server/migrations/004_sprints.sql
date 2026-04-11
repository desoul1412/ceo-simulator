-- Migration 004: sprints table
-- Referenced in: server/index.ts (lines 58, 81, 121, 147, 1204-1215, etc.)

CREATE TABLE IF NOT EXISTS sprints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  goal            TEXT,
  status          TEXT NOT NULL DEFAULT 'planning',   -- 'planning' | 'active' | 'completed' | 'cancelled'
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sprints_company_id_idx ON sprints(company_id);
CREATE INDEX IF NOT EXISTS sprints_status_idx ON sprints(status);

CREATE TRIGGER sprints_updated_at
  BEFORE UPDATE ON sprints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sprints_all" ON sprints FOR ALL USING (true);
