-- Phase 2A: Provider tracking columns on token_usage
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'anthropic';
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS latency_ms INT;
