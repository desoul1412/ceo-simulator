import { supabase } from './supabaseAdmin';

/**
 * Agent Messenger: inter-agent communication layer.
 * Handles artifact sharing, completion signals, context injection, and blocker reports.
 */

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

/**
 * Send a message from one agent to another.
 */
export async function sendMessage(
  companyId: string,
  fromAgentId: string | null,
  toAgentId: string | null,
  ticketId: string | null,
  messageType: string,
  subject: string,
  content: string,
  metadata: Record<string, any> = {},
): Promise<string | null> {
  const { data, error } = await supabase.from('agent_messages').insert({
    company_id: companyId,
    from_agent_id: fromAgentId,
    to_agent_id: toAgentId,
    ticket_id: ticketId,
    message_type: messageType,
    subject,
    content,
    metadata,
  }).select('id').single();

  if (error) {
    console.warn('[messenger] Failed to send message:', error.message);
    return null;
  }

  return (data as any)?.id ?? null;
}

/**
 * Broadcast completion signal to all agents with dependent tickets.
 * Called when a ticket completes — notifies downstream agents with context.
 */
export async function broadcastCompletion(ticketId: string): Promise<void> {
  // Get the completed ticket details
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, title, company_id, agent_id, result')
    .eq('id', ticketId)
    .single();

  if (!ticket) return;
  const t = ticket as any;

  // Find dependent tickets (that this ticket blocks)
  const { data: deps } = await supabase
    .from('ticket_dependencies')
    .select('blocked_ticket_id')
    .eq('blocker_ticket_id', ticketId);

  if (!deps?.length) return;

  // Get agent info for the completer
  let fromAgentName = 'Unknown';
  let fromAgentRole = 'Unknown';
  if (t.agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('name, role')
      .eq('id', t.agent_id)
      .single();
    if (agent) {
      fromAgentName = (agent as any).name;
      fromAgentRole = (agent as any).role;
    }
  }

  // Get MR details if available
  let branchName = '';
  let commitInfo = '';
  if (t.result?.sessionId) {
    const { data: mr } = await supabase
      .from('merge_requests')
      .select('branch_name, diff_summary')
      .eq('ticket_id', ticketId)
      .limit(1)
      .single();
    if (mr) {
      branchName = (mr as any).branch_name ?? '';
      commitInfo = (mr as any).diff_summary ?? '';
    }
  }

  // Build artifact summary — PM specs get more space for downstream agents
  const summaryLimit = fromAgentRole === 'PM' ? 3000 : 1000;
  const outputSummary = t.result?.output
    ? t.result.output.slice(0, summaryLimit)
    : 'No output available';

  // Send to each downstream agent
  for (const dep of deps as any[]) {
    const { data: blockedTicket } = await supabase
      .from('tickets')
      .select('agent_id, title')
      .eq('id', dep.blocked_ticket_id)
      .single();

    if (!blockedTicket || !(blockedTicket as any).agent_id) continue;

    const content = [
      `## Upstream Task Completed`,
      `**Agent**: ${fromAgentName} (${fromAgentRole})`,
      `**Task**: ${t.title}`,
      branchName ? `**Branch**: ${branchName}` : '',
      commitInfo ? `**Changes**: ${commitInfo}` : '',
      ``,
      `### Output Summary`,
      outputSummary,
    ].filter(Boolean).join('\n');

    await sendMessage(
      t.company_id,
      t.agent_id,
      (blockedTicket as any).agent_id,
      dep.blocked_ticket_id,
      'completion_signal',
      `${fromAgentRole} completed: ${t.title}`,
      content,
      {
        completed_ticket_id: ticketId,
        branch: branchName,
        output_length: t.result?.output?.length ?? 0,
      },
    );
  }

  console.log(`[messenger] Broadcast completion of ticket ${ticketId} to ${deps.length} downstream agents`);
}

/**
 * Share an artifact between agents (files, branches, schemas, etc.)
 */
export async function shareArtifact(
  companyId: string,
  fromAgentId: string,
  toAgentId: string,
  ticketId: string | null,
  filePaths: string[],
  branch: string,
  commitSha: string,
): Promise<string | null> {
  const content = [
    `## Shared Artifact`,
    `**Branch**: ${branch}`,
    `**Commit**: ${commitSha}`,
    `**Files**:`,
    ...filePaths.map(f => `- \`${f}\``),
  ].join('\n');

  return sendMessage(
    companyId,
    fromAgentId,
    toAgentId,
    ticketId,
    'artifact',
    `Artifact: ${filePaths.length} file(s) on ${branch}`,
    content,
    { file_paths: filePaths, branch, commit_sha: commitSha },
  );
}

/**
 * Get unread messages for an agent.
 */
export async function getUnreadMessages(agentId: string): Promise<AgentMessage[]> {
  const { data } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('to_agent_id', agentId)
    .is('read_at', null)
    .order('created_at', { ascending: true });

  return (data ?? []) as AgentMessage[];
}

/**
 * Get all messages for an agent (inbox).
 */
export async function getAgentMessages(agentId: string, limit = 50): Promise<AgentMessage[]> {
  const { data } = await supabase
    .from('agent_messages')
    .select('*')
    .or(`to_agent_id.eq.${agentId},from_agent_id.eq.${agentId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as AgentMessage[];
}

/**
 * Mark a message as read.
 */
export async function markRead(messageId: string): Promise<void> {
  await supabase.from('agent_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
}

/**
 * Inject unread messages into an agent's task prompt as context.
 * Each message is summarized to: subject + key lines + 200-char excerpt.
 * Total injected block is capped at ~6000 chars (~1500 tokens) to avoid prompt bloat.
 */
export async function injectMessagesIntoContext(
  agentId: string,
  taskPrompt: string,
): Promise<string> {
  const messages = await getUnreadMessages(agentId);
  if (messages.length === 0) return taskPrompt;

  // Summarize each message to key info only
  const summarizeMessage = (m: AgentMessage): string => {
    const lines: string[] = [`[${m.message_type.toUpperCase()}] ${m.subject}`];

    // Extract branch/files from metadata
    if (m.metadata?.branch) lines.push(`Branch: ${m.metadata.branch}`);
    if (Array.isArray(m.metadata?.file_paths) && m.metadata.file_paths.length > 0) {
      lines.push(`Files: ${m.metadata.file_paths.slice(0, 5).join(', ')}`);
    }

    // Excerpt: first 200 chars of content (skip headers)
    const contentLines = m.content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const excerpt = contentLines.join(' ').slice(0, 200);
    if (excerpt) lines.push(excerpt);

    return lines.join('\n');
  };

  // Cap total injected context at ~6000 chars
  const MAX_CONTEXT_CHARS = 6000;
  let totalChars = 0;
  const summaries: string[] = [];

  for (const m of messages) {
    const summary = summarizeMessage(m);
    if (totalChars + summary.length > MAX_CONTEXT_CHARS) break;
    summaries.push(summary);
    totalChars += summary.length;
  }

  const skipped = messages.length - summaries.length;

  // Mark all as read in a single batch query
  const messageIds = messages.map(m => m.id);
  if (messageIds.length > 0) {
    await supabase.from('agent_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', messageIds);
  }

  const contextBlock = summaries.join('\n\n---\n\n');
  const suffix = skipped > 0 ? `\n*(${skipped} older message(s) omitted)*` : '';

  return [
    `## Upstream Context (${summaries.length}/${messages.length} message(s))`,
    '',
    contextBlock + suffix,
    '',
    '---',
    '',
    `## Your Task`,
    '',
    taskPrompt,
  ].join('\n');
}
