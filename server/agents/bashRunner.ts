import { execSync } from 'child_process';
import type { AgentContext, AgentRunResult } from './agentRunner';

/**
 * Execute a task by running a bash command/script.
 * Config: { command, args?, cwd?, env?, timeout? }
 *
 * The task is passed as an environment variable AGENT_TASK.
 * The script should output JSON to stdout:
 * { "output": "...", "costUsd": 0, "sessionId": "" }
 */
export async function executeBashAgent(ctx: AgentContext): Promise<AgentRunResult> {
  const config = ctx.runtimeConfig ?? {};
  const command = config.command;

  if (!command) {
    throw new Error(`Bash agent ${ctx.agentId} has no command configured in runtime_config`);
  }

  const args = (config.args ?? []).join(' ');
  const cwd = config.cwd ?? ctx.cwd;
  const timeout = config.timeout ?? 120_000;
  const fullCommand = `${command} ${args}`.trim();

  await ctx.onActivity(`Executing: ${fullCommand}`);

  const env = {
    ...process.env,
    ...(config.env ?? {}),
    AGENT_TASK: ctx.task,
    AGENT_ROLE: ctx.role,
    AGENT_ID: ctx.agentId,
    COMPANY_ID: ctx.companyId,
    AGENT_SYSTEM_PROMPT: ctx.systemPrompt,
    AGENT_SKILLS: (ctx.skills ?? []).join(','),
  };

  try {
    const stdout = execSync(fullCommand, {
      cwd,
      env,
      timeout,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    // Try to parse JSON output
    try {
      const data = JSON.parse(stdout.trim());
      return {
        output: data.output ?? stdout,
        costUsd: data.costUsd ?? 0,
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        sessionId: data.sessionId ?? '',
      };
    } catch {
      // Plain text output
      return {
        output: stdout.slice(0, 5000),
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        sessionId: '',
      };
    }
  } catch (err: any) {
    throw new Error(`Bash agent failed: ${err.message?.slice(0, 500)}`);
  }
}
