/**
 * PipelineOrchestrator — routes tickets through staged execution.
 *
 * Pattern: oh-my-claudecode staged pipeline with circuit breaker.
 * Tickets with SP ≤ 2 → direct exec. SP ≥ 5 → full pipeline.
 */

import { supabase } from '../supabaseAdmin';
import { STAGES, getPipelineStages, type PipelineStage } from './stages';

export { type PipelineStage } from './stages';

export interface PipelineContext {
  ticketId: string;
  companyId: string;
  agentId: string;
  task: string;
  storyPoints: number;
  cwd: string;
}

export interface PipelineResult {
  success: boolean;
  stage: PipelineStage;
  artifacts: Record<string, string>;
  error?: string;
}

/**
 * Check if a ticket should go through the pipeline.
 */
export function shouldUsePipeline(storyPoints: number): boolean {
  return storyPoints >= 3;
}

/**
 * Get the current pipeline stage for a ticket.
 * Returns null if the ticket is not in a pipeline.
 */
export async function getCurrentStage(ticketId: string): Promise<PipelineStage | null> {
  const { data } = await supabase.from('tickets')
    .select('pipeline_stage')
    .eq('id', ticketId)
    .single();
  return (data as any)?.pipeline_stage ?? null;
}

/**
 * Advance a ticket to the next pipeline stage.
 */
export async function advanceStage(
  ticketId: string,
  currentStage: PipelineStage,
  storyPoints: number,
  artifact?: string,
): Promise<PipelineStage> {
  const stages = getPipelineStages(storyPoints);
  const currentIdx = stages.indexOf(currentStage);
  const nextStage = stages[currentIdx + 1] ?? 'done';

  // Save artifact from current stage
  if (artifact) {
    const { data: ticket } = await supabase.from('tickets')
      .select('pipeline_artifacts')
      .eq('id', ticketId)
      .single();

    const artifacts = (ticket as any)?.pipeline_artifacts ?? {};
    artifacts[currentStage] = artifact;

    await supabase.from('tickets').update({
      pipeline_stage: nextStage,
      pipeline_artifacts: artifacts,
    }).eq('id', ticketId);
  } else {
    await supabase.from('tickets').update({
      pipeline_stage: nextStage,
    }).eq('id', ticketId);
  }

  // Log stage transition as comment
  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author: 'pipeline',
    author_type: 'pipeline',
    content: `Stage transition: ${currentStage} → ${nextStage}`,
  });

  return nextStage as PipelineStage;
}

/**
 * Handle verification failure — inject fix stage or send to DLQ.
 */
export async function handleVerifyFailure(
  ticketId: string,
  failureReason: string,
  fixAttempts: number,
): Promise<PipelineStage> {
  const maxFixRetries = STAGES.fix.maxRetries;

  if (fixAttempts < maxFixRetries) {
    // Inject fix stage
    await supabase.from('tickets').update({
      pipeline_stage: 'fix',
    }).eq('id', ticketId);

    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author: 'pipeline',
      author_type: 'pipeline',
      content: `Verify failed (attempt ${fixAttempts + 1}/${maxFixRetries}): ${failureReason.slice(0, 200)}`,
    });

    return 'fix';
  }

  // Max retries exceeded — mark as done with failure
  await supabase.from('tickets').update({
    pipeline_stage: 'done',
  }).eq('id', ticketId);

  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author: 'pipeline',
    author_type: 'pipeline',
    content: `Pipeline exhausted ${maxFixRetries} fix attempts. Escalating to DLQ.`,
  });

  return 'done';
}

/**
 * Get the prompt suffix for a pipeline stage.
 */
export function getStagePrompt(stage: PipelineStage): string {
  return STAGES[stage]?.promptSuffix ?? '';
}

/**
 * Get pipeline artifacts for a ticket.
 */
export async function getPipelineArtifacts(ticketId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('tickets')
    .select('pipeline_artifacts')
    .eq('id', ticketId)
    .single();
  return (data as any)?.pipeline_artifacts ?? {};
}
