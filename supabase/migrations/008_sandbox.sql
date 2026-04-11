-- Phase 5B: Per-company sandbox configuration

ALTER TABLE companies ADD COLUMN IF NOT EXISTS sandbox_mode TEXT DEFAULT 'none'
  CHECK (sandbox_mode IN ('none','docker','e2b'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sandbox_config JSONB DEFAULT '{}';
