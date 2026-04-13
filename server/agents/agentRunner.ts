import { supabase } from '../supabaseAdmin';
import { usdToUnits } from '../budgetUtils';
import { selectModel, MODEL_IDS } from './taskClassifier';
import { executeClaudeAgent } from './claudeRunner';
import { executeHttpAgent } from './httpRunner';
import { executeBashAgent } from './bashRunner';
import { recordTaskCompletion, extractSkills, syncMemoryToObsidian } from '../memoryManager';
import { routeAndExecute, getRoutingChain } from '../llm/router';
import { buildBudgetedContext, estimateTokens } from '../contextBudget';
import { buildRelevantMemoryContext, ROLE_PROMPTS, ROLE_TOOLS } from './worker';
import { allocateBudget, selectEffort } from './taskClassifier';

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
 * Universal agent executor — dispatches to the correct runtime.
 *
 * Execution priority:
 * 1. LLM Router (if routing rules exist) — uses priority-based model fallback
 * 2. Legacy dispatch (claude_sdk/http/bash) — direct runtime type switching
 *
 * The router handles: model selection, provider fallback, role-based constraints.
 * Legacy path preserved for backward compat when no routing rules are configured.
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
  let modelUsed = 'unknown';
  let providerUsed = ctx.runtimeType;

  // Try LLM router first (if routing chain exists)
  const routingChain = await getRoutingChain(ctx.agentId, ctx.companyId);

  if (routingChain.length > 0 && ctx.runtimeType === 'claude_sdk') {
    // Use the LLM router — it handles model selection + fallback
    try {
      const systemPrompt = ctx.systemPrompt || (ROLE_PROMPTS[ctx.role] ?? `You are a ${ctx.role}.`);
      const memoryContext = buildRelevantMemoryContext(ctx.memory, ctx.task);
      const effort = selectEffort(ctx.role, ctx.storyPoints, ctx.task);
      const maxBudget = allocateBudget(ctx.role, ctx.storyPoints, ctx.budgetRemaining);
      const tools = ROLE_TOOLS[ctx.role] ?? ROLE_TOOLS.Frontend;

      // Build budgeted prompt
      const prompt = buildBudgetedContext({
        episodicMemory: memoryContext,
        task: ctx.task,
      });

      console.log(`[agentRunner] Using LLM router for ${ctx.role} — ${routingChain.length} model(s) in chain, ~${estimateTokens(prompt)} tokens`);

      await ctx.onActivity(`Started working (routed, ${routingChain.length} model(s) in chain)`);

      const routerResult = await routeAndExecute(ctx.agentId, ctx.companyId, {
        systemPrompt,
        userPrompt: prompt,
        tools: tools as any,
        allowedTools: tools as any,
        maxTurns: ctx.runtimeConfig?.maxTurns ?? 15,
        maxBudgetUsd: maxBudget,
        effort,
        cwd: ctx.cwd,
        permissionMode: 'acceptEdits',
        resume: ctx.activeSessionId && ctx.isContinuation ? ctx.activeSessionId : undefined,
      }, {
        role: ctx.role,
        task: ctx.task,
      }, routingChain);

      result = {
        output: routerResult.output,
        costUsd: routerResult.costUsd,
        inputTokens: routerResult.inputTokens,
        outputTokens: routerResult.outputTokens,
        sessionId: routerResult.sessionId,
      };
      modelUsed = routerResult.modelUsed;
      providerUsed = routerResult.providerUsed;

    } catch (err: any) {
      console.warn(`[agentRunner] Router failed, falling back to legacy: ${err.message}`);
      // Fall back to legacy execution
      result = await legacyExecute(ctx);
      modelUsed = MODEL_IDS[selectModel(ctx.role, ctx.storyPoints, ctx.task)] ?? 'unknown';
    }
  } else {
    // Legacy path — no routing rules or non-SDK runtime
    result = await legacyExecute(ctx);
    modelUsed = MODEL_IDS[selectModel(ctx.role, ctx.storyPoints, ctx.task)] ?? ctx.runtimeConfig?.model ?? ctx.runtimeType;
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
    model: modelUsed,
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
  await ctx.onActivity(`Completed (${providerUsed}/${modelUsed}). Cost: $${result.costUsd.toFixed(4)}.${skillMsg}`);

  return result;
}

/** Legacy execution — direct runtime dispatch without LLM router */
async function legacyExecute(ctx: AgentContext): Promise<AgentRunResult> {
  switch (ctx.runtimeType) {
    case 'claude_sdk':
      return executeClaudeAgent(ctx);
    case 'http_endpoint':
      return executeHttpAgent(ctx);
    case 'bash_script':
      return executeBashAgent(ctx);
    case 'custom':
      return executeHttpAgent(ctx);
    default:
      return executeClaudeAgent(ctx);
  }
}
