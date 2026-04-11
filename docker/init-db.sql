-- Combined schema for self-hosted PostgreSQL mode.
-- This file is loaded on first docker compose up.
-- For Supabase mode, use the individual migration files.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: When using DATABASE_MODE=postgres, the application uses this base schema.
-- Auth-related tables (user_companies, RLS policies) are Supabase-specific
-- and not needed in self-hosted postgres mode.

-- The full schema is managed by Supabase migrations.
-- This file provides a minimal bootstrap for self-hosted testing.
-- Run the individual supabase/migrations/*.sql files for full schema.
