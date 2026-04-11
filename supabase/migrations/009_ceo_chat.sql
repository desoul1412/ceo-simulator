-- Phase 6A: CEO Chat messages table

CREATE TABLE IF NOT EXISTS ceo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceo_chat_company ON ceo_chat_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_ceo_chat_created ON ceo_chat_messages(created_at);

-- RLS
ALTER TABLE ceo_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY ceo_chat_select ON ceo_chat_messages FOR SELECT
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY ceo_chat_insert ON ceo_chat_messages FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));

CREATE POLICY ceo_chat_delete ON ceo_chat_messages FOR DELETE
  USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid() AND role IN ('owner','admin')));
