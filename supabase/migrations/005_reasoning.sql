-- Phase 3B: ReasoningBank trajectory storage
CREATE TABLE IF NOT EXISTS reasoning_trajectories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  task_description TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]',
  outcome TEXT CHECK (outcome IN ('success','failure','partial')),
  confidence NUMERIC DEFAULT 0.5,
  access_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_company ON reasoning_trajectories(company_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_outcome ON reasoning_trajectories(outcome);
