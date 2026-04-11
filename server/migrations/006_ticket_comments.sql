-- Migration 006: ticket_comments table
-- Referenced in: server/ticketProcessor.ts addComment() helper (lines 327-334)

CREATE TABLE IF NOT EXISTS ticket_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  author_type     TEXT NOT NULL DEFAULT 'system',  -- 'system' | 'agent' | 'human'
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_id_idx ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_comments_agent_id_idx ON ticket_comments(agent_id);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_comments_all" ON ticket_comments FOR ALL USING (true);
