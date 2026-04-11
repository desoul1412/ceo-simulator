import { supabase } from '../supabaseAdmin';
import { usdToUnits } from '../budgetUtils';
import { selectModel, MODEL_IDS } from './taskClassifier';
import { executeClaudeAgent } from './claudeRunner';
import { executeHttpAgent } from './httpRunner';
import { executeBashAgent } from './bashRunner';
import { recordTaskCompletion, extractSkills, syncMemoryToObsidian } from '../memoryManager';

// ── Agent Runner Interface ───────────────────────────────────────────────────

export interface AgentRunResult {
  output: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  sessionId: string;
}

export interface AgentContext {
  agentId: string;
  companyId: string;
  role: string;
  task: string;
  cwd: string;
  systemPrompt: string;
  memory: any;
  skills: string[];
  runtimeType: string;
  runtimeConfig: any;
  activeSessionId: string | null;
  isContinuation: boolean;
  budgetRemaining: number;
  storyPoints: number;
  onActivity: (message: string) => Promise<void>;
}

/**
 * Universal agent executor — dispatches to the correct runtime based on agent type.
 * "If it can receive a heartbeat, it can be hired into your company."
 */
export async function executeAgent(ctx: AgentContext): Promise<AgentRunResult> {
  // Update agent status
  await supabase.from('agents').update({
    status: 'working',
    assigned_task: ctx.task,
    last_heartbeat: new Date().toISOString(),
    heartbeat_status: 'alive',
  }).eq('id', ctx.agentId);

  let result: AgentRunResult;

  switch (ctx.runtimeType) {
    case 'claude_sdk':
      result = await executeClaudeAgent(ctx);
      break;
    case 'http_endpoint':
      result = await executeHttpAgent(ctx);
      break;
    case 'bash_script':
      result = await executeBashAgent(ctx);
      break;
    case 'custom':
      // Custom handler — for now treat as HTTP
      result = await executeHttpAgent(ctx);
      break;
    default:
      result = await executeClaudeAgent(ctx);
  }

  // Post-execution: record session, update budget, save memory
  await supabase.from('agent_sessions').insert({
    agent_id: ctx.agentId,
    company_id: ctx.companyId,
    system_prompt: ctx.systemPrompt,
    status: 'completed',
    last_invoked_at: new Date().toISOString(),
    total_input_tokens: result.inputTokens,
    total_output_tokens: result.outputTokens,
    total_cost_usd: result.costUsd,
  });

  await supabase.from('token_usage').insert({
    agent_id: ctx.agentId,
    company_id: ctx.companyId,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_usd: result.costUsd,
    model: MODEL_IDS[selectModel(ctx.role, ctx.storyPoints, ctx.task)] ?? ctx.runtimeConfig?.model ?? ctx.runtimeType,
  });

  // Update company budget
  const { data: co } = await supabase
    .from('companies').select('budget_spent').eq('id', ctx.companyId).single();
  await supabase.from('companies').update({
    budget_spent: ((co as any)?.budget_spent ?? 0) + usdToUnits(result.costUsd),
  }).eq('id', ctx.companyId);

  // Update agent
  await supabase.from('agents').update({
    status: 'break',
    assigned_task: null,
    progress: 100,
    active_session_id: result.sessionId || null,
    last_heartbeat: new Date().toISOString(),
  }).eq('id', ctx.agentId);

  // Update agent budget_spent
  const { data: agent } = await supabase
    .from('agents').select('budget_spent, total_cost_usd').eq('id', ctx.agentId).single();
  await supabase.from('agents').update({
    budget_spent: ((agent as any)?.budget_spent ?? 0) + result.costUsd,
    total_cost_usd: ((agent as any)?.total_cost_usd ?? 0) + result.costUsd,
  }).eq('id', ctx.agentId);

  // Memory: record task + extract skills + sync to Obsidian
  await recordTaskCompletion(ctx.agentId, ctx.task, result.output.slice(0, 300));
  const newSkills = await extractSkills(ctx.agentId, result.output);
  await syncMemoryToObsidian(ctx.agentId, ctx.cwd);

  const skillMsg = newSkills.length > 0 ? ` Learned: ${newSkills.join(', ')}.` : '';
  await ctx.onActivity(`Completed. Cost: $${result.costUsd.toFixed(4)}.${skillMsg}`);

  return result;
}
