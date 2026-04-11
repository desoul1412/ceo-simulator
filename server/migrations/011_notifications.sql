-- Migration 011: notifications table
-- Referenced in: server/ticketProcessor.ts (lines 228-234), server/index.ts (lines 91, 134, 194, 1294, etc.)

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,    -- 'merge_request' | 'sprint' | 'agent' | 'budget' | etc.
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  link            TEXT,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_company_id_idx ON notifications(company_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (true);
