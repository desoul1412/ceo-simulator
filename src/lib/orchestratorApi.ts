/**
 * Client for the local orchestrator server (localhost:3001).
 * The orchestrator manages real Claude Code agent sessions.
 */

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

export interface DelegationPlan {
  reasoning: string;
  subtasks: { role: string; task: string; priority: number }[];
}

export interface AssignGoalResult {
  success: boolean;
  plan: DelegationPlan;
  cost: {
    usd: number;
    inputTokens: number;
    outputTokens: number;
  };
  sessionId: string;
}

export async function isOrchestratorOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assignGoalToOrchestrator(
  companyId: string,
  goal: string,
): Promise<AssignGoalResult> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/assign-goal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, goal }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Orchestrator error: ${res.status}`);
  }

  return res.json();
}

export async function fetchTaskQueue(companyId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/tasks/${companyId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCosts(companyId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/costs/${companyId}`);
  if (!res.ok) return { entries: [], totalCostUsd: 0 };
  return res.json();
}

export async function processQueue(): Promise<{
  processed: boolean;
  taskId?: string;
  result?: any;
  error?: string;
}> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/process-queue`, { method: 'POST' });
  if (!res.ok) return { processed: false, error: 'Request failed' };
  return res.json();
}

export async function hireAgent(config: {
  companyId: string;
  mode: 'auto' | 'manual';
  role: string;
  name?: string;
  systemPrompt?: string;
  skills?: string[];
  monthlyCost?: number;
  model?: string;
}): Promise<{ success: boolean; agent?: any; error?: string }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/hire-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function fireAgent(agentId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/agents/${agentId}`, { method: 'DELETE' });
  return res.json();
}

// ── Repository Management ────────────────────────────────────────────────────

export interface RepoStatus {
  repo_url: string | null;
  repo_branch: string;
  repo_path: string | null;
  repo_status: string;
  repo_error: string | null;
  repo_last_synced_at: string | null;
  git_auth_method: string;
}

export async function connectRepo(companyId: string, config: {
  repoUrl: string;
  branch?: string;
  authMethod?: string;
  token?: string;
}): Promise<{ success: boolean; repoPath?: string; error?: string }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getRepoStatus(companyId: string): Promise<RepoStatus> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/repo`);
  if (!res.ok) return { repo_url: null, repo_branch: 'main', repo_path: null, repo_status: 'not_connected', repo_error: null, repo_last_synced_at: null, git_auth_method: 'none' };
  return res.json();
}

export async function syncRepoApi(companyId: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/repo/sync`, { method: 'POST' });
  return res.json();
}

export async function disconnectRepo(companyId: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/repo`, { method: 'DELETE' });
  return res.ok;
}

// ── Configs CRUD ─────────────────────────────────────────────────────────────

export interface ConfigRow {
  id: string;
  scope: 'global' | 'company' | 'agent';
  scope_id: string | null;
  type: 'skill' | 'mcp_server' | 'rule';
  key: string;
  value: any;
  enabled: boolean;
  created_at: string;
}

export async function fetchConfigs(
  scope: string,
  scopeId?: string,
  type?: string,
): Promise<ConfigRow[]> {
  const params = new URLSearchParams({ scope });
  if (scopeId) params.set('scope_id', scopeId);
  if (type) params.set('type', type);
  const res = await fetch(`${ORCHESTRATOR_URL}/api/configs?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchEffectiveConfigs(agentId: string): Promise<ConfigRow[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/configs/effective/${agentId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createConfig(config: {
  scope: string;
  scope_id?: string;
  type: string;
  key: string;
  value: any;
  enabled?: boolean;
}): Promise<ConfigRow | null> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateConfig(
  id: string,
  updates: { value?: any; enabled?: boolean; key?: string },
): Promise<ConfigRow | null> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/configs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteConfig(id: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/configs/${id}`, { method: 'DELETE' });
  return res.ok;
}

// ── Tickets & Approvals ──────────────────────────────────────────────────────

export async function fetchTickets(companyId: string): Promise<any[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/tickets/${companyId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTicketStatus(companyId: string): Promise<Record<string, number>> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/ticket-status/${companyId}`);
  if (!res.ok) return {};
  return res.json();
}

export async function approveTicket(ticketId: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/approve/${ticketId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedBy: 'CEO (human)' }),
  });
  return res.ok;
}

export async function rejectTicket(ticketId: string, reason?: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/reject/${ticketId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return res.ok;
}

export async function approveAllTickets(companyId: string): Promise<number> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/approve-all/${companyId}`, { method: 'POST' });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.approved ?? 0;
}

// ── Agent Lifecycle ──────────────────────────────────────────────────────────

export async function setAgentLifecycle(agentId: string, status: 'active' | 'paused' | 'throttled' | 'terminated') {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/agents/${agentId}/lifecycle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.ok;
}

export async function setAgentBudget(agentId: string, budgetLimit: number) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/agents/${agentId}/budget`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget_limit: budgetLimit }),
  });
  return res.ok;
}

// ── Daemon Control ───────────────────────────────────────────────────────────

export async function getDaemonStatus(): Promise<{ running: boolean }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/daemon/status`);
  if (!res.ok) return { running: false };
  return res.json();
}

export async function toggleDaemon(start: boolean): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/daemon/${start ? 'start' : 'stop'}`, { method: 'POST' });
  return res.ok;
}

export async function fetchQueueStatus(companyId: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
}> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/queue-status/${companyId}`);
  if (!res.ok) return { pending: 0, processing: 0, completed: 0, failed: 0, isProcessing: false };
  return res.json();
}

// ── Merge Requests ──────────────────────────────────────────────────────────

export async function fetchMergeRequests(companyId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/merge-requests`);
  if (!res.ok) return [];
  return res.json();
}

export async function mergeMR(mrId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/merge-requests/${mrId}/merge`, { method: 'POST' });
  return res.json();
}

export async function rejectMR(mrId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/merge-requests/${mrId}/reject`, { method: 'POST' });
  return res.json();
}

export async function getMRDiff(mrId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/merge-requests/${mrId}/diff`);
  if (!res.ok) return { diff: '' };
  return res.json();
}

// ── Sprints ─────────────────────────────────────────────────────────────────

export async function fetchSprints(companyId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/sprints`);
  if (!res.ok) return [];
  return res.json();
}

export async function createSprint(companyId: string, data: any) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/sprints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ── Plans ───────────────────────────────────────────────────────────────────

export async function fetchPlans(companyId: string, type?: string) {
  const params = type ? `?type=${type}` : '';
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/plans${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createPlan(companyId: string, data: any) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updatePlan(planId: string, content: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function approvePlan(planId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/plans/${planId}/approve`, { method: 'POST' });
  return res.json();
}

export async function addPlanComment(planId: string, content: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/plans/${planId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return res.json();
}

export async function fetchPlanComments(planId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/plans/${planId}/comments`);
  if (!res.ok) return [];
  return res.json();
}

// ── Notifications ───────────────────────────────────────────────────────────

export async function fetchNotifications() {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/notifications`);
  if (!res.ok) return [];
  return res.json();
}

export async function getUnreadCount(): Promise<number> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/notifications/count`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count ?? 0;
}

export async function markRead(notifId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/notifications/${notifId}/read`, { method: 'POST' });
  return res.json();
}

export async function markAllRead() {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/notifications/read-all`, { method: 'POST' });
  return res.json();
}

// ── Env Vars ────────────────────────────────────────────────────────────────

export async function fetchEnvVars(companyId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/env-vars`);
  if (!res.ok) return [];
  return res.json();
}

export async function createEnvVar(companyId: string, data: any) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/env-vars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateEnvVar(envId: string, data: any) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/env-vars/${envId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteEnvVar(envId: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/env-vars/${envId}`, { method: 'DELETE' });
  return res.ok;
}

// ── Ticket Column ───────────────────────────────────────────────────────────

export async function updateTicketColumn(ticketId: string, column: string) {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/tickets/${ticketId}/column`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ board_column: column }),
  });
  return res.json();
}
