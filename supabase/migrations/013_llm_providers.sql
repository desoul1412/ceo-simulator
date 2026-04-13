-- LLM Provider & Model Registry + Per-Agent Routing
-- Supports: Claude SDK, Claude API, OpenRouter, Gemini, QwenCode, custom

-- Provider registry
CREATE TABLE IF NOT EXISTS llm_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('sdk', 'http')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Model registry (per provider)
CREATE TABLE IF NOT EXISTS llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'mid' CHECK (tier IN ('fast', 'mid', 'premium')),
  cost_per_1k_input NUMERIC,
  cost_per_1k_output NUMERIC,
  max_context_tokens INT,
  supports_tools BOOLEAN DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-agent model routing (priority-based fallback chain)
-- NULL agent_id + NULL company_id = global default
-- NULL agent_id + company_id = company default
-- agent_id = per-agent override
CREATE TABLE IF NOT EXISTS agent_model_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES llm_models(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_agent ON agent_model_routing(agent_id);
CREATE INDEX IF NOT EXISTS idx_routing_company ON agent_model_routing(company_id);
CREATE INDEX IF NOT EXISTS idx_routing_global ON agent_model_routing(agent_id, company_id) WHERE agent_id IS NULL AND company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_models_provider ON llm_models(provider_id);

-- Seed default Claude SDK provider + models
INSERT INTO llm_providers (slug, name, provider_type, config)
VALUES ('claude-sdk', 'Claude SDK (Local)', 'sdk', '{}')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO llm_models (provider_id, slug, name, model_id, tier, cost_per_1k_input, cost_per_1k_output, max_context_tokens, supports_tools)
SELECT p.id, 'claude-haiku-4-5', 'Claude Haiku 4.5', 'claude-haiku-4-5-20251001', 'fast', 0.0008, 0.004, 200000, true
FROM llm_providers p WHERE p.slug = 'claude-sdk'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO llm_models (provider_id, slug, name, model_id, tier, cost_per_1k_input, cost_per_1k_output, max_context_tokens, supports_tools)
SELECT p.id, 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 'claude-sonnet-4-6', 'mid', 0.003, 0.015, 200000, true
FROM llm_providers p WHERE p.slug = 'claude-sdk'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO llm_models (provider_id, slug, name, model_id, tier, cost_per_1k_input, cost_per_1k_output, max_context_tokens, supports_tools)
SELECT p.id, 'claude-opus-4-6', 'Claude Opus 4.6', 'claude-opus-4-6', 'premium', 0.015, 0.075, 200000, true
FROM llm_providers p WHERE p.slug = 'claude-sdk'
ON CONFLICT (slug) DO NOTHING;

-- Set global default routing: sonnet as primary
INSERT INTO agent_model_routing (agent_id, company_id, model_id, priority)
SELECT NULL, NULL, m.id, 0
FROM llm_models m WHERE m.slug = 'claude-sonnet-4-6'
ON CONFLICT DO NOTHING;
