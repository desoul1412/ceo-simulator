-- Migration 008: token_usage table
-- Referenced in: server/agents/agentRunner.ts (lines 78-85), server/index.ts (line 501)
-- Granular per-call token tracking for billing and analytics.

CREATE TABLE IF NOT EXISTS token_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  cost_usd        NUMERIC(12, 6) NOT NULL DEFAULT 0,
  model           TEXT NOT NULL,                          -- e.g. 'claude_sdk', 'gpt-4o', or specific model name
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS token_usage_agent_id_idx ON token_usage(agent_id);
CREATE INDEX IF NOT EXISTS token_usage_company_id_idx ON token_usage(company_id);
CREATE INDEX IF NOT EXISTS token_usage_created_at_idx ON token_usage(created_at DESC);

ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_usage_all" ON token_usage FOR ALL USING (true);
