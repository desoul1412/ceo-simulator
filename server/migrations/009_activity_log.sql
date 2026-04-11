-- Migration 009: activity_log table
-- Referenced in: server/ticketProcessor.ts (lines 86-91), server/index.ts (many locations)
-- Immutable append-only event feed per company.

CREATE TABLE IF NOT EXISTS activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,   -- 'task-started' | 'task-completed' | 'agent-hired' | 'sprint-started' | etc.
  message         TEXT NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_company_id_idx ON activity_log(company_id);
CREATE INDEX IF NOT EXISTS activity_log_agent_id_idx ON activity_log(agent_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log(created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_log_all" ON activity_log FOR ALL USING (true);
