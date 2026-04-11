-- Migration 010: merge_requests table
-- Referenced in: server/ticketProcessor.ts (lines 212-235, 1072-1181), server/index.ts

CREATE TABLE IF NOT EXISTS merge_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id       UUID REFERENCES tickets(id) ON DELETE SET NULL,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  branch_name     TEXT NOT NULL,
  target_branch   TEXT NOT NULL DEFAULT 'main',
  status          TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'merged' | 'closed' | 'rejected'
  title           TEXT,
  files_changed   INTEGER NOT NULL DEFAULT 0,
  insertions      INTEGER NOT NULL DEFAULT 0,
  deletions       INTEGER NOT NULL DEFAULT 0,
  diff_summary    TEXT,                            -- newline-separated list of changed file paths
  merged_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS merge_requests_company_id_idx ON merge_requests(company_id);
CREATE INDEX IF NOT EXISTS merge_requests_ticket_id_idx ON merge_requests(ticket_id);
CREATE INDEX IF NOT EXISTS merge_requests_agent_id_idx ON merge_requests(agent_id);
CREATE INDEX IF NOT EXISTS merge_requests_status_idx ON merge_requests(status);

CREATE TRIGGER merge_requests_updated_at
  BEFORE UPDATE ON merge_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE merge_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merge_requests_all" ON merge_requests FOR ALL USING (true);

-- Add FK from tickets → merge_requests now that merge_requests exists
ALTER TABLE tickets
  ADD CONSTRAINT tickets_merge_request_id_fkey
  FOREIGN KEY (merge_request_id) REFERENCES merge_requests(id) ON DELETE SET NULL;
