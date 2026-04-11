/**
 * Session Replay Writer — append-only JSONL for agent session recording.
 *
 * Pattern: oh-my-claudecode session replay.
 * Each agent execution is recorded as a JSONL file for debugging/audit.
 */

import fs from 'fs';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), '.claude', 'sessions');

export interface ReplayEntry {
  timestamp: string;
  type: 'system' | 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'cost';
  agentId?: string;
  ticketId?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

function ensureDir(): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Append a replay entry to a session's JSONL file.
 */
export function appendReplayEntry(sessionId: string, entry: ReplayEntry): void {
  try {
    ensureDir();
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
    const line = JSON.stringify({ ...entry, timestamp: entry.timestamp || new Date().toISOString() });
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch (err: any) {
    console.error('[replay-writer] Failed to write entry:', err.message);
  }
}

/**
 * Start a new replay session.
 */
export function startReplaySession(
  sessionId: string,
  agentId: string,
  ticketId: string,
  task: string,
): void {
  appendReplayEntry(sessionId, {
    timestamp: new Date().toISOString(),
    type: 'system',
    agentId,
    ticketId,
    content: `Session started: ${task}`,
    metadata: { agentId, ticketId, task },
  });
}

/**
 * Record a tool call in the replay.
 */
export function recordToolCall(
  sessionId: string,
  toolName: string,
  input: Record<string, unknown>,
): void {
  appendReplayEntry(sessionId, {
    timestamp: new Date().toISOString(),
    type: 'tool_use',
    content: toolName,
    metadata: { toolName, input: truncateInput(input) },
  });
}

/**
 * Record a tool result in the replay.
 */
export function recordToolResult(
  sessionId: string,
  toolName: string,
  output: string,
  blocked?: boolean,
): void {
  appendReplayEntry(sessionId, {
    timestamp: new Date().toISOString(),
    type: 'tool_result',
    content: output.slice(0, 500),
    metadata: { toolName, blocked, outputLength: output.length },
  });
}

/**
 * Record session cost.
 */
export function recordCost(
  sessionId: string,
  costUsd: number,
  inputTokens: number,
  outputTokens: number,
  model: string,
): void {
  appendReplayEntry(sessionId, {
    timestamp: new Date().toISOString(),
    type: 'cost',
    content: `$${costUsd.toFixed(4)} (${inputTokens}/${outputTokens} tokens)`,
    metadata: { costUsd, inputTokens, outputTokens, model },
  });
}

function truncateInput(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 200) {
      result[key] = value.slice(0, 200) + '...';
    } else {
      result[key] = value;
    }
  }
  return result;
}
