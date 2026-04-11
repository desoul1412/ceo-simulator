-- Migration 002: agents table
-- Referenced in: server/agents/agentRunner.ts (lines 39-44, 94-109), server/ticketProcessor.ts, server/index.ts

CREATE TABLE IF NOT EXISTS agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  role                TEXT NOT NULL,                   -- 'CEO' | 'Frontend' | 'Backend' | 'PM' | etc.
  status              TEXT NOT NULL DEFAULT 'idle',    -- 'idle' | 'working' | 'break' | 'offline'
  lifecycle_status    TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'throttled' | 'paused' | 'terminated'
  assigned_task       TEXT,
  progress            INTEGER NOT NULL DEFAULT 0,
  system_prompt       TEXT NOT NULL DEFAULT '',
  memory              JSONB NOT NULL DEFAULT '{}',
  skills              TEXT[] NOT NULL DEFAULT '{}',
  runtime_type        TEXT NOT NULL DEFAULT 'claude_sdk', -- 'claude_sdk' | 'http_endpoint' | 'bash_script' | 'custom'
  runtime_config      JSONB NOT NULL DEFAULT '{}',
  active_session_id   TEXT,
  budget_limit        NUMERIC(12, 6) NOT NULL DEFAULT 10,
  budget_spent        NUMERIC(12, 6) NOT NULL DEFAULT 0,
  total_cost_usd      NUMERIC(12, 6) NOT NULL DEFAULT 0,
  heartbeat_status    TEXT NOT NULL DEFAULT 'alive',   -- 'alive' | 'stale' | 'dead'
  last_heartbeat      TIMESTAMPTZ,
  tile_col            INTEGER,
  tile_row            INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agents_company_id_idx ON agents(company_id);
CREATE INDEX IF NOT EXISTS agents_status_idx ON agents(status);
CREATE INDEX IF NOT EXISTS agents_lifecycle_status_idx ON agents(lifecycle_status);

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_all" ON agents FOR ALL USING (true);
