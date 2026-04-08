import { supabase } from './supabaseAdmin';
import { executeWorkerTask } from './agents/worker';

let isProcessing = false;

/**
 * Process the next pending task from the queue.
 * Only one task at a time to avoid overwhelming the system.
 */
export async function processNextTask(cwd: string): Promise<{
  processed: boolean;
  taskId?: string;
  result?: any;
  error?: string;
}> {
  if (isProcessing) {
    return { processed: false, error: 'Already processing a task' };
  }

  // Fetch next pending task
  const { data: tasks, error } = await supabase
    .from('task_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) return { processed: false, error: error.message };
  if (!tasks?.length) return { processed: false };

  const task = tasks[0] as any;
  isProcessing = true;

  try {
    // Mark task as processing
    await supabase.from('task_queue').update({
      status: 'processing',
      started_at: new Date().toISOString(),
    }).eq('id', task.id);

    const logActivity = async (message: string) => {
      await supabase.from('activity_log').insert({
        company_id: task.company_id,
        agent_id: task.agent_id,
        type: 'task-started',
        message,
      });
    };

    // Execute the worker agent
    const workerResult = await executeWorkerTask(
      task.agent_id,
      task.company_id,
      task.payload.role,
      task.payload.task,
      cwd,
      logActivity,
    );

    // Mark task completed
    await supabase.from('task_queue').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: {
        output: workerResult.output.slice(0, 2000), // truncate for DB storage
        costUsd: workerResult.costUsd,
        inputTokens: workerResult.inputTokens,
        outputTokens: workerResult.outputTokens,
        sessionId: workerResult.sessionId,
      },
    }).eq('id', task.id);

    // Update delegation progress
    await supabase.from('delegations')
      .update({ progress: 100 })
      .eq('company_id', task.company_id)
      .eq('to_role', task.payload.role);

    // Check if all delegations for this company are done
    const { data: remainingDels } = await supabase
      .from('delegations')
      .select('id')
      .eq('company_id', task.company_id)
      .lt('progress', 100);

    if (!remainingDels?.length) {
      // All tasks done — update company status
      await supabase.from('companies').update({
        status: 'scaling',
        ceo_goal: null,
      }).eq('id', task.company_id);

      // Clean up delegations
      await supabase.from('delegations')
        .delete()
        .eq('company_id', task.company_id);

      // Set CEO to idle
      const { data: agents } = await supabase
        .from('agents')
        .select('id')
        .eq('company_id', task.company_id)
        .eq('role', 'CEO');

      if (agents?.length) {
        await supabase.from('agents').update({
          status: 'idle',
          assigned_task: null,
          progress: 100,
        }).eq('id', (agents[0] as any).id);
      }

      await supabase.from('activity_log').insert({
        company_id: task.company_id,
        type: 'task-completed',
        message: 'All delegated tasks completed. Company status: scaling.',
      });
    }

    isProcessing = false;
    return {
      processed: true,
      taskId: task.id,
      result: { costUsd: workerResult.costUsd, role: task.payload.role },
    };
  } catch (err: any) {
    isProcessing = false;

    // Mark task failed
    await supabase.from('task_queue').update({
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).eq('id', task.id);

    // Log failure
    await supabase.from('activity_log').insert({
      company_id: task.company_id,
      agent_id: task.agent_id,
      type: 'status-change',
      message: `Task failed: ${err.message}`,
    });

    // Set agent to blocked
    await supabase.from('agents').update({
      status: 'idle',
      assigned_task: null,
      heartbeat_status: 'stale',
    }).eq('id', task.agent_id);

    return { processed: false, taskId: task.id, error: err.message };
  }
}

/**
 * Get queue status for a company.
 */
export async function getQueueStatus(companyId: string) {
  const { data: pending } = await supabase
    .from('task_queue')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'pending');

  const { data: processing } = await supabase
    .from('task_queue')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'processing');

  const { data: completed } = await supabase
    .from('task_queue')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'completed');

  const { data: failed } = await supabase
    .from('task_queue')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'failed');

  return {
    pending: pending?.length ?? 0,
    processing: processing?.length ?? 0,
    completed: completed?.length ?? 0,
    failed: failed?.length ?? 0,
    isProcessing,
  };
}
