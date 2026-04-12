import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseAdmin';

/**
 * Circuit Breaker: retry logic, exponential backoff, dead letter queue, timeout detection.
 * Prevents infinite retry loops and surfaces permanently failed tickets.
 */

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
  reason: string;
}

/**
 * Decide whether a failed ticket should be retried.
 */
export async function shouldRetry(ticketId: string): Promise<RetryDecision> {
  const { data: ticket } = await supabase
    .from('tickets')
    .select('retry_count, max_retries')
    .eq('id', ticketId)
    .single();

  if (!ticket) return { retry: false, delayMs: 0, reason: 'Ticket not found' };
  const t = ticket as any;

  if (t.retry_count >= t.max_retries) {
    return { retry: false, delayMs: 0, reason: `Max retries reached (${t.max_retries})` };
  }

  const delayMs = calculateBackoff(t.retry_count);
  return { retry: true, delayMs, reason: `Retry ${t.retry_count + 1}/${t.max_retries}` };
}

/**
 * Record a ticket failure. Either requeues for retry or escalates to dead letter queue.
 */
export async function recordFailure(
  ticketId: string,
  companyId: string,
  agentId: string | null,
  error: string,
): Promise<{ retried: boolean; escalated: boolean }> {
  const decision = await shouldRetry(ticketId);

  if (decision.retry) {
    // Fetch current retry_count, then requeue with incremented value in one update
    const { data: ticket } = await supabase
      .from('tickets')
      .select('retry_count')
      .eq('id', ticketId)
      .single();
    const currentRetry = (ticket as any)?.retry_count ?? 0;

    await supabase.from('tickets').update({
      status: 'approved',
      retry_count: currentRetry + 1,
      last_error: error,
      started_at: null,
    }).eq('id', ticketId);

    // Reset agent to idle
    if (agentId) {
      await supabase.from('agents').update({
        status: 'idle',
        assigned_task: null,
      }).eq('id', agentId);
    }

    // Log the retry
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_type: 'system',
      content: `Retry scheduled (${decision.reason}). Error: ${error.slice(0, 500)}`,
    });

    console.log(`[circuit-breaker] Ticket ${ticketId} requeued — ${decision.reason}, backoff ${decision.delayMs}ms`);
    return { retried: true, escalated: false };
  }

  // Escalate to dead letter queue
  await escalate(ticketId, companyId, agentId, error);
  return { retried: false, escalated: true };
}

/**
 * Escalate a ticket to the dead letter queue.
 */
export async function escalate(
  ticketId: string,
  companyId: string,
  agentId: string | null,
  error: string,
): Promise<void> {
  // Mark ticket as permanently failed
  await supabase.from('tickets').update({
    status: 'failed',
    last_error: error,
    completed_at: new Date().toISOString(),
  }).eq('id', ticketId);

  // Reset agent
  if (agentId) {
    await supabase.from('agents').update({
      status: 'idle',
      assigned_task: null,
      heartbeat_status: 'stale',
    }).eq('id', agentId);
  }

  // Get full error history
  const { data: comments } = await supabase
    .from('ticket_comments')
    .select('content, created_at')
    .eq('ticket_id', ticketId)
    .ilike('content', '%Error:%')
    .order('created_at', { ascending: true });

  const errors = (comments ?? []).map((c: any, i: number) => ({
    attempt: i + 1,
    error: c.content,
    timestamp: c.created_at,
  }));

  // Insert into dead letter queue
  await supabase.from('dead_letter_queue').insert({
    ticket_id: ticketId,
    company_id: companyId,
    agent_id: agentId,
    failure_count: errors.length,
    last_error: error,
    errors,
  });

  // Create notification
  await supabase.from('notifications').insert({
    company_id: companyId,
    type: 'system',
    title: 'Ticket permanently failed',
    message: `Ticket ${ticketId} failed after max retries. Error: ${error.slice(0, 200)}`,
    link: `/company/${companyId}/board`,
  });

  // Add comment
  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_type: 'system',
    content: `ESCALATED to dead letter queue after ${errors.length} failures. Last error: ${error.slice(0, 500)}`,
  });

  // Append to brain/changelog.md
  try {
    const changelogPath = path.join(process.cwd(), 'brain', 'changelog.md');
    const timestamp = new Date().toISOString();
    const entry = `\n- [${timestamp}] DEAD LETTER: Ticket ${ticketId} failed permanently. Error: ${error.slice(0, 200)}`;
    if (fs.existsSync(changelogPath)) {
      fs.appendFileSync(changelogPath, entry, 'utf8');
    }
  } catch {
    // changelog write is non-critical
  }

  console.warn(`[circuit-breaker] Ticket ${ticketId} ESCALATED to dead letter queue — ${error.slice(0, 200)}`);
}

/**
 * Check if an in-progress ticket has exceeded its max execution time.
 * Returns true if the ticket was timed out.
 */
export async function checkExecutionTimeout(ticketId: string): Promise<boolean> {
  const { data: ticket } = await supabase
    .from('tickets')
    .select('started_at, max_execution_ms, company_id, agent_id')
    .eq('id', ticketId)
    .eq('status', 'in_progress')
    .single();

  if (!ticket) return false;
  const t = ticket as any;

  if (!t.started_at) return false;

  const elapsed = Date.now() - new Date(t.started_at).getTime();
  if (elapsed <= (t.max_execution_ms ?? 1800000)) return false; // 30 min default

  console.warn(`[circuit-breaker] Ticket ${ticketId} timed out after ${Math.round(elapsed / 1000)}s`);

  const { retried } = await recordFailure(
    ticketId,
    t.company_id,
    t.agent_id,
    `Execution timeout: exceeded ${t.max_execution_ms}ms`,
  );

  return !retried; // returns true only if escalated (fully timed out)
}

/**
 * Sweep all in-progress tickets for timeouts. Called from heartbeat daemon.
 */
export async function sweepTimeouts(): Promise<number> {
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id')
    .eq('status', 'in_progress')
    .not('started_at', 'is', null);

  let timedOut = 0;
  for (const t of (tickets ?? []) as any[]) {
    const wasTimedOut = await checkExecutionTimeout(t.id);
    if (wasTimedOut) timedOut++;
  }
  return timedOut;
}

/**
 * Retry a dead letter queue entry manually.
 */
export async function retryDeadLetter(dlqId: string): Promise<boolean> {
  const { data: entry } = await supabase
    .from('dead_letter_queue')
    .select('ticket_id')
    .eq('id', dlqId)
    .is('resolved_at', null)
    .single();

  if (!entry) return false;

  // Reset ticket for retry
  await supabase.from('tickets').update({
    status: 'approved',
    retry_count: 0,
    last_error: null,
    started_at: null,
    completed_at: null,
  }).eq('id', (entry as any).ticket_id);

  // Mark DLQ entry as resolved
  await supabase.from('dead_letter_queue').update({
    resolved_at: new Date().toISOString(),
    resolution: 'manual_retry',
  }).eq('id', dlqId);

  return true;
}

/**
 * Manually resolve a dead letter queue entry.
 */
export async function resolveDeadLetter(dlqId: string, resolution: string): Promise<boolean> {
  const { error } = await supabase.from('dead_letter_queue').update({
    resolved_at: new Date().toISOString(),
    resolution,
  }).eq('id', dlqId);

  return !error;
}

/**
 * Exponential backoff: min(30s, 1s * 2^retryCount)
 */
function calculateBackoff(retryCount: number): number {
  return Math.min(30_000, 1000 * Math.pow(2, retryCount));
}
