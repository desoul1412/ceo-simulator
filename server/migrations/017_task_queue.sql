-- Migration 017: task_queue table
-- Referenced in: server/index.ts (line 487)
-- Secondary async work queue distinct from tickets (background jobs, retries, etc.).

CREATE TABLE IF NOT EXISTS task_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,       -- 'agent-run' | 'sprint-advance' | 'budget-check' | etc.
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  priority        INTEGER NOT NULL DEFAULT 5,        -- lower = higher priority
  attempts        INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_queue_status_priority_idx ON task_queue(status, priority ASC, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS task_queue_company_id_idx ON task_queue(company_id);
CREATE INDEX IF NOT EXISTS task_queue_agent_id_idx ON task_queue(agent_id);

ALTER TABLE task_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_queue_all" ON task_queue FOR ALL USING (true);
