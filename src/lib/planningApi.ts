/**
 * API client for the V2 multi-tab planning flow.
 */

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3001';

// ── Planning Sessions ──────────────────────────────────────────────────────

export interface PlanningSession {
  id: string;
  company_id: string;
  directive: string;
  project_size: 'small' | 'medium' | 'large';
  status: 'generating' | 'review' | 'approved' | 'rejected';
  current_phase: number;
  total_phases: number;
  cost_usd: number;
  created_at: string;
  approved_at: string | null;
}

export interface PlanningTab {
  id: string;
  session_id: string;
  tab_key: string;
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'draft' | 'edited' | 'approved' | 'skipped';
  phase_source: number | null;
  sort_order: number;
}

export async function startPlanningSession(
  companyId: string,
  directive: string,
  projectSize: 'small' | 'medium' | 'large' = 'medium',
): Promise<{ sessionId: string; tabs: PlanningTab[] }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/plan-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directive, projectSize }),
  });
  if (!res.ok) throw new Error(`Failed to start planning: ${res.status}`);
  return res.json();
}

export async function pollPlanningSession(
  companyId: string,
  sessionId: string,
): Promise<{ session: PlanningSession; tabs: PlanningTab[] }> {
  const res = await fetch(
    `${ORCHESTRATOR_URL}/api/companies/${companyId}/plan-session/${sessionId}`,
  );
  if (!res.ok) throw new Error(`Failed to poll session: ${res.status}`);
  return res.json();
}

export async function approvePlanningSession(
  sessionId: string,
  editedTabs?: Record<string, string>,
): Promise<{ success: boolean; hired: string[]; ticketsCreated: number }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/plan-session/${sessionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editedTabs }),
  });
  if (!res.ok) throw new Error(`Failed to approve: ${res.status}`);
  return res.json();
}

export async function replanSession(
  sessionId: string,
  tabKey?: string,
  editedTabs?: Record<string, string>,
): Promise<{ success: boolean }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/plan-session/${sessionId}/replan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabKey, editedTabs }),
  });
  if (!res.ok) throw new Error(`Failed to replan: ${res.status}`);
  return res.json();
}

export async function fetchPlanningSessions(
  companyId: string,
): Promise<PlanningSession[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/plan-sessions`);
  if (!res.ok) return [];
  return res.json();
}

// ── Ticket Dependencies ────────────────────────────────────────────────────

export interface DependencyEdge {
  id: string;
  blocker_ticket_id: string;
  blocked_ticket_id: string;
  dependency_type: string;
  status: string;
  created_at: string;
}

export async function fetchDependencyGraph(companyId: string): Promise<{
  edges: DependencyEdge[];
  tickets: { id: string; title: string; status: string; dependency_status: string; agent_role?: string }[];
}> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/dependency-graph`);
  if (!res.ok) return { edges: [], tickets: [] };
  return res.json();
}

export async function fetchTicketDependencies(ticketId: string): Promise<{
  blockers: DependencyEdge[];
  dependents: DependencyEdge[];
}> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/tickets/${ticketId}/dependencies`);
  if (!res.ok) return { blockers: [], dependents: [] };
  return res.json();
}

export async function addTicketDependency(
  ticketId: string,
  blockerId: string,
  type?: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/tickets/${ticketId}/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocker_id: blockerId, type }),
  });
  return res.json();
}

export async function removeTicketDependency(depId: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/dependencies/${depId}`, { method: 'DELETE' });
  return res.ok;
}

// ── Agent Messages ─────────────────────────────────────────────────────────

export interface AgentMessage {
  id: string;
  company_id: string;
  from_agent_id: string | null;
  to_agent_id: string | null;
  ticket_id: string | null;
  message_type: string;
  subject: string;
  content: string;
  metadata: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export async function fetchAgentMessages(agentId: string, limit = 50): Promise<AgentMessage[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/agents/${agentId}/messages?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchUnreadMessages(agentId: string): Promise<AgentMessage[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/agents/${agentId}/messages/unread`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendAgentMessage(
  fromAgentId: string,
  toAgentId: string,
  subject: string,
  content: string,
  messageType = 'context_share',
  ticketId?: string,
): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/agents/${fromAgentId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to_agent_id: toAgentId, ticket_id: ticketId, message_type: messageType, subject, content }),
  });
  return res.ok;
}

export async function markMessageRead(messageId: string): Promise<void> {
  await fetch(`${ORCHESTRATOR_URL}/api/messages/${messageId}/read`, { method: 'POST' });
}

// ── Dead Letter Queue ──────────────────────────────────────────────────────

export interface DeadLetterEntry {
  id: string;
  ticket_id: string;
  company_id: string;
  agent_id: string | null;
  failure_count: number;
  last_error: string;
  errors: { attempt: number; error: string; timestamp: string }[];
  escalated_at: string;
  resolved_at: string | null;
  resolution: string | null;
  tickets?: { title: string; agent_id: string | null };
}

export async function fetchDeadLetterQueue(companyId: string): Promise<DeadLetterEntry[]> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/companies/${companyId}/dead-letter-queue`);
  if (!res.ok) return [];
  return res.json();
}

export async function retryDeadLetterEntry(dlqId: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/dead-letter/${dlqId}/retry`, { method: 'POST' });
  return res.ok;
}

export async function resolveDeadLetterEntry(dlqId: string, resolution: string): Promise<boolean> {
  const res = await fetch(`${ORCHESTRATOR_URL}/api/dead-letter/${dlqId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution }),
  });
  return res.ok;
}
