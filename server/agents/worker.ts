import { query } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '../supabaseAdmin';
import { usdToUnits } from '../budgetUtils';
import { recordTaskCompletion, extractSkills, syncMemoryToObsidian } from '../memoryManager';
import { selectModel, selectEffort, allocateBudget, MODEL_IDS } from './taskClassifier';
import { presetRegistry } from '../presets';
import { buildBudgetedContext, estimateTokens } from '../contextBudget';
import { getUnreadMessages, injectMessagesIntoContext } from '../agentMessenger';
import { canExecute } from '../dependencyManager';

// ── Selective Memory Injection ───────────────────────────────────────────────

/**
 * Score memory items by relevance to the current task.
 * Returns a memory context string with only the top-N relevant items.
 * Avoids injecting ~150-500 tokens of irrelevant memory on every execution.
 */
export function buildRelevantMemoryContext(memory: any, task: string, topN = 5): string {
  if (!memory || (!memory.shortTerm?.length && !memory.skills?.length && !memory.rules?.length)) {
    return '';
  }

  // Extract keywords from task (lowercase words, 4+ chars, skip common words)
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'will', 'your', 'task', 'make', 'file', 'code', 'work', 'read', 'write', 'then', 'into', 'each', 'also', 'when', 'what']);
  const taskKeywords = task.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  const score = (item: string): number =>
    taskKeywords.filter(kw => item.toLowerCase().includes(kw)).length;

  // Score and filter skills
  const skills: string[] = memory.skills ?? [];
  const relevantSkills = skills
    .map(s => ({ s, sc: score(s) }))
    .filter(x => x.sc > 0 || skills.length <= topN)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, topN)
    .map(x => x.s);

  // Score and filter short-term memory
  const shortTerm: string[] = memory.shortTerm ?? [];
  const relevantShortTerm = shortTerm
    .slice(-10)
    .map(s => ({ s, sc: score(s) }))
    .filter(x => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3)
    .map(x => x.s);

  // Rules are always injected (they're constraints, not knowledge)
  const rules: string[] = (memory.rules ?? []).slice(0, 5);

  if (!relevantSkills.length && !relevantShortTerm.length && !rules.length) return '';

  let ctx = '\n\n## Your Memory\n';
  if (relevantSkills.length) ctx += `Skills: ${relevantSkills.join(', ')}\n`;
  if (relevantShortTerm.length) ctx += `Recent context: ${relevantShortTerm.join('; ')}\n`;
  if (rules.length) ctx += `Rules: ${rules.join('; ')}\n`;
  return ctx;
}

// ── Role-specific system prompts ─────────────────────────────────────────────

export const ROLE_PROMPTS: Record<string, string> = {
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

export const ROLE_TOOLS: Record<string, string[]> = {
  CEO:      ['Read', 'Glob', 'Grep'],
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
  // Check if this agent has a ticket with unsatisfied dependencies
  const { data: agentTicket } = await supabase.from('tickets')
    .select('id, dependency_status')
    .eq('agent_id', agentId)
    .eq('status', 'in_progress')
    .limit(1).single();

  if (agentTicket && (agentTicket as any).dependency_status === 'blocked') {
    const blockers = await import('../dependencyManager').then(m => m.getBlockers((agentTicket as any).id));
    const pendingBlockers = blockers.filter(b => b.status === 'pending');
    if (pendingBlockers.length > 0) {
      console.log(`[worker] Agent ${agentId.slice(0,8)} blocked by ${pendingBlockers.length} dependencies — skipping`);
      return {
        output: `Blocked: waiting for ${pendingBlockers.length} upstream task(s) to complete`,
        costUsd: 0, inputTokens: 0, outputTokens: 0, sessionId: '',
      };
    }
  }

  // Fetch agent info for context
  const { data: agentRow } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  const agent = agentRow as {
    name: string; role: string; memory: Record<string, any>;
    dept_role_id: string | null; system_prompt: string | null;
  } | null;
  const agentName = agent?.name ?? role;
  const memory = agent?.memory ?? {};
  const deptRoleId = agent?.dept_role_id ?? null;

  // Resolve system prompt + tools: preset-aware with legacy fallback
  let systemPrompt: string;
  let tools: string[];
  let skillContext = '';

  if (deptRoleId) {
    // Layer 1: Use department role config
    const deptRole = await presetRegistry.getDeptRole(deptRoleId);
    if (deptRole) {
      systemPrompt = agent?.system_prompt || deptRole.system_prompt;
      // Map tool_access tier to tool lists
      const TOOL_TIERS: Record<string, string[]> = {
        core: ['Read', 'Write', 'Glob', 'Grep'],
        standard: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
        full: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'NotebookEdit'],
      };
      tools = TOOL_TIERS[deptRole.tool_access] ?? TOOL_TIERS.core;
      // Layer 2: Inject matched skills as context
      skillContext = await presetRegistry.buildSkillContext(deptRoleId, task);
    } else {
      systemPrompt = ROLE_PROMPTS[role] ?? ROLE_PROMPTS.Frontend;
      tools = ROLE_TOOLS[role] ?? ROLE_TOOLS.Frontend;
    }
  } else {
    // Legacy fallback: hardcoded role prompts
    systemPrompt = ROLE_PROMPTS[role] ?? ROLE_PROMPTS.Frontend;
    tools = ROLE_TOOLS[role] ?? ROLE_TOOLS.Frontend;
  }

  const memoryContext = buildRelevantMemoryContext(memory, task);

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
  const storyPoints = 3; // default for worker tasks (no SP context here)

  // Resolve department model tier if agent has a preset role
  let deptModelTier: 'haiku' | 'sonnet' | 'opus' | undefined;
  if (deptRoleId) {
    const { data: deptRole } = await supabase
      .from('department_roles').select('model_tier').eq('id', deptRoleId).single();
    if (deptRole) deptModelTier = (deptRole as any).model_tier;
  }

  const model = selectModel(role, storyPoints, task, deptModelTier);
  const effort = selectEffort(role, storyPoints, task);
  const maxBudget = allocateBudget(role, storyPoints, remainingBudget);

  // Semantic memory: search brain for relevant past work
  let brainMemory = '';
  try {
    const { buildMemoryContext } = await import('../brainSearch');
    brainMemory = await buildMemoryContext(task, companyId, agentId);
  } catch { /* brain search not available */ }

  // Upstream agent messages (from dependency chain)
  let agentMessages = '';
  try {
    const unread = await getUnreadMessages(agentId);
    if (unread.length > 0) {
      agentMessages = await injectMessagesIntoContext(agentId, '');
    }
  } catch { /* messenger not available */ }

  // Build budget-controlled context (deduped, capped at ~4000 tokens)
  const budgetedPrompt = buildBudgetedContext({
    agentMessages,
    brainMemory,
    episodicMemory: memoryContext,
    skillContext,
    task,
  });

  console.log(`[worker] Context budget: ~${estimateTokens(budgetedPrompt)} tokens for ${agentName}`);

  let result = '';
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sessionId = '';

  const q = query({
    prompt: budgetedPrompt,
    options: {
      cwd,
      systemPrompt: systemPrompt,
      maxTurns: 10,
      maxBudgetUsd: maxBudget,
      tools,
      allowedTools: tools,
      model,
      effort,
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
    system_prompt: systemPrompt,
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
    model: MODEL_IDS[model],
  });

  // Update company budget (stored as micro-dollars: USD * 100_000)
  const costInUnits = usdToUnits(costUsd);
  const { data: freshCo } = await supabase
    .from('companies')
    .select('budget_spent')
    .eq('id', companyId)
    .single();
  if (freshCo) {
    await supabase.from('companies').update({
      budget_spent: ((freshCo as any)?.budget_spent ?? 0) + costInUnits,
    }).eq('id', companyId);
  }

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
