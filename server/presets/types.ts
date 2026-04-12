// ── Two-layer Agent Preset Types ──────────────────────────────────────────────

/** Layer 1: Department Role — what the CEO hires from (~21 rows) */
export interface DepartmentRole {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  dept_index: number;
  description: string;
  system_prompt: string;
  default_skills: string[];
  rules: string[];
  model_tier: 'haiku' | 'sonnet' | 'opus';
  default_budget: number;
  tool_access: 'core' | 'standard' | 'full';
  color: string;
  sprite_index: number;
  mcp_servers: string[];
  source: 'builtin' | 'custom';
  is_active: boolean;
  created_at: string;
}

/** Layer 2: Agent Skill — loaded on-demand per task (476 rows) */
export interface AgentSkill {
  id: string;
  dept_role_id: string;
  slug: string;
  name: string;
  seniority: string;
  company_type: string;
  description: string;
  skill_prompt: string | null;
  skills_path: string | null;
  created_at: string;
}

/** Resolved config for hiring an agent from a department role */
export interface ResolvedHireConfig {
  role: string;
  department: string;
  deptRoleId: string;
  systemPrompt: string;
  skills: string[];
  rules: string[];
  modelTier: 'haiku' | 'sonnet' | 'opus';
  budget: number;
  toolAccess: 'core' | 'standard' | 'full';
  color: string;
  spriteIndex: number;
  mcpServers: string[];
}

/** Legacy role → department slug mapping */
export const LEGACY_ROLE_TO_DEPT: Record<string, string> = {
  PM: 'engineering',
  Frontend: 'engineering',
  Backend: 'engineering',
  DevOps: 'engineering',
  QA: 'engineering',
  Designer: 'engineering',
  'Tech Lead': 'engineering',
  'Full-Stack': 'engineering',
  'AI Engineer': 'engineering',
  Automation: 'engineering',
  Marketer: 'marketing-paid',
  Marketing: 'marketing-paid',
  'Content Writer': 'content',
  Sales: 'sales',
  Operations: 'operations',
  'Data Architect': 'data-analytics',
  'Data Scientist': 'data-analytics',
  'Data Analyst': 'data-analytics',
  'Data Engineer': 'data-analytics',
  Finance: 'finance',
  Growth: 'customer-success',
  SEO: 'seo',
};
