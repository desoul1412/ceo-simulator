-- Phase 6C: Clipmart company templates

CREATE TABLE IF NOT EXISTS company_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  author TEXT DEFAULT 'anonymous',
  version TEXT DEFAULT '1.0.0',
  config JSONB NOT NULL DEFAULT '{}',
  downloads INT DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON company_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_downloads ON company_templates(downloads DESC);
