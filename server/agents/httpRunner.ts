import type { AgentContext, AgentRunResult } from './agentRunner';

/**
 * Execute a task by calling an HTTP endpoint.
 * Agent-agnostic: any service that accepts POST with task JSON can be an agent.
 * Config: { url, method?, headers?, timeout? }
 */
export async function executeHttpAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const config = ctx.runtimeConfig ?? {};
  const url = config.url;

  if (!url) {
    throw new Error(`HTTP agent ${ctx.agentId} has no URL configured in runtime_config`);
  }

  const method = config.method ?? 'POST';
  const headers = {
    'Content-Type': 'application/json',
    ...(config.headers ?? {}),
  };
  const timeout = config.timeout ?? 120_000;

  await ctx.onActivity(`Calling HTTP endpoint: ${url}`);

  const body = JSON.stringify({
    task: ctx.task,
    role: ctx.role,
    agentId: ctx.agentId,
    companyId: ctx.companyId,
    systemPrompt: ctx.systemPrompt,
    memory: ctx.memory,
    skills: ctx.skills,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      output: data.output ?? data.result ?? JSON.stringify(data),
      costUsd: data.costUsd ?? data.cost_usd ?? 0,
      inputTokens: data.inputTokens ?? data.input_tokens ?? 0,
      outputTokens: data.outputTokens ?? data.output_tokens ?? 0,
      sessionId: data.sessionId ?? data.session_id ?? '',
    };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`HTTP agent timed out after ${timeout / 1000}s`);
    }
    throw err;
  }
}
