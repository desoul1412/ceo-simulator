import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { supabase } from '../supabaseAdmin';

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentRow {
  id: string;
  name: string;
  role: string;
  status: string;
  skills: string[];
}

interface DelegationPlan {
  reasoning: string;
  subtasks: { role: string; task: string; priority: number }[];
}

// ── CEO Agent Definition ─────────────────────────────────────────────────────

function buildCeoPrompt(companyName: string, budget: number, budgetSpent: number, agents: AgentRow[]): string {
  const roster = agents
    .filter(a => a.role !== 'CEO')
    .map(a => `- ${a.name} (${a.role}) — skills: ${a.skills?.length ? a.skills.join(', ') : 'general'}`)
    .join('\n');

  return `You are the CEO of "${companyName}".

## Company Context
- Budget: $${((budget - budgetSpent) / 1000).toFixed(1)}k remaining of $${(budget / 1000).toFixed(1)}k total
- Status: Active

## Your Team
${roster || '- No employees yet'}

## Your Job
When given a goal, analyze it and produce a delegation plan. Think about:
1. What needs to be done to achieve this goal
2. Which team member is best suited for each subtask
3. The priority order of subtasks

## Output Format
Respond with a JSON object (no markdown fences):
{
  "reasoning": "Your analysis of the goal and why you're delegating this way",
  "subtasks": [
    { "role": "PM", "task": "Detailed description of what this person should do", "priority": 1 },
    { "role": "Frontend", "task": "Detailed description", "priority": 2 }
  ]
}

Only delegate to roles that exist on your team. Be specific about what each person should do.`;
}

// ── Execute CEO Reasoning ────────────────────────────────────────────────────

export async function executeCeoGoal(
  companyId: string,
  goal: string,
  cwd: string,
  onActivity: (message: string) => Promise<void>,
): Promise<{
  plan: DelegationPlan;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  sessionId: string;
}> {
  // Fetch company + agents
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (!company) throw new Error(`Company ${companyId} not found`);

  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .eq('company_id', companyId);

  if (!agents?.length) throw new Error('No agents found');

  const ceoAgent = agents.find((a: any) => a.role === 'CEO');
  if (!ceoAgent) throw new Error('No CEO agent found');

  // Update CEO status
  await supabase.from('agents').update({
    status: 'working',
    assigned_task: `Analyzing goal: "${goal}"`,
  }).eq('id', ceoAgent.id);

  await onActivity(`CEO ${ceoAgent.name} is analyzing goal: "${goal}"`);

  // Build system prompt
  const systemPrompt = buildCeoPrompt(
    company.name,
    company.budget,
    company.budget_spent,
    agents as AgentRow[],
  );

  // Call Claude via Agent SDK
  let result = '';
  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sessionId = '';

  const q = query({
    prompt: `The board has assigned you this goal:\n\n"${goal}"\n\nAnalyze it and produce your delegation plan.`,
    options: {
      cwd,
      systemPrompt,
      maxTurns: 3,
      maxBudgetUsd: Math.min(1.0, (company.budget - company.budget_spent) / 100), // cap at $1 or 1% of remaining budget
      tools: ['Read', 'Glob', 'Grep'],      // CEO can read the codebase
      allowedTools: ['Read', 'Glob', 'Grep'], // auto-approve reads
      model: 'sonnet',
      persistSession: true,
    },
  });

  for await (const message of q) {
    if (message.type === 'assistant') {
      // Extract text content from assistant message
      const msg = message as any;
      if (msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text') {
            result += block.text;
          }
        }
      }
    } else if (message.type === 'result') {
      const res = message as any;
      costUsd = res.total_cost_usd ?? 0;
      inputTokens = res.usage?.input_tokens ?? 0;
      outputTokens = res.usage?.output_tokens ?? 0;
      sessionId = res.session_id ?? '';
      if (res.result) result = res.result;
    }
  }

  // Parse the delegation plan from CEO's response
  let plan: DelegationPlan;
  try {
    // Try to extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*"reasoning"[\s\S]*"subtasks"[\s\S]*\}/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback: create a generic plan
      const workerRoles = agents.filter((a: any) => a.role !== 'CEO').map((a: any) => a.role);
      plan = {
        reasoning: result.slice(0, 500),
        subtasks: workerRoles.map((role: string, i: number) => ({
          role,
          task: `Work on: ${goal} (${role} responsibilities)`,
          priority: i + 1,
        })),
      };
    }
  } catch {
    const workerRoles = agents.filter((a: any) => a.role !== 'CEO').map((a: any) => a.role);
    plan = {
      reasoning: 'CEO produced unstructured analysis. Delegating to all team members.',
      subtasks: workerRoles.map((role: string, i: number) => ({
        role,
        task: `Work on: ${goal} (${role} responsibilities)`,
        priority: i + 1,
      })),
    };
  }

  await onActivity(`CEO reasoning: ${plan.reasoning.slice(0, 200)}`);

  // Record session
  await supabase.from('agent_sessions').insert({
    agent_id: ceoAgent.id,
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
    agent_id: ceoAgent.id,
    company_id: companyId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    model: 'claude-sonnet-4-6',
  });

  // Update company budget with real cost
  await supabase.from('companies').update({
    ceo_goal: goal,
    status: 'growing',
    budget_spent: company.budget_spent + Math.round(costUsd * 100000), // store in cents for precision
  }).eq('id', companyId);

  // Create delegations from CEO's plan
  for (const subtask of plan.subtasks) {
    const worker = agents.find((a: any) => a.role === subtask.role);
    if (!worker) continue;

    // Create delegation
    await supabase.from('delegations').insert({
      company_id: companyId,
      to_agent_id: worker.id,
      to_role: subtask.role,
      task: subtask.task,
      progress: 0,
    });

    // Check if company requires approval gates
    const { data: coSettings } = await supabase
      .from('companies')
      .select('auto_approve')
      .eq('id', companyId)
      .single();
    const autoApprove = (coSettings as any)?.auto_approve ?? false;

    // Create ticket (replaces flat task_queue)
    const ticketStatus = autoApprove ? 'approved' : 'awaiting_approval';
    await supabase.from('tickets').insert({
      company_id: companyId,
      agent_id: worker.id,
      title: subtask.task,
      description: `Delegated by CEO for goal: "${goal}"`,
      status: ticketStatus,
      priority: subtask.priority,
      goal_ancestry: [goal, `${subtask.role}: ${subtask.task}`],
    });

    // Also create legacy task_queue entry for backwards compat
    await supabase.from('task_queue').insert({
      company_id: companyId,
      agent_id: worker.id,
      type: 'execute_subtask',
      payload: { task: subtask.task, role: subtask.role, goal, priority: subtask.priority },
      status: autoApprove ? 'pending' : 'pending',
    });

    // Update agent status
    await supabase.from('agents').update({
      status: autoApprove ? 'working' : 'idle',
      assigned_task: autoApprove ? subtask.task : `Awaiting approval: ${subtask.task}`,
      progress: 0,
      last_heartbeat: new Date().toISOString(),
      heartbeat_status: 'alive',
    }).eq('id', worker.id);

    await onActivity(`CEO delegated to ${worker.name} (${subtask.role}): "${subtask.task}" [${ticketStatus}]`);
  }

  // Update CEO status to meeting (overseeing)
  await supabase.from('agents').update({
    status: 'meeting',
    assigned_task: `Overseeing: ${goal}`,
    last_heartbeat: new Date().toISOString(),
    heartbeat_status: 'alive',
  }).eq('id', ceoAgent.id);

  return { plan, costUsd, inputTokens, outputTokens, sessionId };
}
