/**
 * Claude SDK Adapter — wraps @anthropic-ai/claude-agent-sdk query().
 * This is the ONLY adapter that provides filesystem access (Read/Write/Edit/Bash/Glob/Grep).
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { LLMAdapter, LLMModel, LLMRequest, LLMResponse } from '../types';

export class ClaudeSdkAdapter implements LLMAdapter {
  readonly providerType = 'sdk';

  async execute(model: LLMModel, request: LLMRequest): Promise<LLMResponse> {
    let result = '';
    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let sessionId = '';

    const q = query({
      prompt: request.userPrompt,
      options: {
        cwd: request.cwd || process.cwd(),
        systemPrompt: request.systemPrompt,
        maxTurns: request.maxTurns ?? 10,
        maxBudgetUsd: request.maxBudgetUsd ?? 2.0,
        tools: request.tools as any,
        allowedTools: request.allowedTools as any,
        model: model.model_id as any,
        permissionMode: (request.permissionMode ?? 'acceptEdits') as any,
        ...(request.effort ? { effort: request.effort as any } : {}),
        ...(request.resume ? { resume: request.resume } : {}),
      },
    });

    for await (const message of q) {
      if (message.type === 'assistant') {
        const msg = message as any;
        if (msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text') result += block.text;
          }
        }
      }
      if (message.type === 'result') {
        const res = message as any;
        costUsd = res.costUsd ?? 0;
        inputTokens = res.inputTokens ?? 0;
        outputTokens = res.outputTokens ?? 0;
        sessionId = res.sessionId ?? '';
      }
    }

    return {
      output: result,
      costUsd,
      inputTokens,
      outputTokens,
      sessionId,
      modelUsed: model.model_id,
      providerUsed: 'claude-sdk',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple check: can we import the SDK?
      return typeof query === 'function';
    } catch {
      return false;
    }
  }
}
