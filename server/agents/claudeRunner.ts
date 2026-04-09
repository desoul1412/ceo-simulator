import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '../supabaseAdmin';
import type { AgentContext, AgentRunResult } from './agentRunner';

// ── Role-specific system prompts ─────────────────────────────────────────────

const ROLE_PROMPTS: Record<string, string> = {
  PM: 'You are a Project Manager. Break down requirements into user stories, write specs to brain/wiki/, define acceptance criteria.',
  DevOps: 'You are a DevOps Engineer. Set up infrastructure, CI/CD, Docker, deployment scripts, monitoring.',
  Frontend: 'You are a Frontend Developer. Build React components with TypeScript, Tailwind CSS v4, vitest tests. Project uses React 19 + Vite.',
  Backend: 'You are a Backend Developer. Build API endpoints, database schemas, server-side logic. Project uses Supabase + Express.',
  QA: 'You are a QA Engineer. Write test suites with vitest, identify bugs, verify acceptance criteria, report coverage.',
  Designer: 'You are a UI/UX Designer. Create design specs, color schemes, mockups. Design system: pixel art / HUD / sci-fi.',
};

const ROLE_TOOLS: Record<string, string[]> = {
  PM:       ['Read', 'Glob', 'Grep', 'Write'],
  DevOps:   ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  Frontend: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  Backend:  ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  QA:       ['Read', 'Glob', 'Grep', 'Bash'],
  Designer: ['Read', 'Write', 'Glob', 'Grep'],
};

/**
 * Execute a task using Claude Agent SDK.
 * Supports session resume for persistent agent state across heartbeats.
 */
export async function executeClaudeAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const basePrompt = ctx.systemPrompt || (ROLE_PROMPTS[ctx.role] ?? `You are a ${ctx.role}.`);
  const tools = ROLE_TOOLS[ctx.role] ?? ROLE_TOOLS.Frontend;

  // Inject memory context
  let memoryContext = '';
  if (ctx.memory?.shortTerm?.length || ctx.memory?.skills?.length) {
    memoryContext = '\n\n## Your Memory\n';
    if (ctx.skills?.length) memoryContext += `Skills: ${ctx.skills.join(', ')}\n`;
    if (ctx.memory.shortTerm?.length) memoryContext += `Recent context: ${ctx.memory.shortTerm.slice(-5).join('; ')}\n`;
    if (ctx.memory.rules?.length) memoryContext += `Rules: ${ctx.memory.rules.join('; ')}\n`;
  }

  const fullPrompt = basePrompt + memoryContext;
  const model = ctx.runtimeConfig?.model ?? 'sonnet';
  const maxTurns = ctx.runtimeConfig?.maxTurns ?? 10;
  const maxBudget = Math.min(ctx.runtimeConfig?.maxBudgetUsd ?? 2.0, ctx.budgetRemaining);

  // Build query options — support session resume
  const options: any = {
    cwd: ctx.cwd,
    systemPrompt: fullPrompt,
    maxTurns,
    maxBudgetUsd: maxBudget,
    tools,
    allowedTools: tools,
    model,
    persistSession: true,
    effort: 'medium',
  };

  // Resume previous session if available (persistent agent state across heartbeats)
  if (ctx.activeSessionId) {
    options.resume = ctx.activeSessionId;
  }

  await ctx.onActivity(`Started working (${ctx.runtimeType}, model: ${model})`);

  let result = '';
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sessionId = '';

  const q = query({
    prompt: `Your task:\n\n${ctx.task}\n\nWork in the project directory. Read relevant files first, then make changes. Be thorough but focused.`,
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
    }
  }

  return { output: result, costUsd, inputTokens, outputTokens, sessionId };
}
