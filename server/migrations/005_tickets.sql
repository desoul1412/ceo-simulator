-- Migration 005: tickets table
-- Referenced in: server/ticketProcessor.ts (lines 25-39, 263, 309-312), server/index.ts (lines 68, 175, etc.)

CREATE TABLE IF NOT EXISTS tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id            UUID REFERENCES agents(id) ON DELETE SET NULL,
  sprint_id           UUID REFERENCES sprints(id) ON DELETE SET NULL,
  merge_request_id    UUID,                           -- FK to merge_requests added in 010_merge_requests.sql
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'awaiting_approval' | 'approved' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  board_column        TEXT NOT NULL DEFAULT 'backlog', -- 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  priority            TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
  goal_ancestry       TEXT[],                         -- ordered list of parent goal titles (ticketProcessor.ts:102)
  result              JSONB,                          -- AgentRunResult snapshot on completion
  error_message       TEXT,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_company_id_idx ON tickets(company_id);
CREATE INDEX IF NOT EXISTS tickets_agent_id_idx ON tickets(agent_id);
CREATE INDEX IF NOT EXISTS tickets_sprint_id_idx ON tickets(sprint_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
CREATE INDEX IF NOT EXISTS tickets_board_column_idx ON tickets(board_column);

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_all" ON tickets FOR ALL USING (true);

-- ── Stored Procedure: claim_next_ticket ──────────────────────────────────────
-- Atomically locks + claims the next approved ticket for a company.
-- Called in ticketProcessor.ts:17  supabase.rpc('claim_next_ticket', { p_company_id })
CREATE OR REPLACE FUNCTION claim_next_ticket(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  SELECT id INTO v_ticket_id
  FROM tickets
  WHERE company_id = p_company_id
    AND status = 'approved'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_ticket_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE tickets
  SET status = 'in_progress', updated_at = NOW()
  WHERE id = v_ticket_id;

  RETURN v_ticket_id;
END;
$$;
