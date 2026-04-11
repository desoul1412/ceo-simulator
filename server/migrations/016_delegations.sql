-- Migration 016: delegations table
-- Referenced in: server/ticketProcessor.ts (lines 274-277, 291)
-- Tracks CEO→Agent task delegation chains.

CREATE TABLE IF NOT EXISTS delegations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_agent_id   UUID REFERENCES agents(id) ON DELETE SET NULL,
  to_agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
  progress        INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delegations_company_id_idx ON delegations(company_id);
CREATE INDEX IF NOT EXISTS delegations_to_agent_id_idx ON delegations(to_agent_id);

CREATE TRIGGER delegations_updated_at
  BEFORE UPDATE ON delegations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delegations_all" ON delegations FOR ALL USING (true);
