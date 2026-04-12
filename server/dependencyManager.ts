import { supabase } from './supabaseAdmin';
import { broadcastCompletion } from './agentMessenger';

/**
 * Dependency Manager: manages ticket dependency DAG.
 * Supports adding/removing edges, cycle detection, and propagation.
 */

export interface DependencyEdge {
  id: string;
  blocker_ticket_id: string;
  blocked_ticket_id: string;
  dependency_type: 'finish_to_start' | 'finish_to_finish';
  status: 'pending' | 'satisfied' | 'broken';
  created_at: string;
}

/**
 * Add a dependency edge: blockerId must complete before blockedId can start.
 * Validates for circular dependencies before inserting.
 */
export async function addDependency(
  blockerId: string,
  blockedId: string,
  type: 'finish_to_start' | 'finish_to_finish' = 'finish_to_start',
  createdBy = 'system',
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (blockerId === blockedId) {
    return { success: false, error: 'A ticket cannot depend on itself' };
  }

  // Check for circular dependency
  const { data: wouldCycle, error: rpcError } = await supabase
    .rpc('check_circular_dependency', {
      p_blocker_id: blockerId,
      p_blocked_id: blockedId,
    });

  if (rpcError) {
    console.warn('[dependency] Cycle check failed:', rpcError.message);
    return { success: false, error: `Cycle check failed: ${rpcError.message}` };
  }

  if (wouldCycle) {
    return { success: false, error: 'Adding this dependency would create a circular reference' };
  }

  // Check if blocker ticket is already completed
  const { data: blocker } = await supabase
    .from('tickets')
    .select('status')
    .eq('id', blockerId)
    .single();

  const initialStatus = (blocker as any)?.status === 'completed' ? 'satisfied' : 'pending';

  // Insert edge
  const { data: dep, error: insertError } = await supabase
    .from('ticket_dependencies')
    .insert({
      blocker_ticket_id: blockerId,
      blocked_ticket_id: blockedId,
      dependency_type: type,
      status: initialStatus,
      created_by: createdBy,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: 'Dependency already exists' };
    }
    return { success: false, error: insertError.message };
  }

  // Recalculate blocked ticket's dependency_status
  await recalculateDependencyStatus(blockedId);

  return { success: true, id: (dep as any)?.id };
}

/**
 * Remove a dependency edge and recalculate downstream status.
 */
export async function removeDependency(depId: string): Promise<boolean> {
  // Get the blocked ticket before deleting
  const { data: dep } = await supabase
    .from('ticket_dependencies')
    .select('blocked_ticket_id')
    .eq('id', depId)
    .single();

  const { error } = await supabase
    .from('ticket_dependencies')
    .delete()
    .eq('id', depId);

  if (error) return false;

  // Recalculate if we know which ticket was affected
  if (dep) {
    await recalculateDependencyStatus((dep as any).blocked_ticket_id);
  }

  return true;
}

/**
 * Called when a ticket is completed. Propagates satisfaction through the DAG
 * and broadcasts completion signals to dependent agents.
 */
export async function onTicketCompleted(ticketId: string): Promise<void> {
  // Use the DB function for atomic propagation
  const { error } = await supabase.rpc('propagate_dependency_satisfaction', {
    p_completed_ticket_id: ticketId,
  });

  if (error) {
    console.warn('[dependency] Propagation failed:', error.message);
    return;
  }

  // Broadcast completion to dependent agents
  try {
    await broadcastCompletion(ticketId);
  } catch (err: any) {
    console.warn('[dependency] Broadcast failed:', err.message);
  }

  console.log(`[dependency] Propagated satisfaction from ticket ${ticketId}`);

  // Check if all non-Tech-Lead tickets in the sprint are done — auto-create review ticket
  try {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('sprint_id, company_id')
      .eq('id', ticketId)
      .single();

    if (ticket && (ticket as any).sprint_id) {
      const sprintId = (ticket as any).sprint_id;
      const companyId = (ticket as any).company_id;

      // Count remaining non-completed tickets (excluding Tech Lead review tickets)
      const { data: remaining } = await supabase
        .from('tickets')
        .select('id')
        .eq('sprint_id', sprintId)
        .not('title', 'ilike', '%Tech Lead%Review%merge%')
        .in('status', ['approved', 'in_progress', 'open', 'awaiting_approval']);

      if (remaining?.length === 0) {
        // All work tickets done — check if a Tech Lead review ticket already exists
        const { data: existing } = await supabase
          .from('tickets')
          .select('id')
          .eq('sprint_id', sprintId)
          .ilike('title', '%Review and merge%');

        if (!existing?.length) {
          // Find Tech Lead agent
          const { data: techLead } = await supabase
            .from('agents')
            .select('id')
            .eq('company_id', companyId)
            .eq('role', 'Tech Lead')
            .eq('lifecycle_status', 'active')
            .limit(1)
            .single();

          if (techLead) {
            await supabase.from('tickets').insert({
              company_id: companyId,
              sprint_id: sprintId,
              agent_id: (techLead as any).id,
              title: 'Review and merge all agent branches — resolve conflicts, run tests, verify against plan',
              description: 'Review all agent branches created during this sprint. For each branch:\n1. git diff main..agent/{name} to review changes\n2. Check for merge conflicts\n3. Resolve conflicts keeping the best code\n4. Run tests (npm test)\n5. Merge to main\n6. Report summary of all merges',
              status: 'approved',
              board_column: 'todo',
              dependency_status: 'ready',
              story_points: 3,
              priority: 1,
            });
            console.log(`[dependency] Auto-created Tech Lead review ticket for sprint ${sprintId.slice(0, 8)}`);
          }
        }
      }
    }
  } catch (err: any) {
    // Non-critical — don't block completion
    console.warn('[dependency] Tech Lead auto-ticket check failed:', err.message);
  }
}

/**
 * Called when a ticket permanently fails. Marks downstream deps as broken
 * and notifies affected agents.
 */
export async function onTicketFailed(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('propagate_dependency_failure', {
    p_failed_ticket_id: ticketId,
  });

  if (error) {
    console.warn('[dependency] Failure propagation failed:', error.message);
    return;
  }

  // Get downstream tickets that are now broken
  const { data: brokenDeps } = await supabase
    .from('ticket_dependencies')
    .select('blocked_ticket_id')
    .eq('blocker_ticket_id', ticketId)
    .eq('status', 'broken');

  // Notify affected agents
  const { data: ticket } = await supabase
    .from('tickets')
    .select('company_id, agent_id, title')
    .eq('id', ticketId)
    .single();

  if (ticket && brokenDeps?.length) {
    const t = ticket as any;
    for (const dep of brokenDeps as any[]) {
      const { data: blockedTicket } = await supabase
        .from('tickets')
        .select('agent_id')
        .eq('id', dep.blocked_ticket_id)
        .single();

      if (blockedTicket && (blockedTicket as any).agent_id) {
        await supabase.from('agent_messages').insert({
          company_id: t.company_id,
          from_agent_id: t.agent_id,
          to_agent_id: (blockedTicket as any).agent_id,
          ticket_id: dep.blocked_ticket_id,
          message_type: 'blocker_report',
          subject: `Blocker failed: ${t.title}`,
          content: `The ticket "${t.title}" that your task depends on has permanently failed. Your task is now blocked.`,
          metadata: { blocking_ticket_id: ticketId },
        });
      }
    }
  }

  console.warn(`[dependency] Propagated failure from ticket ${ticketId} — ${brokenDeps?.length ?? 0} downstream deps broken`);
}

/**
 * Get the full dependency graph for a company (for UI visualization).
 */
export async function getDependencyGraph(companyId: string): Promise<{
  edges: DependencyEdge[];
  tickets: { id: string; title: string; status: string; dependency_status: string; agent_role?: string }[];
}> {
  // Get all tickets for this company
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, title, status, dependency_status, agent_id')
    .eq('company_id', companyId);

  const ticketIds = (tickets ?? []).map((t: any) => t.id);

  if (ticketIds.length === 0) {
    return { edges: [], tickets: [] };
  }

  // Get all dependency edges between these tickets
  const { data: edges } = await supabase
    .from('ticket_dependencies')
    .select('*')
    .or(`blocker_ticket_id.in.(${ticketIds.join(',')}),blocked_ticket_id.in.(${ticketIds.join(',')})`);

  // Get agent roles for the ticket owners
  const agentIds = [...new Set((tickets ?? []).map((t: any) => t.agent_id).filter(Boolean))];
  let agentMap: Record<string, string> = {};
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from('agents')
      .select('id, role')
      .in('id', agentIds);
    agentMap = Object.fromEntries((agents ?? []).map((a: any) => [a.id, a.role]));
  }

  return {
    edges: (edges ?? []) as DependencyEdge[],
    tickets: (tickets ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dependency_status: t.dependency_status,
      agent_role: agentMap[t.agent_id],
    })),
  };
}

/**
 * Get blockers for a specific ticket.
 */
export async function getBlockers(ticketId: string): Promise<DependencyEdge[]> {
  const { data } = await supabase
    .from('ticket_dependencies')
    .select('*')
    .eq('blocked_ticket_id', ticketId);
  return (data ?? []) as DependencyEdge[];
}

/**
 * Get tickets that this ticket blocks (dependents).
 */
export async function getDependents(ticketId: string): Promise<DependencyEdge[]> {
  const { data } = await supabase
    .from('ticket_dependencies')
    .select('*')
    .eq('blocker_ticket_id', ticketId);
  return (data ?? []) as DependencyEdge[];
}

/**
 * Create auto-inferred dependencies based on role ordering.
 * Called during plan approval when creating tickets.
 *
 * Standard ordering: PM -> [Frontend, Backend] -> QA -> DevOps
 */
export async function createRoleDependencies(
  ticketsByRole: Record<string, string[]>,
): Promise<void> {
  const roleOrder: [string, string[]][] = [
    ['PM', ['Frontend', 'Backend', 'Full-Stack']],
    ['Frontend', ['QA']],
    ['Backend', ['QA']],
    ['Full-Stack', ['QA']],
    ['QA', ['DevOps']],
  ];

  for (const [blockerRole, blockedRoles] of roleOrder) {
    const blockerTickets = ticketsByRole[blockerRole] ?? [];
    for (const blockedRole of blockedRoles) {
      const blockedTickets = ticketsByRole[blockedRole] ?? [];
      for (const blockerId of blockerTickets) {
        for (const blockedId of blockedTickets) {
          await addDependency(blockerId, blockedId, 'finish_to_start', 'auto');
        }
      }
    }
  }
}

/**
 * Recalculate the dependency_status of a single ticket.
 */
async function recalculateDependencyStatus(ticketId: string): Promise<void> {
  const { data: deps } = await supabase
    .from('ticket_dependencies')
    .select('status')
    .eq('blocked_ticket_id', ticketId);

  if (!deps || deps.length === 0) {
    await supabase.from('tickets')
      .update({ dependency_status: 'ready' })
      .eq('id', ticketId);
    return;
  }

  const allSatisfied = (deps as any[]).every(d => d.status === 'satisfied');
  const someSatisfied = (deps as any[]).some(d => d.status === 'satisfied');

  const status = allSatisfied ? 'ready' : someSatisfied ? 'partial' : 'blocked';
  await supabase.from('tickets')
    .update({ dependency_status: status })
    .eq('id', ticketId);
}
