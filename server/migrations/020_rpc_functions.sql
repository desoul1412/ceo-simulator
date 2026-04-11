-- Migration 020: Postgres RPC functions
-- Extracts and consolidates all server-side RPC functions referenced in application code.
-- Depends on: 002_agents.sql (agents table), 005_tickets.sql (tickets table)
--
-- Functions defined here:
--   • claim_next_ticket   — ticketProcessor.ts:17   supabase.rpc('claim_next_ticket', { p_company_id })
--   • check_stale_agents  — heartbeatDaemon.ts:47   supabase.rpc('check_stale_agents')
--
-- Note: claim_next_ticket was originally inlined in 005_tickets.sql.
-- This migration re-declares it (CREATE OR REPLACE) as the canonical source of truth.
-- The version in 005_tickets.sql remains for backward-compat on fresh installs but this
-- supersedes it for any schema evolution.

-- ── Helper: set_updated_at trigger function (idempotent) ─────────────────────
-- Required by both tables; defined early in 001_companies.sql but re-guarded here
-- so this file can run standalone in test environments.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: claim_next_ticket
-- ─────────────────────────────────────────────────────────────────────────────
-- Atomically selects and claims the oldest 'approved' ticket for a given company,
-- transitioning its status to 'in_progress'. Uses FOR UPDATE SKIP LOCKED to
-- prevent race conditions when multiple daemon ticks fire concurrently.
--
-- Parameters:
--   p_company_id  UUID  — the company whose queue is being processed
--
-- Returns:
--   UUID  — the claimed ticket's id, or NULL if no approved tickets exist
--
-- Referenced in: server/ticketProcessor.ts line 17
--   const { data: ticketId } = await supabase.rpc('claim_next_ticket', { p_company_id: companyId });
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_next_ticket(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  -- Lock the oldest approved ticket for this company; skip any already locked
  -- by a concurrent transaction (SKIP LOCKED prevents blocking / deadlocks).
  SELECT id
    INTO v_ticket_id
    FROM tickets
   WHERE company_id = p_company_id
     AND status     = 'approved'
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- Nothing available — return NULL so the caller knows to skip
  IF v_ticket_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Atomically mark as in_progress
  UPDATE tickets
     SET status     = 'in_progress',
         updated_at = NOW()
   WHERE id = v_ticket_id;

  RETURN v_ticket_id;
END;
$$;

-- Grant execute to the anon / service_role keys Supabase uses
GRANT EXECUTE ON FUNCTION claim_next_ticket(UUID) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: check_stale_agents
-- ─────────────────────────────────────────────────────────────────────────────
-- Identifies agents that have missed their heartbeat window and marks them as
-- 'stale' or 'dead'. Called on every daemon tick from heartbeatDaemon.ts.
--
-- Staleness thresholds:
--   > 2 minutes  without a heartbeat → heartbeat_status = 'stale'
--   > 10 minutes without a heartbeat → heartbeat_status = 'dead'
--                                      status           = 'offline'
--
-- Parameters: none
-- Returns:    void
--
-- Referenced in: server/heartbeatDaemon.ts line 47
--   await supabase.rpc('check_stale_agents');
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_stale_agents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stale_threshold  INTERVAL := INTERVAL '2 minutes';
  dead_threshold   INTERVAL := INTERVAL '10 minutes';
BEGIN
  -- Mark agents as 'stale' when they have missed ~1 heartbeat cycle
  UPDATE agents
     SET heartbeat_status = 'stale',
         updated_at       = NOW()
   WHERE lifecycle_status  = 'active'
     AND heartbeat_status  = 'alive'
     AND last_heartbeat    IS NOT NULL
     AND last_heartbeat   <  NOW() - stale_threshold;

  -- Mark agents as 'dead' and take them offline when they have been silent
  -- for an extended period — likely crashed or network-partitioned.
  UPDATE agents
     SET heartbeat_status = 'dead',
         status           = 'offline',
         updated_at       = NOW()
   WHERE lifecycle_status  IN ('active', 'throttled')
     AND heartbeat_status  IN ('alive', 'stale')
     AND last_heartbeat    IS NOT NULL
     AND last_heartbeat   <  NOW() - dead_threshold;

  -- Agents that were never assigned a last_heartbeat (never started) are left
  -- unchanged; they remain 'idle' and should not be penalised here.
END;
$$;

GRANT EXECUTE ON FUNCTION check_stale_agents() TO anon, authenticated, service_role;
