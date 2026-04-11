-- Migration 014: plan_comments table
-- Referenced in: server/index.ts (lines 1464, 1474)

CREATE TABLE IF NOT EXISTS plan_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  author_type     TEXT NOT NULL DEFAULT 'system',   -- 'system' | 'agent' | 'human'
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plan_comments_plan_id_idx ON plan_comments(plan_id);

ALTER TABLE plan_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_comments_all" ON plan_comments FOR ALL USING (true);
