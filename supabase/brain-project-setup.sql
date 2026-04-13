-- ═══════════════════════════════════════════════════════════════════════════
-- Brain Project — Database Setup
-- Create a NEW Supabase project named "brain" in org ouyggdvidbhhjmvruwwt
-- Then run this SQL in the SQL Editor of that project.
-- ═══════════════════════════════════════════════════════════════════════════

-- Brain documents: all brain content (primary storage)
CREATE TABLE IF NOT EXISTS brain_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  company_id TEXT,
  agent_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  doc_type TEXT NOT NULL DEFAULT 'general'
    CHECK (doc_type IN ('soul','context','memory','plan','wiki','changelog','index','summary','sprint')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_docs_path ON brain_documents(path);
CREATE INDEX IF NOT EXISTS idx_brain_docs_company ON brain_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_brain_docs_agent ON brain_documents(agent_id);

-- User settings: per-device configuration
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  orchestrator_url TEXT,
  brain_sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared configs: CLAUDE.md content, MCP templates, global settings
CREATE TABLE IF NOT EXISTS shared_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (optional — disable for single-user setups)
-- ALTER TABLE brain_documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shared_configs ENABLE ROW LEVEL SECURITY;
