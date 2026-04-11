/** Shared row types for DAL repositories */

export interface Company {
  id: string;
  name: string;
  description?: string;
  budget: number;
  budget_spent: number;
  status: string;
  heartbeat_interval_ms?: number;
  auto_approve_tickets?: boolean;
  repo_url?: string;
  repo_branch?: string;
  repo_status?: string;
  repo_path?: string;
  git_auth_method?: string;
  git_token_encrypted?: string;
  created_at: string;
  updated_at?: string;
}

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  role: string;
  status: string;
  assigned_task?: string;
  progress?: number;
  memory?: Record<string, any>;
  skills?: string[];
  system_prompt?: string;
  model?: string;
  runtime_type: string;
  runtime_config?: Record<string, any>;
  budget_limit?: number;
  budget_spent?: number;
  total_cost_usd?: number;
  monthly_cost?: number;
  color?: string;
  desk_position?: Record<string, any>;
  last_heartbeat?: string;
  heartbeat_status?: string;
  active_session_id?: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  company_id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  agent_id?: string;
  parent_ticket_id?: string;
  sprint_id?: string;
  goal_ancestry?: string[];
  story_points?: number;
  board_column?: string;
  retry_count?: number;
  max_retries?: number;
  pipeline_stage?: string;
  pipeline_artifacts?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface Sprint {
  id: string;
  company_id: string;
  name: string;
  number?: number;
  status: string;
  phase_index?: number;
  tasks?: any[];
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface MergeRequest {
  id: string;
  company_id: string;
  ticket_id?: string;
  agent_id?: string;
  title: string;
  description?: string;
  source_branch: string;
  target_branch: string;
  status: string;
  diff_summary?: string;
  files_changed?: number;
  additions?: number;
  deletions?: number;
  created_at: string;
}

export interface Notification {
  id: string;
  company_id: string;
  type: string;
  title: string;
  message?: string;
  read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ActivityLogEntry {
  id?: string;
  company_id: string;
  event_type: string;
  message: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface AuditLogEntry {
  id?: string;
  company_id: string;
  agent_id?: string;
  event_type: string;
  tool_name?: string;
  tool_input?: Record<string, any>;
  message?: string;
  created_at?: string;
}

export interface Config {
  id: string;
  scope: 'global' | 'company' | 'agent';
  scope_id?: string;
  type: string;
  name: string;
  content: Record<string, any>;
  enabled: boolean;
  created_at: string;
}

export interface TokenUsage {
  id?: string;
  agent_id: string;
  company_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
  provider?: string;
  success?: boolean;
  latency_ms?: number;
  created_at?: string;
}

export interface AgentSession {
  id?: string;
  agent_id: string;
  company_id: string;
  system_prompt?: string;
  status: string;
  last_invoked_at?: string;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cost_usd?: number;
  created_at?: string;
}

export interface ProjectPlan {
  id: string;
  company_id: string;
  type: string;
  title: string;
  content?: Record<string, any>;
  status: string;
  session_id?: string;
  created_at: string;
}

export interface DeadLetterEntry {
  id: string;
  company_id: string;
  ticket_id: string;
  agent_id?: string;
  error_summary: string;
  error_history?: any[];
  status: string;
  created_at: string;
}
