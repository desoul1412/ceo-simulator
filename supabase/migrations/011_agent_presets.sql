-- 011_agent_presets.sql
-- Two-layer agent preset system: department roles (hiring) + skills (execution)

-- Layer 1: Department Roles (~21 rows) — what the CEO hires from
CREATE TABLE IF NOT EXISTS department_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  dept_index      INT NOT NULL,
  description     TEXT NOT NULL,
  system_prompt   TEXT NOT NULL,
  default_skills  JSONB NOT NULL DEFAULT '[]',
  rules           JSONB NOT NULL DEFAULT '[]',
  model_tier      TEXT NOT NULL DEFAULT 'sonnet'
                    CHECK (model_tier IN ('haiku', 'sonnet', 'opus')),
  default_budget  NUMERIC NOT NULL DEFAULT 10,
  tool_access     TEXT NOT NULL DEFAULT 'core'
                    CHECK (tool_access IN ('core', 'standard', 'full')),
  color           TEXT NOT NULL DEFAULT '#6a7a90',
  sprite_index    INT NOT NULL DEFAULT 0,
  mcp_servers     JSONB NOT NULL DEFAULT '[]',
  source          TEXT NOT NULL DEFAULT 'builtin'
                    CHECK (source IN ('builtin', 'custom')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_roles_slug ON department_roles(slug);
CREATE INDEX IF NOT EXISTS idx_dept_roles_index ON department_roles(dept_index);

-- Layer 2: Skills (476 rows) — loaded on-demand per task
CREATE TABLE IF NOT EXISTS agent_skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dept_role_id    UUID NOT NULL REFERENCES department_roles(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  seniority       TEXT NOT NULL DEFAULT 'Mid-Level',
  company_type    TEXT NOT NULL DEFAULT 'SaaS / Any',
  description     TEXT NOT NULL,
  skill_prompt    TEXT,
  skills_path     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skills_dept ON agent_skills(dept_role_id);
CREATE INDEX IF NOT EXISTS idx_skills_slug ON agent_skills(slug);

-- Link agents to department roles (nullable = backward compat)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS dept_role_id UUID REFERENCES department_roles(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS department TEXT;
