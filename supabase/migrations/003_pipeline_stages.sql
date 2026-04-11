-- Phase 3A: Pipeline stage tracking on tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pipeline_stage TEXT
  CHECK (pipeline_stage IN ('plan','exec','verify','fix','done'));
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pipeline_artifacts JSONB DEFAULT '{}';
