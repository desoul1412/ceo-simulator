-- Brain Documents — PostgreSQL-primary brain/memory layer
-- Replaces local Obsidian vault as the source of truth.
-- Documents viewable in frontend, queryable by agents.

-- Enable pgvector for future semantic search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS brain_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  doc_type TEXT NOT NULL DEFAULT 'general'
    CHECK (doc_type IN ('soul','context','memory','plan','wiki','changelog','index','summary','sprint','general')),
  -- pgvector embedding for future semantic search
  embedding vector(768),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_path ON brain_documents(path);
CREATE INDEX IF NOT EXISTS idx_brain_company ON brain_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_brain_agent ON brain_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_brain_type ON brain_documents(doc_type);

-- User settings: per-device configuration
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT,
  orchestrator_url TEXT,
  brain_sync_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared configs: CLAUDE.md content, MCP templates
CREATE TABLE IF NOT EXISTS shared_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
