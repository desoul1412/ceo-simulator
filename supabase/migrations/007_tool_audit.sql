-- Phase 4B: Tool-call audit trail with HMAC proof chain

CREATE TABLE IF NOT EXISTS tool_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB DEFAULT '{}',
  tool_output_summary TEXT,
  cost_usd NUMERIC DEFAULT 0,
  latency_ms INT DEFAULT 0,
  blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  proof TEXT, -- HMAC-SHA256 chain
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON tool_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON tool_audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_tool ON tool_audit_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_audit_blocked ON tool_audit_log(blocked) WHERE blocked = true;
CREATE INDEX IF NOT EXISTS idx_audit_created ON tool_audit_log(created_at);

-- RLS for audit log
ALTER TABLE tool_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_select ON tool_audit_log FOR SELECT
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));
