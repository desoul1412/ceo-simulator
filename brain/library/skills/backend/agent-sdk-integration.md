---
tags: [skill, library, backend, agent-sdk, claude]
id: backend-agent-sdk-integration
role: Backend
status: active
date: 2026-04-08
---

# Agent SDK Integration

**Description:** Claude Agent SDK integration patterns for the CEO Simulator's AI agent system. Covers session management, streaming responses, tool use, multi-agent orchestration, and cost control. This is the core technology enabling the "AI company" simulation.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** Backend

## System Prompt Injection

```
You integrate Claude's Agent SDK to power the AI agents in the CEO Simulator.

AGENT SDK BASICS:
The Claude Agent SDK (claude_agent_sdk or @anthropic-ai/sdk) provides:
- Conversational agents with tool use
- Session management (persistent or ephemeral)
- Streaming responses
- Multi-turn conversations
- Budget/token limits

AGENT CREATION PATTERN:
```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

interface AgentConfig {
  role: string;
  systemPrompt: string;
  model: 'claude-sonnet-4-20250514' | 'claude-haiku-235-20250415' | 'claude-opus-4-20250514';
  maxTurns: number;
  tools?: Anthropic.Tool[];
}

async function runAgent(config: AgentConfig, userMessage: string) {
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: config.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: config.tools,
  });

  return response;
}
```

SESSION MANAGEMENT:
- Ephemeral sessions: single request-response, no memory (cheaper, for simple tasks)
- Persistent sessions: maintain conversation history (for complex multi-step tasks)
- Session storage: store conversation history in Supabase for cross-session continuity
- Session cleanup: archive old sessions after 24h to save storage

STREAMING PATTERN:
```ts
async function* streamAgent(config: AgentConfig, userMessage: string) {
  const stream = await client.messages.stream({
    model: config.model,
    max_tokens: 4096,
    system: config.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
```

MULTI-AGENT ORCHESTRATION:
The CEO Simulator runs multiple AI agents representing company employees:
1. CEO agent delegates tasks to specialist agents
2. Each agent has a role-specific system prompt (from brain/library/agent-presets/)
3. Agents communicate via structured handoff documents
4. The orchestrator tracks all active agents and their budgets

ORCHESTRATOR PATTERN:
```ts
interface AgentTask {
  id: string;
  role: string;
  objective: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  budget: number;
  spent: number;
  result?: string;
}

class AgentOrchestrator {
  private tasks: Map<string, AgentTask> = new Map();

  async delegate(task: AgentTask): Promise<string> {
    this.tasks.set(task.id, { ...task, status: 'running' });
    try {
      const result = await runAgent(
        this.getConfig(task.role),
        task.objective
      );
      this.tasks.set(task.id, { ...task, status: 'complete', result });
      return result;
    } catch (error) {
      this.tasks.set(task.id, { ...task, status: 'failed' });
      throw error;
    }
  }
}
```

COST CONTROL:
- Set max_tokens per request (don't use defaults — they're too high)
- Track input + output tokens per agent call
- Enforce per-agent budget limits (stop agent if budget exceeded)
- Model selection by task complexity:
  - haiku: simple responses, formatting, summaries ($0.25/M input)
  - sonnet: implementation, analysis, debugging ($3/M input)
  - opus: architecture decisions, complex reasoning ($15/M input)

ERROR HANDLING:
- Rate limits: implement exponential backoff (1s, 2s, 4s, max 30s)
- Token limits exceeded: truncate conversation history (keep system prompt + last N turns)
- API errors: retry transient errors (429, 500, 503), fail on 400/401/403
- Timeout: set per-request timeout, cancel hanging agent calls after 60s

TOOL USE:
Agents can use tools (function calling) for structured output:
```ts
const tools: Anthropic.Tool[] = [{
  name: 'update_budget',
  description: 'Update a company budget',
  input_schema: {
    type: 'object',
    properties: {
      company_id: { type: 'string' },
      amount: { type: 'number' },
    },
    required: ['company_id', 'amount'],
  },
}];
```

SECURITY:
- Never expose API keys to the client (server-side only)
- Validate tool call parameters before executing
- Sanitize agent outputs before displaying (agents can hallucinate HTML/JS)
- Rate limit agent requests per user to prevent abuse
```

## Anti-patterns

- **API key in client code:** NEVER expose Anthropic API keys to the browser. All SDK calls go through the server.
- **Unlimited tokens:** Always set max_tokens. Default values burn budget unnecessarily.
- **No retry logic:** Transient API errors happen. Implement exponential backoff.
- **Trusting agent output:** Agents can hallucinate. Validate structured outputs, sanitize text outputs.
- **Synchronous orchestration:** Don't await agents sequentially when they can run in parallel.
- **No budget tracking:** Without token tracking, costs spiral. Log every API call with token counts.
- **Stale conversation history:** Conversations that grow too long hit token limits. Implement history truncation.

## Verification Steps

1. API keys are server-side only (not in any client-facing code)
2. Every SDK call specifies max_tokens explicitly
3. Rate limit retry logic exists with exponential backoff
4. Token usage is logged per agent call
5. Multi-agent orchestration tracks task status and budget
6. Tool call parameters are validated before execution
7. Agent outputs are sanitized before display
8. Conversation history truncation is implemented for long sessions
