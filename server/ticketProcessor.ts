import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseAdmin';
import { executeAgent, type AgentContext } from './agents/agentRunner';
import { createWorktree, removeWorktree, taskBranchName } from './worktreeManager';
import { recordFailure } from './circuitBreaker';
import { onTicketCompleted, onTicketFailed } from './dependencyManager';
import { injectMessagesIntoContext } from './agentMessenger';

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
  // v2 respects dependency_status — only claims tickets with all deps satisfied
  const { data: ticketId, error: claimError } = await supabase
    .rpc('claim_next_ticket_v2', { p_company_id: companyId });

  if (claimError || !ticketId) {
    if (claimError) console.warn(`[ticketProcessor] Claim RPC error:`, claimError.message);
    return { processed: false };
  }
  console.log(`[ticketProcessor] Claimed ticket ${ticketId}`);

  // Fetch the full ticket
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (!ticket) return { processed: false, error: 'Ticket not found after claim' };
  const t = ticket as any;

  // Sequential: only process one ticket per agent at a time
  if (t.agent_id) {
    const { data: inProgress } = await supabase.from('tickets')
      .select('id').eq('agent_id', t.agent_id).eq('status', 'in_progress').neq('id', ticketId).limit(1);
    if (inProgress?.length) {
      console.log(`[ticketProcessor] Agent ${t.agent_id?.slice(0,8)} busy — releasing ${ticketId} (other: ${inProgress[0].id?.slice(0,8)})`);
      await supabase.from('tickets').update({ status: 'approved' }).eq('id', ticketId);
      return { processed: false };
    }
  }

  // Check agent budget before execution
  if (t.agent_id) {
    const { data: agent } = await supabase
      .from('agents')
      .select('budget_limit, budget_spent, lifecycle_status, name, role')
      .eq('id', t.agent_id)
      .single();
    const a = agent as any;

    if (!a) { console.warn(`[ticketProcessor] Agent ${t.agent_id} not found`); return { processed: false, error: 'Agent not found' }; }

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
    await supabase.from('activity_log').insert({
      company_id: t.company_id,
      agent_id: t.agent_id,
      type: 'task-started',
      message: `Started: "${(t.title ?? '').slice(0, 100)}"`,
    });

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
      const { data: agent, error: agentErr } = await supabase.from('agents').select('*').eq('id', t.agent_id).single();
      if (agent) {
        agentData = agent;
      } else {
        console.warn(`[ticketProcessor] Agent ${t.agent_id} not found (${agentErr?.message}), using defaults`);
      }
    }

    // Build task description with goal ancestry
    const ancestry = (t.goal_ancestry as string[] ?? []);
    const ancestryContext = ancestry.length > 0
      ? `\n\nGoal Chain:\n${ancestry.map((g: string, i: number) => `${'  '.repeat(i)}→ ${g}`).join('\n')}\n`
      : '';
    const fullTask = `${t.title}${t.description ? '\n\n' + t.description : ''}${ancestryContext}`;

    // ── Persistent agent branch strategy ─────────────────────────────────
    // Each agent has ONE branch: agent/{name-slug}
    // Flow: checkout branch → pull main → work → commit → push → create MR
    const agentSlug = (agentData.name ?? agentData.role ?? 'agent')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const branchName = `agent/${agentSlug}`;

    // Branch protection: never work on main/master
    if (['main', 'master'].includes(branchName)) {
      throw new Error(`Branch protection: refusing to work on '${branchName}'`);
    }

    // Create worktree for this agent's persistent branch
    const worktreePath = createWorktree(cwd, branchName);

    // Pull latest from main into agent branch (rebase to stay clean)
    try {
      execSync('git fetch origin main', { cwd: worktreePath, stdio: 'pipe' });
      try {
        execSync('git rebase origin/main', { cwd: worktreePath, stdio: 'pipe' });
      } catch {
        // Rebase failed — abort and try merge
        try { execSync('git rebase --abort', { cwd: worktreePath, stdio: 'pipe' }); } catch {}
        try {
          execSync('git merge origin/main --no-edit', { cwd: worktreePath, stdio: 'pipe' });
        } catch (mergeErr: any) {
          // Both failed: reset to origin/main so agent starts from a clean state
          console.warn(`[git] Sync conflict on ${branchName} — resetting to origin/main: ${mergeErr.message}`);
          try { execSync('git merge --abort', { cwd: worktreePath, stdio: 'pipe' }); } catch {}
          execSync('git reset --hard origin/main', { cwd: worktreePath, stdio: 'pipe' });
        }
      }
    } catch { /* first time — no origin/main yet */ }

    // Conflict avoidance: check if other agents have open MRs touching same files
    // If so, add a warning to the task context
    let conflictWarning = '';
    try {
      const { data: openMRs } = await supabase.from('merge_requests')
        .select('branch_name, agent_id, diff_summary')
        .eq('company_id', t.company_id)
        .eq('status', 'open');
      if (openMRs?.length) {
        const otherBranches = (openMRs as any[])
          .filter(m => m.branch_name !== branchName)
          .map(m => m.branch_name);
        if (otherBranches.length > 0) {
          conflictWarning = `\n\n⚠ CONFLICT AVOIDANCE: Other agents have open MRs on branches: ${otherBranches.join(', ')}. Avoid editing files they may be working on. If you must edit shared files, coordinate via comments.`;
        }
      }
    } catch (conflictErr: any) {
      console.warn('[ticketProcessor] Conflict check failed:', conflictErr.message);
    }

    // Inject upstream messages into task context (inter-agent communication)
    let enrichedTask = fullTask + conflictWarning;
    if (t.agent_id) {
      try {
        enrichedTask = await injectMessagesIntoContext(t.agent_id, enrichedTask);
      } catch (msgErr: any) {
        console.warn('[ticketProcessor] Message injection failed:', msgErr.message);
      }
    }

    // Execute via universal agent runner
    const ctx: AgentContext = {
      agentId: t.agent_id,
      companyId: t.company_id,
      role: agentData.role,
      task: enrichedTask,
      cwd: worktreePath,
      systemPrompt: agentData.system_prompt ?? '',
      memory: agentData.memory ?? {},
      skills: agentData.skills ?? [],
      runtimeType: agentData.runtime_type ?? 'claude_sdk',
      runtimeConfig: agentData.runtime_config ?? {},
      activeSessionId: agentData.active_session_id,
      isContinuation: !!(t as any).continuation_of,
      budgetRemaining: (agentData.budget_limit ?? 10) - (agentData.budget_spent ?? 0),
      storyPoints: (t as any).story_points ?? 3,
      onActivity: logActivity,
    };

    const result = await executeAgent(ctx);

    // ── Post-execution: verify code compiles ──────────────────────────────
    try {
      // Quick compile check if package.json exists
      const hasPkg = fs.existsSync(path.join(worktreePath, 'package.json'));
      if (hasPkg) {
        try {
          execSync('npx tsc --noEmit 2>&1 || true', { cwd: worktreePath, timeout: 30_000, encoding: 'utf8' });
        } catch {
          // Non-fatal — log but don't block
          console.warn(`[ticketProcessor] Compile check failed for ${t.title?.slice(0, 40)}`);
        }
      }
    } catch { /* compile check is best-effort */ }

    // ── Post-execution: commit → push → create MR ────────────────────────
    let mrId: string | null = null;
    const role = agentData.role ?? 'agent';
    const title = t.title ?? 'task';

    try {
      // Check if there are actual changes
      const statusOut = execSync('git status --porcelain', { cwd: worktreePath, encoding: 'utf8' }).trim();
      if (!statusOut) {
        console.log(`[git] No changes from ${role} on "${title}"`);
      } else {
        // Stage all changes
        execSync('git add -A', { cwd: worktreePath, stdio: 'pipe' });

        // Commit with descriptive message
        const commitMsg = `${role}: ${title}`.replace(/"/g, '\\"');
        execSync(`git commit -m "${commitMsg}"`, { cwd: worktreePath, stdio: 'pipe' });

        // Push to agent's persistent branch
        try {
          execSync(`git push origin ${branchName}`, { cwd: worktreePath, stdio: 'pipe' });
        } catch {
          // First push — set upstream
          try {
            execSync(`git push -u origin ${branchName}`, { cwd: worktreePath, stdio: 'pipe' });
          } catch (pushErr: any) {
            console.warn(`[git] Push failed for ${branchName}: ${pushErr.message}`);
          }
        }

        // Get diff stats
        let filesChanged = 0, insertions = 0, deletions = 0;
        try {
          const diffOut = execSync(`git diff --stat origin/main...${branchName}`, { cwd: worktreePath, encoding: 'utf8' });
          const statLine = diffOut.trim().split('\n').pop() ?? '';
          const fcMatch = statLine.match(/(\d+)\s+file/);
          const insMatch = statLine.match(/(\d+)\s+insertion/);
          const delMatch = statLine.match(/(\d+)\s+deletion/);
          if (fcMatch) filesChanged = parseInt(fcMatch[1], 10);
          if (insMatch) insertions = parseInt(insMatch[1], 10);
          if (delMatch) deletions = parseInt(delMatch[1], 10);
        } catch (diffErr: any) {
          console.warn('[ticketProcessor] Diff stats failed:', diffErr.message);
        }

        // Get changed file list for conflict tracking
        let changedFiles = '';
        try {
          changedFiles = execSync(`git diff --name-only origin/main...${branchName}`, { cwd: worktreePath, encoding: 'utf8' }).trim();
        } catch (filesErr: any) {
          console.warn('[ticketProcessor] Changed files list failed:', filesErr.message);
        }

        // Create merge request
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
          diff_summary: changedFiles,
          title: `${role}: ${title}`,
        }).select().single();

        if (mr) {
          mrId = (mr as any).id;
          await supabase.from('notifications').insert({
            company_id: t.company_id,
            type: 'merge_request',
            title: `MR from ${agentSlug}: ${title}`,
            message: `${role} completed "${title}" — ${filesChanged} files, +${insertions}/-${deletions}`,
            link: `/company/${t.company_id}/merge-requests`,
          });
        }
      }
    } catch (gitErr: any) {
      console.warn(`[git] Post-processing failed: ${gitErr.message}`);
    }

    // Keep worktree alive (persistent branch) — only remove if no more tasks pending
    // Also check in_progress to avoid removing a worktree a concurrent agent is using
    try {
      const { data: moreTasks } = await supabase.from('tickets')
        .select('id').eq('company_id', t.company_id).eq('agent_id', t.agent_id)
        .in('status', ['approved', 'open', 'in_progress']).limit(1);
      if (!(moreTasks?.length)) {
        removeWorktree(cwd, branchName);
      }
    } catch (err: any) {
      console.warn(`[ticketProcessor] Worktree cleanup failed for ${branchName}:`, err.message);
    }

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

    // Update agent budget_spent and clear session ID (don't carry stale context to next ticket)
    if (t.agent_id) {
      const { data: agent } = await supabase.from('agents').select('budget_spent').eq('id', t.agent_id).single();
      await supabase.from('agents').update({
        budget_spent: ((agent as any)?.budget_spent ?? 0) + result.costUsd,
        active_session_id: null,
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

    // Propagate dependency satisfaction to downstream tickets
    try {
      await onTicketCompleted(ticketId);
    } catch (depErr: any) {
      console.warn('[ticketProcessor] Dependency propagation failed:', depErr.message);
    }

    return { processed: true, ticketId };
  } catch (err: any) {
    // Route through circuit breaker instead of immediately marking as failed
    try {
      const { retried, escalated } = await recordFailure(ticketId, t.company_id, t.agent_id, err.message);
      if (escalated) {
        // Propagate failure to downstream dependencies
        await onTicketFailed(ticketId).catch((depErr: any) =>
          console.warn('[ticketProcessor] Failure propagation failed:', depErr.message)
        );
      }
      return { processed: false, ticketId, error: retried ? `Retrying: ${err.message}` : err.message };
    } catch (cbErr: any) {
      // Circuit breaker itself failed — fall back to direct failure marking
      console.error('[ticketProcessor] Circuit breaker failed:', cbErr.message);
      await supabase.from('tickets').update({
        status: 'failed',
        last_error: err.message,
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
 * Process up to N tickets. Claims and processes sequentially per agent
 * to avoid duplicate-agent race conditions, but different agents run in parallel.
 */
export async function processMultipleTickets(
  companyId: string,
  cwd: string,
  maxConcurrent = 3,
): Promise<{ processed: number; errors: string[] }> {
  // Just call processNextTicket once — it handles claim + execute atomically.
  // The heartbeat calls this every 30s, so agents naturally pipeline.
  // True parallelism only helps when multiple DIFFERENT agents have ready tickets.
  const result = await processNextTicket(companyId, cwd).catch(err => ({
    processed: false as const,
    error: String(err),
  }));

  return {
    processed: result.processed ? 1 : 0,
    errors: result.error ? [result.error] : [],
  };
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
