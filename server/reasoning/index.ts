/**
 * ReasoningBank — store/retrieve successful execution trajectories.
 *
 * Pattern: ruflo ReasoningBank + context autopilot.
 * On ticket completion with success, store the task→actions→outcome trajectory.
 * On new similar tasks, inject top-3 relevant trajectories into agent context.
 */

import { supabase } from '../supabaseAdmin';

export interface Trajectory {
  id: string;
  companyId: string;
  agentId: string;
  ticketId: string;
  taskDescription: string;
  actions: TrajectoryAction[];
  outcome: 'success' | 'failure' | 'partial';
  confidence: number;
  accessCount: number;
}

export interface TrajectoryAction {
  tool: string;
  input: string;
  outputSummary: string;
}

/**
 * Store a successful trajectory after ticket completion.
 */
export async function storeTrajectory(
  companyId: string,
  agentId: string,
  ticketId: string,
  taskDescription: string,
  actions: TrajectoryAction[],
  outcome: 'success' | 'failure' | 'partial',
): Promise<void> {
  try {
    await supabase.from('reasoning_trajectories').insert({
      company_id: companyId,
      agent_id: agentId,
      ticket_id: ticketId,
      task_description: taskDescription,
      actions: actions,
      outcome,
      confidence: outcome === 'success' ? 0.8 : outcome === 'partial' ? 0.5 : 0.2,
    });
  } catch (err: any) {
    console.error('[reasoning-bank] Failed to store trajectory:', err.message);
  }
}

/**
 * Retrieve relevant trajectories for a new task.
 * Uses keyword matching (v1). Will upgrade to vector search in v2.1.
 */
export async function getRelevantTrajectories(
  companyId: string,
  task: string,
  limit = 3,
): Promise<Trajectory[]> {
  try {
    // Extract keywords from task
    const keywords = extractKeywords(task);
    if (keywords.length === 0) return [];

    // Fetch successful trajectories for this company
    const { data } = await supabase.from('reasoning_trajectories')
      .select('*')
      .eq('company_id', companyId)
      .eq('outcome', 'success')
      .order('confidence', { ascending: false })
      .limit(50);

    if (!data || data.length === 0) return [];

    // Score by keyword overlap
    const scored = (data as any[]).map(t => {
      const desc = (t.task_description ?? '').toLowerCase();
      const score = keywords.reduce((sum, kw) => sum + (desc.includes(kw) ? 1 : 0), 0);
      return { ...t, score };
    });

    // Return top N with score > 0
    const relevant = scored
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, limit);

    // Increment access count for retrieved trajectories
    for (const t of relevant) {
      await supabase.from('reasoning_trajectories')
        .update({ access_count: (t.access_count ?? 0) + 1 })
        .eq('id', t.id);
    }

    return relevant as Trajectory[];
  } catch (err: any) {
    console.error('[reasoning-bank] Failed to retrieve trajectories:', err.message);
    return [];
  }
}

/**
 * Format trajectories for injection into agent context.
 */
export function formatTrajectoriesForContext(trajectories: Trajectory[]): string {
  if (trajectories.length === 0) return '';

  const sections = trajectories.map((t, i) => {
    const actionList = (t.actions ?? [])
      .slice(0, 5) // limit to 5 actions per trajectory
      .map(a => `  - ${a.tool}: ${a.outputSummary?.slice(0, 100) ?? ''}`)
      .join('\n');

    return `### Similar Task ${i + 1} (confidence: ${(t.confidence * 100).toFixed(0)}%)
Task: ${t.taskDescription?.slice(0, 150) ?? ''}
Actions:
${actionList}
Outcome: ${t.outcome}`;
  });

  return `## Relevant Past Trajectories
${sections.join('\n\n')}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'that', 'this', 'it', 'not', 'from', 'by', 'as', 'do', 'will',
    'should', 'can', 'would', 'could', 'has', 'have', 'had',
  ]);

  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 10); // limit to 10 keywords
}
