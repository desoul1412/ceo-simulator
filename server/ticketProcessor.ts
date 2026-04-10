import { execSync } from 'child_process';
import { supabase } from './supabaseAdmin';
import { executeAgent, type AgentContext } from './agents/agentRunner';
import { createWorktree, removeWorktree, taskBranchName } from './worktreeManager';

/**
 * Ticket-based processor: claims a ticket atomically and executes it.
 * Uses Postgres FOR UPDATE SKIP LOCKED to prevent race conditions.
 */
export async function processNextTicket(companyId: string, cwd: string): Promise<{
  processed: boolean;
  ticketId?: string;
  error?: string;
}> {
  // Atomic claim: uses the DB function to lock + claim the next approved ticket
  const { data: ticketId, error: claimError } = await supabase
    .rpc('claim_next_ticket', { p_company_id: companyId });

  if (claimError || !ticketId) {
    return { processed: false };
  }

  // Fetch the full ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (!ticket) return { processed: false, error: 'Ticket not found after claim' };
  const t = ticket as any;

  // Check agent budget before execution
  if (t.agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('budget_limit, budget_spent, lifecycle_status, name, role')
      .eq('id', t.agent_id)
      .single();
    const a = agent as any;

    if (!a) return { processed: false, error: 'Agent not found' };

    // Skip paused/throttled/terminated agents
    if (a.lifecycle_status !== 'active') {
      await supabase.from('tickets').update({ status: 'open' }).eq('id', ticketId);
      await addComment(ticketId, null, 'system', `Skipped: agent ${a.name} is ${a.lifecycle_status}`);
      return { processed: false, error: `Agent is ${a.lifecycle_status}` };
    }

    // Budget check
    const remaining = (a.budget_limit ?? 10) - (a.budget_spent ?? 0);
    if (remaining <= 0) {
      await supabase.from('tickets').update({ status: 'open' }).eq('id', ticketId);
      await supabase.from('agents').update({ lifecycle_status: 'throttled' }).eq('id', t.agent_id);
      await addComment(ticketId, t.agent_id, 'system', `Agent ${a.name} budget exhausted ($${a.budget_spent?.toFixed(2)}/$${a.budget_limit}). Auto-throttled.`);
      await supabase.from('audit_log').insert({
        company_id: t.company_id,
        agent_id: t.agent_id,
        ticket_id: ticketId,
        event_type: 'budget_check',
        message: `Budget exhausted for ${a.name}. Throttled.`,
        cost_usd: a.budget_spent,
      });
      return { processed: false, error: 'Agent budget exhausted' };
    }
  }

  try {
    // Add processing comment
    await addComment(ticketId, t.agent_id, 'system', 'Execution started');

    const logActivity = async (message: string) => {
      await addComment(ticketId, t.agent_id, 'agent', message);
      await supabase.from('activity_log').insert({
        company_id: t.company_id,
        agent_id: t.agent_id,
        type: 'task-started',
        message,
      });
    };

    // Fetch full agent info for the runner
    let agentData: any = { role: 'Frontend', runtime_type: 'claude_sdk', runtime_config: {}, memory: {}, skills: [], system_prompt: '', active_session_id: null, budget_limit: 10, budget_spent: 0 };
    if (t.agent_id) {
      const { data: agent } = await supabase.from('agents').select('*').eq('id', t.agent_id).single();
      if (agent) agentData = agent;
    }

    // Build task description with goal ancestry
    const ancestry = (t.goal_ancestry as string[] ?? []);
    const ancestryContext = ancestry.length > 0
      ? `\n\nGoal Chain:\n${ancestry.map((g: string, i: number) => `${'  '.repeat(i)}→ ${g}`).join('\n')}\n`
      : '';
    const fullTask = `${t.title}${t.description ? '\n\n' + t.description : ''}${ancestryContext}`;

    // Create worktree branch for isolated execution
    const branchName = taskBranchName(agentData.role, t.title);
    const worktreePath = createWorktree(cwd, branchName);

    // Execute via universal agent runner (dispatches to correct runtime)
    const ctx: AgentContext = {
      agentId: t.agent_id,
      companyId: t.company_id,
      role: agentData.role,
      task: fullTask,
      cwd: worktreePath,
      systemPrompt: agentData.system_prompt ?? '',
      memory: agentData.memory ?? {},
      skills: agentData.skills ?? [],
      runtimeType: agentData.runtime_type ?? 'claude_sdk',
      runtimeConfig: agentData.runtime_config ?? {},
      activeSessionId: agentData.active_session_id,
      budgetRemaining: (agentData.budget_limit ?? 10) - (agentData.budget_spent ?? 0),
      onActivity: logActivity,
    };

    const result = await executeAgent(ctx);

    // Post-execution: commit, push, create merge request
    let mrId: string | null = null;
    try {
      // Stage and get diff stats
      execSync('git add -A && git diff --cached --stat', { cwd: worktreePath, stdio: 'pipe' });

      // Commit
      const role = agentData.role ?? 'agent';
      const title = t.title ?? 'task';
      execSync(`git commit -m "agent/${role}: ${title}" --allow-empty`, { cwd: worktreePath, stdio: 'pipe' });

      // Push (catch errors — remote may not be configured)
      try {
        execSync(`git push origin ${branchName}`, { cwd: worktreePath, stdio: 'pipe' });
      } catch (pushErr: any) {
        console.warn(`[worktree] Push failed for ${branchName}: ${pushErr.message}`);
      }

      // Get diff stats from last commit
      let filesChanged = 0, insertions = 0, deletions = 0;
      try {
        const diffOut = execSync('git diff --stat HEAD~1', { cwd: worktreePath, encoding: 'utf8' });
        const statLine = diffOut.trim().split('\n').pop() ?? '';
        const fcMatch = statLine.match(/(\d+)\s+file/);
        const insMatch = statLine.match(/(\d+)\s+insertion/);
        const delMatch = statLine.match(/(\d+)\s+deletion/);
        if (fcMatch) filesChanged = parseInt(fcMatch[1], 10);
        if (insMatch) insertions = parseInt(insMatch[1], 10);
        if (delMatch) deletions = parseInt(delMatch[1], 10);
      } catch { /* no diff stats available */ }

      // Create merge_request in supabase
      const { data: mr } = await supabase.from('merge_requests').insert({
        company_id: t.company_id,
        ticket_id: ticketId,
        agent_id: t.agent_id,
        branch_name: branchName,
        target_branch: 'main',
        status: 'open',
        files_changed: filesChanged,
        insertions,
        deletions,
        title: `agent/${role}: ${title}`,
      }).select().single();

      if (mr) {
        mrId = (mr as any).id;

        // Create notification
        await supabase.from('notifications').insert({
          company_id: t.company_id,
          type: 'merge_request',
          title: `New MR: ${branchName}`,
          message: `${role} completed "${title}" — ${filesChanged} files, +${insertions}/-${deletions}`,
          link: `/company/${t.company_id}/board`,
        });
      }
    } catch (gitErr: any) {
      console.warn(`[worktree] Git post-processing failed: ${gitErr.message}`);
    }

    // Remove worktree (keep remote branch)
    removeWorktree(cwd, branchName);

    // Mark ticket completed
    const ticketUpdate: any = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      board_column: 'review',
      result: {
        output: result.output.slice(0, 2000),
        costUsd: result.costUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        sessionId: result.sessionId,
      },
    };
    if (mrId) ticketUpdate.merge_request_id = mrId;
    await supabase.from('tickets').update(ticketUpdate).eq('id', ticketId);

    // Update agent budget_spent
    if (t.agent_id) {
      const { data: agent } = await supabase.from('agents').select('budget_spent').eq('id', t.agent_id).single();
      await supabase.from('agents').update({
        budget_spent: ((agent as any)?.budget_spent ?? 0) + result.costUsd,
      }).eq('id', t.agent_id);
    }

    // Update delegation progress if linked
    await supabase.from('delegations')
      .update({ progress: 100 })
      .eq('company_id', t.company_id)
      .eq('to_agent_id', t.agent_id);

    // Check if all tickets for this company are done
    const { data: openTickets } = await supabase
      .from('tickets')
      .select('id')
      .eq('company_id', t.company_id)
      .in('status', ['open', 'awaiting_approval', 'approved', 'in_progress']);

    if (!openTickets?.length) {
      await supabase.from('companies').update({
        status: 'scaling',
        ceo_goal: null,
      }).eq('id', t.company_id);
      await supabase.from('delegations').delete().eq('company_id', t.company_id);

      // CEO idle
      const { data: ceoAgents } = await supabase
        .from('agents').select('id').eq('company_id', t.company_id).eq('role', 'CEO');
      if (ceoAgents?.length) {
        await supabase.from('agents').update({
          status: 'idle', assigned_task: null, progress: 100,
        }).eq('id', (ceoAgents[0] as any).id);
      }

      await addComment(ticketId, null, 'system', 'All tickets completed. Company status: scaling.');
    }

    await addComment(ticketId, t.agent_id, 'agent', `Completed. Cost: $${result.costUsd.toFixed(4)}`);

    return { processed: true, ticketId };
  } catch (err: any) {
    await supabase.from('tickets').update({
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).eq('id', ticketId);

    await addComment(ticketId, t.agent_id, 'system', `Failed: ${err.message}`);

    if (t.agent_id) {
      await supabase.from('agents').update({
        status: 'idle', assigned_task: null, heartbeat_status: 'stale',
      }).eq('id', t.agent_id);
    }

    return { processed: false, ticketId, error: err.message };
  }
}

async function addComment(ticketId: string, agentId: string | null, authorType: string, content: string) {
  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    agent_id: agentId,
    author_type: authorType,
    content,
  });
}

/**
 * Get ticket queue status for a company.
 */
export async function getTicketQueueStatus(companyId: string) {
  const statuses = ['open', 'awaiting_approval', 'approved', 'in_progress', 'completed', 'failed'];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const { data } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', status);
    counts[status] = (data as any)?.length ?? 0;
  }

  // Simpler count query
  const { data: all } = await supabase
    .from('tickets')
    .select('status')
    .eq('company_id', companyId);

  const result: Record<string, number> = {};
  for (const status of statuses) {
    result[status] = (all ?? []).filter((t: any) => t.status === status).length;
  }

  return result;
}
