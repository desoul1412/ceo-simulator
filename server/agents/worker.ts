import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '../supabaseAdmin';
import { recordTaskCompletion, extractSkills, syncMemoryToObsidian } from '../memoryManager';

// ── Role-specific system prompts ─────────────────────────────────────────────

const ROLE_PROMPTS: Record<string, string> = {
  PM: `You are a Project Manager. Your job is to:
- Break down requirements into clear, actionable user stories
- Write specification documents in markdown
- Define acceptance criteria for each task
- Identify risks and dependencies

Write your specs to the brain/wiki/ directory using Obsidian markdown with YAML frontmatter.
Output format: create or update files, then report what you did.`,

  DevOps: `You are a DevOps Engineer. Your job is to:
- Set up infrastructure and deployment pipelines
- Write CI/CD configuration files
- Configure environment variables and secrets
- Create Dockerfiles, deployment scripts, and monitoring

Write infrastructure code and configs. Test with dry-runs where possible.
Output format: create/edit files, then report what you did.`,

  Frontend: `You are a Frontend Developer. Your job is to:
- Build React components with TypeScript
- Implement UI designs using Tailwind CSS v4
- Write unit tests with vitest
- Follow the project's design system (pixel art / HUD / sci-fi)

The project uses React 19 + Vite + Tailwind v4 + Zustand.
Read existing components in src/components/ for style reference.
Output format: create/edit files, run tests, then report what you did.`,

  Backend: `You are a Backend Developer. Your job is to:
- Build API endpoints and server-side logic
- Design database schemas and write migrations
- Implement business logic and data processing
- Write integration tests

The project uses Supabase (PostgreSQL) and Express.
Output format: create/edit files, run tests, then report what you did.`,

  QA: `You are a QA Engineer. Your job is to:
- Write and run test suites (vitest for unit, playwright for e2e)
- Identify bugs and edge cases
- Verify acceptance criteria from specs
- Report test results and coverage

Run existing tests first, then add new ones for the feature under test.
Output format: run tests, write new test files, report results.`,

  Designer: `You are a UI/UX Designer. Your job is to:
- Create design specifications and component mockups
- Define color schemes, typography, and spacing
- Write CSS/Tailwind classes for new components
- Ensure consistency with the design system

The design system is pixel art / HUD / sci-fi. See brain/wiki/UI-Design-System.md.
Output format: create design spec files in brain/wiki/, create CSS examples.`,
};

// ── Tools per role ───────────────────────────────────────────────────────────

const ROLE_TOOLS: Record<string, string[]> = {
  PM:       ['Read', 'Glob', 'Grep', 'Write'],
  DevOps:   ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  Frontend: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  Backend:  ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  QA:       ['Read', 'Glob', 'Grep', 'Bash'],
  Designer: ['Read', 'Write', 'Glob', 'Grep'],
};

// ── Execute Worker Task ──────────────────────────────────────────────────────

export interface WorkerResult {
  output: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  sessionId: string;
}

export async function executeWorkerTask(
  agentId: string,
  companyId: string,
  role: string,
  task: string,
  cwd: string,
  onActivity: (message: string) => Promise<void>,
): Promise<WorkerResult> {
  const systemPrompt = ROLE_PROMPTS[role] ?? ROLE_PROMPTS.Frontend;
  const tools = ROLE_TOOLS[role] ?? ROLE_TOOLS.Frontend;

  // Fetch agent info for context
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  const agentName = (agent as any)?.name ?? role;
  const memory = (agent as any)?.memory ?? {};

  // Inject memory context if available
  let memoryContext = '';
  if (memory.shortTerm?.length || memory.skills?.length) {
    memoryContext = '\n\n## Your Memory\n';
    if (memory.skills?.length) memoryContext += `Skills: ${memory.skills.join(', ')}\n`;
    if (memory.shortTerm?.length) memoryContext += `Recent context: ${memory.shortTerm.slice(-5).join('; ')}\n`;
    if (memory.rules?.length) memoryContext += `Rules: ${memory.rules.join('; ')}\n`;
  }

  const fullPrompt = systemPrompt + memoryContext;

  // Update agent status
  await supabase.from('agents').update({
    status: 'working',
    assigned_task: task,
    last_heartbeat: new Date().toISOString(),
    heartbeat_status: 'alive',
  }).eq('id', agentId);

  await onActivity(`${agentName} (${role}) started working: "${task.slice(0, 80)}"`);

  // Fetch company budget for cap
  const { data: company } = await supabase
    .from('companies')
    .select('budget, budget_spent')
    .eq('id', companyId)
    .single();

  const remainingBudget = ((company as any)?.budget ?? 100000) - ((company as any)?.budget_spent ?? 0);
  const maxBudget = Math.min(2.0, remainingBudget / 50000); // cap at $2 or proportional

  let result = '';
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sessionId = '';

  const q = query({
    prompt: `Your task:\n\n${task}\n\nWork in the project directory. Read relevant files first to understand the codebase, then make your changes. Be thorough but focused.`,
    options: {
      cwd,
      systemPrompt: fullPrompt,
      maxTurns: 10,
      maxBudgetUsd: maxBudget,
      tools,
      allowedTools: tools,
      model: 'sonnet',
      persistSession: true,
      effort: 'medium',
      permissionMode: 'acceptEdits' as const,
    },
  });

  for await (const message of q) {
    if (message.type === 'assistant') {
      const msg = message as any;
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text') {
            result += block.text;
          }
        }
      }
      // Heartbeat on each assistant message
      await supabase.from('agents').update({
        last_heartbeat: new Date().toISOString(),
        heartbeat_status: 'alive',
      }).eq('id', agentId);
    } else if (message.type === 'result') {
      const res = message as any;
      costUsd = res.total_cost_usd ?? 0;
      inputTokens = res.usage?.input_tokens ?? 0;
      outputTokens = res.usage?.output_tokens ?? 0;
      sessionId = res.session_id ?? '';
      if (res.result) result = res.result;
    }
  }

  // Record session
  await supabase.from('agent_sessions').insert({
    agent_id: agentId,
    company_id: companyId,
    system_prompt: fullPrompt,
    status: 'completed',
    last_invoked_at: new Date().toISOString(),
    total_input_tokens: inputTokens,
    total_output_tokens: outputTokens,
    total_cost_usd: costUsd,
  });

  // Record token usage
  await supabase.from('token_usage').insert({
    agent_id: agentId,
    company_id: companyId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    model: 'claude-sonnet-4-6',
  });

  // Update company budget
  const costInUnits = Math.round(costUsd * 100000);
  await supabase.rpc('', {}).catch(() => {});  // no-op placeholder
  const { data: freshCo } = await supabase
    .from('companies')
    .select('budget_spent')
    .eq('id', companyId)
    .single();
  await supabase.from('companies').update({
    budget_spent: ((freshCo as any)?.budget_spent ?? 0) + costInUnits,
  }).eq('id', companyId);

  // Update agent — mark task complete
  await supabase.from('agents').update({
    status: 'break',
    assigned_task: null,
    progress: 100,
    total_cost_usd: ((agent as any)?.total_cost_usd ?? 0) + costUsd,
    last_heartbeat: new Date().toISOString(),
  }).eq('id', agentId);

  // Extract short memory from result
  const shortMemory = result.slice(0, 200);
  const existingMemory = memory ?? {};
  const shortTerm = [...(existingMemory.shortTerm ?? []), shortMemory].slice(-10);
  await supabase.from('agents').update({
    memory: { ...existingMemory, shortTerm },
  }).eq('id', agentId);

  // Memory: record task completion + extract skills + sync to Obsidian
  await recordTaskCompletion(agentId, task, result.slice(0, 300));
  const newSkills = await extractSkills(agentId, result);
  await syncMemoryToObsidian(agentId, cwd);

  const skillMsg = newSkills.length > 0 ? ` Learned: ${newSkills.join(', ')}.` : '';
  await onActivity(`${agentName} (${role}) completed task. Cost: $${costUsd.toFixed(4)}.${skillMsg}`);

  return { output: result, costUsd, inputTokens, outputTokens, sessionId };
}
