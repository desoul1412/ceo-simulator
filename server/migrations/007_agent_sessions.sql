-- Migration 007: agent_sessions table
-- Referenced in: server/agents/agentRunner.ts (lines 67-76)
-- Stores per-invocation session info: tokens used, cost, system prompt snapshot.

CREATE TABLE IF NOT EXISTS agent_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  system_prompt        TEXT,
  status               TEXT NOT NULL DEFAULT 'completed',  -- 'active' | 'completed' | 'failed'
  last_invoked_at      TIMESTAMPTZ,
  total_input_tokens   INTEGER NOT NULL DEFAULT 0,
  total_output_tokens  INTEGER NOT NULL DEFAULT 0,
  total_cost_usd       NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_sessions_agent_id_idx ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS agent_sessions_company_id_idx ON agent_sessions(company_id);

CREATE TRIGGER agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_sessions_all" ON agent_sessions FOR ALL USING (true);
