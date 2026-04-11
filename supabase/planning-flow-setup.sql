-- ═══════════════════════════════════════════════════════════════════════════
-- CEO Planning Flow — Database Setup
-- Run this in Supabase SQL Editor to create all required tables & functions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Planning Sessions & Tabs ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS planning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  directive TEXT NOT NULL,
  project_size TEXT NOT NULL DEFAULT 'medium'
    CHECK (project_size IN ('small', 'medium', 'large')),
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'review', 'approved', 'rejected')),
  current_phase INT NOT NULL DEFAULT 0,
  total_phases INT NOT NULL DEFAULT 6,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX idx_planning_sessions_company ON planning_sessions(company_id);

CREATE TABLE IF NOT EXISTS planning_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  tab_key TEXT NOT NULL
    CHECK (tab_key IN ('overview', 'findings', 'research', 'tech_stack', 'architecture', 'hiring_plan', 'implementation_plan')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'draft', 'edited', 'approved', 'skipped')),
  phase_source INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, tab_key)
);

CREATE INDEX idx_planning_tabs_session ON planning_tabs(session_id);


-- ── 2. Ticket Dependencies (DAG) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  blocked_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type IN ('finish_to_start', 'finish_to_finish')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'satisfied', 'broken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'system',
  UNIQUE(blocker_ticket_id, blocked_ticket_id),
  CHECK (blocker_ticket_id <> blocked_ticket_id)
);

CREATE INDEX idx_dep_blocker ON ticket_dependencies(blocker_ticket_id);
CREATE INDEX idx_dep_blocked ON ticket_dependencies(blocked_ticket_id);

-- New columns on tickets for dependency + retry support
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS max_execution_ms INT NOT NULL DEFAULT 600000;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dependency_status TEXT NOT NULL DEFAULT 'ready'
  CHECK (dependency_status IN ('ready', 'blocked', 'partial'));


-- ── 3. Agent Messages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  to_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL
    CHECK (message_type IN (
      'artifact', 'completion_signal', 'clarification_request',
      'clarification_response', 'blocker_report', 'context_share'
    )),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msg_to ON agent_messages(to_agent_id, read_at);
CREATE INDEX idx_msg_ticket ON agent_messages(ticket_id);
CREATE INDEX idx_msg_company ON agent_messages(company_id);


-- ── 4. Dead Letter Queue ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  agent_id UUID REFERENCES agents(id),
  failure_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  errors JSONB NOT NULL DEFAULT '[]',
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);

CREATE INDEX idx_dlq_company ON dead_letter_queue(company_id, resolved_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- RPC Functions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Circular Dependency Check ──────────────────────────────────────────────
-- Returns TRUE if adding (blocker -> blocked) would create a cycle.

CREATE OR REPLACE FUNCTION check_circular_dependency(
  p_blocker_id UUID,
  p_blocked_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  WITH RECURSIVE dep_chain AS (
    -- Start: what blocks the proposed blocker?
    SELECT blocker_ticket_id AS ticket_id, 1 AS depth
    FROM ticket_dependencies
    WHERE blocked_ticket_id = p_blocker_id
      AND status <> 'broken'

    UNION ALL

    SELECT td.blocker_ticket_id, dc.depth + 1
    FROM ticket_dependencies td
    JOIN dep_chain dc ON td.blocked_ticket_id = dc.ticket_id
    WHERE dc.depth < 50
      AND td.status <> 'broken'
  )
  SELECT EXISTS (
    SELECT 1 FROM dep_chain WHERE ticket_id = p_blocked_id
  );
$$;


-- ── Dependency-Aware Ticket Claiming ───────────────────────────────────────
-- Only claims tickets whose ALL dependencies are satisfied.

CREATE OR REPLACE FUNCTION claim_next_ticket_v2(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_id UUID;
BEGIN
  SELECT t.id INTO v_ticket_id
  FROM tickets t
  WHERE t.company_id = p_company_id
    AND t.status = 'approved'
    AND t.dependency_status = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM ticket_dependencies td
      WHERE td.blocked_ticket_id = t.id
        AND td.status = 'pending'
    )
  ORDER BY t.priority ASC NULLS LAST, t.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_ticket_id IS NOT NULL THEN
    UPDATE tickets
    SET status = 'in_progress',
        board_column = 'in_progress',
        started_at = now()
    WHERE id = v_ticket_id;
  END IF;

  RETURN v_ticket_id;
END;
$$;


-- ── Dependency Propagation ─────────────────────────────────────────────────
-- Called when a ticket completes. Marks outgoing edges as satisfied
-- and recalculates dependency_status of downstream tickets.

CREATE OR REPLACE FUNCTION propagate_dependency_satisfaction(
  p_completed_ticket_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mark all edges FROM this ticket as satisfied
  UPDATE ticket_dependencies
  SET status = 'satisfied'
  WHERE blocker_ticket_id = p_completed_ticket_id
    AND status = 'pending';

  -- Recalculate dependency_status for downstream tickets
  UPDATE tickets t
  SET dependency_status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM ticket_dependencies td
      WHERE td.blocked_ticket_id = t.id AND td.status = 'pending'
    ) THEN 'ready'
    WHEN EXISTS (
      SELECT 1 FROM ticket_dependencies td
      WHERE td.blocked_ticket_id = t.id AND td.status = 'satisfied'
    ) THEN 'partial'
    ELSE 'blocked'
  END
  WHERE t.id IN (
    SELECT blocked_ticket_id FROM ticket_dependencies
    WHERE blocker_ticket_id = p_completed_ticket_id
  );
END;
$$;


-- ── Dependency Failure Propagation ─────────────────────────────────────────
-- Called when a ticket permanently fails. Marks edges as broken.

CREATE OR REPLACE FUNCTION propagate_dependency_failure(
  p_failed_ticket_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ticket_dependencies
  SET status = 'broken'
  WHERE blocker_ticket_id = p_failed_ticket_id
    AND status = 'pending';

  -- Recalculate downstream
  UPDATE tickets t
  SET dependency_status = CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM ticket_dependencies td
      WHERE td.blocked_ticket_id = t.id AND td.status = 'pending'
    ) THEN 'ready'
    ELSE 'blocked'
  END
  WHERE t.id IN (
    SELECT blocked_ticket_id FROM ticket_dependencies
    WHERE blocker_ticket_id = p_failed_ticket_id
  );
END;
$$;
