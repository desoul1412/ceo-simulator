/**
 * Agent-to-Agent Query System — active mid-task communication.
 *
 * Allows an agent to:
 * 1. Ask another agent a question and get a response
 * 2. Request a specific artifact (file content, API spec, etc.)
 * 3. Query any agent by role (e.g., "ask the Backend agent about the API schema")
 *
 * Flow:
 * - Agent A is working on a task
 * - Agent A needs info from Agent B (e.g., "What's the API schema for /users?")
 * - System creates a query, uses a fast model to generate Agent B's response
 *   from Agent B's brain/memory context (no full SDK session needed)
 * - Response is injected back into Agent A's context
 *
 * This is a synchronous (blocking) operation — Agent A waits for the response.
 * Uses a fast model (haiku) to keep costs low and latency minimal.
 */

import { supabase } from './supabaseAdmin';
import { sendMessage } from './agentMessenger';
import { searchBrain } from './brainSearch';
import { loadMemory } from './memoryManager';

interface QueryResult {
  response: string;
  respondedBy: { id: string; name: string; role: string };
  costUsd: number;
  tokens: number;
}

/**
 * Ask another agent a question. The system generates a response
 * using the target agent's brain/memory context + a fast model.
 */
export async function queryAgent(
  fromAgentId: string,
  targetAgentId: string | null, // null = find by role
  targetRole: string | null,    // used if targetAgentId is null
  companyId: string,
  question: string,
): Promise<QueryResult> {
  // Resolve target agent
  let target: { id: string; name: string; role: string; system_prompt: string | null } | null = null;

  if (targetAgentId) {
    const { data } = await supabase.from('agents').select('id, name, role, system_prompt').eq('id', targetAgentId).single();
    target = data as any;
  } else if (targetRole) {
    const { data } = await supabase.from('agents').select('id, name, role, system_prompt')
      .eq('company_id', companyId).ilike('role', `%${targetRole}%`).limit(1).single();
    target = data as any;
  }

  if (!target) throw new Error(`No agent found (id: ${targetAgentId}, role: ${targetRole})`);

  // Build target agent's context from brain + memory
  const [brainResults, memory] = await Promise.all([
    searchBrain(question, { companyId, limit: 3 }),
    loadMemory(target.id),
  ]);

  const brainContext = brainResults.length > 0
    ? brainResults.map(r => `[${r.path}] ${r.content.slice(0, 500)}`).join('\n\n')
    : '';

  const memoryContext = [
    memory.skills.length > 0 ? `Skills: ${memory.skills.join(', ')}` : '',
    memory.shortTerm.length > 0 ? `Recent work: ${memory.shortTerm.slice(0, 3).join('; ')}` : '',
    memory.completedTasks.length > 0
      ? `Completed: ${memory.completedTasks.slice(0, 5).map(t => t.task).join('; ')}`
      : '',
  ].filter(Boolean).join('\n');

  // Use a fast model to generate the response (text-only, no SDK needed)
  const systemPrompt = `You are ${target.name}, a ${target.role} agent. Another team member is asking you a question. Answer based on your knowledge and context. Be concise and specific.

${target.system_prompt ? `Your role: ${target.system_prompt.slice(0, 500)}` : ''}
${memoryContext ? `\nYour memory:\n${memoryContext}` : ''}
${brainContext ? `\nRelevant documents:\n${brainContext}` : ''}`;

  // Try to use the LLM router for a fast response
  let response = '';
  let costUsd = 0;
  let tokens = 0;

  try {
    const { routeAndExecute } = await import('./llm/router');
    const result = await routeAndExecute(target.id, companyId, {
      systemPrompt,
      userPrompt: question,
      maxTurns: 1,
      maxBudgetUsd: 0.05, // very cheap — just a text response
    }, {
      role: target.role,
      task: `answer-query: ${question.slice(0, 50)}`,
    });
    response = result.output;
    costUsd = result.costUsd;
    tokens = result.inputTokens + result.outputTokens;
  } catch {
    // Fallback: use Claude SDK directly with haiku
    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      const q = query({
        prompt: question,
        options: {
          systemPrompt,
          model: 'haiku' as any,
          maxTurns: 1,
          maxBudgetUsd: 0.02,
          permissionMode: 'acceptEdits' as any,
        },
      });
      for await (const msg of q) {
        if (msg.type === 'assistant') {
          const m = msg as any;
          if (m.message?.content) {
            for (const block of m.message.content) {
              if (block.type === 'text') response += block.text;
            }
          }
        }
        if (msg.type === 'result') {
          const r = msg as any;
          costUsd = r.costUsd ?? 0;
          tokens = (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
        }
      }
    } catch (err: any) {
      response = `[Query failed: ${err.message}]`;
    }
  }

  // Log the query as an agent message for audit trail
  await sendMessage(
    companyId, fromAgentId, target.id, null,
    'agent_query', `Query from agent`,
    `Q: ${question}\n\nA: ${response.slice(0, 500)}`,
    { query: question, response_length: response.length, cost_usd: costUsd },
  );

  return {
    response,
    respondedBy: { id: target.id, name: target.name, role: target.role },
    costUsd,
    tokens,
  };
}

/**
 * Batch query: ask multiple agents at once and get all responses.
 * Useful for gathering info from the whole team before a decision.
 */
export async function queryTeam(
  fromAgentId: string,
  companyId: string,
  question: string,
  excludeRoles: string[] = ['CEO'],
): Promise<QueryResult[]> {
  const { data: agents } = await supabase.from('agents')
    .select('id, name, role')
    .eq('company_id', companyId);

  const targets = (agents ?? [])
    .filter((a: any) => a.id !== fromAgentId && !excludeRoles.includes(a.role));

  const results = await Promise.all(
    targets.map((a: any) =>
      queryAgent(fromAgentId, a.id, null, companyId, question)
        .catch(err => ({
          response: `[Error: ${err.message}]`,
          respondedBy: { id: a.id, name: a.name, role: a.role },
          costUsd: 0, tokens: 0,
        }))
    )
  );

  return results;
}
