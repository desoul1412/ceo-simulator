import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '../supabaseAdmin';
import type { AgentContext, AgentRunResult } from './agentRunner';
import { buildRelevantMemoryContext, ROLE_PROMPTS, ROLE_TOOLS } from './worker';
import { selectModel, selectEffort, allocateBudget } from './taskClassifier';
import { buildSkillContext } from '../skillLoader';

/**
 * Execute a task using Claude Agent SDK.
 * Supports session resume for persistent agent state across heartbeats.
 */
export async function executeClaudeAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const basePrompt = ctx.systemPrompt || (ROLE_PROMPTS[ctx.role] ?? `You are a ${ctx.role}.`);
  const tools = ROLE_TOOLS[ctx.role] ?? ROLE_TOOLS.Frontend;

  const memoryContext = buildRelevantMemoryContext(ctx.memory, ctx.task);
  const model = ctx.runtimeConfig?.model ?? selectModel(ctx.role, ctx.storyPoints, ctx.task);
  const effort = selectEffort(ctx.role, ctx.storyPoints, ctx.task);
  const maxTurns = ctx.runtimeConfig?.maxTurns ?? (model === 'haiku' ? 15 : 40);
  const maxBudget = allocateBudget(ctx.role, ctx.storyPoints, ctx.budgetRemaining);

  // Build query options — support session resume
  // System prompt is static (enables API-level prompt caching); memory injected in user prompt
  const options: any = {
    cwd: ctx.cwd,
    systemPrompt: basePrompt,
    maxTurns,
    maxBudgetUsd: maxBudget,
    tools,
    allowedTools: tools,
    model,
    effort,
    permissionMode: 'acceptEdits' as const,
  };

  // Resume session if agent has an active session and it's not too large.
  // This saves ~2K tokens of re-establishing codebase context for sequential tickets.
  // Session is reused for: explicit continuations, or same-agent sequential work (session < 150K tokens).
  if (ctx.activeSessionId) {
    if (ctx.isContinuation) {
      options.resume = ctx.activeSessionId;
    } else {
      // Check session size — only resume if under 150K input tokens
      const { data: prevSession } = await supabase.from('agent_sessions')
        .select('total_input_tokens')
        .eq('agent_id', ctx.agentId)
        .order('last_invoked_at', { ascending: false })
        .limit(1)
        .single();
      const prevTokens = (prevSession as any)?.total_input_tokens ?? 0;
      if (prevTokens < 200_000) {
        options.resume = ctx.activeSessionId;
      }
    }
  }

  await ctx.onActivity(`Started working (${ctx.runtimeType}, model: ${model})`);

  let result = '';
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sessionId = '';

  const q = query({
    prompt: `${memoryContext ? memoryContext + '\n\n' : ''}${buildSkillContext(ctx.role, ctx.cwd)}Your task:\n\n${ctx.task}\n\nWork in the project directory. Read relevant files first, then make changes. Be thorough but focused.`,
    options,
  });

  for await (const message of q) {
    if (message.type === 'assistant') {
      const msg = message as any;
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text') result += block.text;
        }
      }
      // Heartbeat on each message
      await supabase.from('agents').update({
        last_heartbeat: new Date().toISOString(),
        heartbeat_status: 'alive',
      }).eq('id', ctx.agentId);
    } else if (message.type === 'result') {
      const res = message as any;
      costUsd = res.total_cost_usd ?? 0;
      inputTokens = res.usage?.input_tokens ?? 0;
      outputTokens = res.usage?.output_tokens ?? 0;
      sessionId = res.session_id ?? '';
      if (res.result) result = res.result;

      // Check for permission denials — escalate to human via notification
      const denials = res.permission_denials ?? [];
      if (denials.length > 0) {
        const denialMsg = denials.map((d: any) => `${d.tool_name}: ${JSON.stringify(d.tool_input).slice(0, 100)}`).join('; ');
        await supabase.from('notifications').insert({
          company_id: ctx.companyId,
          type: 'agent_blocked',
          title: `Agent ${ctx.role} needs permission`,
          message: `Blocked on: ${denialMsg}. Review agent config or approve manually.`,
          link: `/company/${ctx.companyId}/agents`,
        });
        await ctx.onActivity(`Permission denied: ${denialMsg}`);
      }

      // Check if agent stopped due to error or budget — escalate
      if (res.is_error || res.stop_reason === 'error_max_budget_usd') {
        const reason = res.stop_reason === 'error_max_budget_usd'
          ? `Budget exhausted ($${costUsd.toFixed(2)})`
          : `Agent error: ${(res.result ?? '').slice(0, 200)}`;
        await supabase.from('notifications').insert({
          company_id: ctx.companyId,
          type: 'agent_blocked',
          title: `Agent ${ctx.role} stopped`,
          message: reason,
          link: `/company/${ctx.companyId}/agents`,
        });
        await ctx.onActivity(`Agent stopped: ${reason}`);
      }
    }
  }

  return { output: result, costUsd, inputTokens, outputTokens, sessionId };
}
