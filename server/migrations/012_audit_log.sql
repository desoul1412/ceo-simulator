-- Migration 012: audit_log table
-- Referenced in: server/ticketProcessor.ts (lines 68-75), server/index.ts (lines 910, 984, 1028)
-- Immutable compliance / financial audit trail.

CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,   -- 'budget_check' | 'lifecycle_change' | 'skill_update' | etc.
  message         TEXT NOT NULL,
  cost_usd        NUMERIC(12, 6),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_company_id_idx ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS audit_log_agent_id_idx ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS audit_log_ticket_id_idx ON audit_log(ticket_id);
CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_all" ON audit_log FOR ALL USING (true);
