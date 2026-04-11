/**
 * Session Replay Reader — read JSONL session files for debugging/audit.
 */

import fs from 'fs';
import path from 'path';
import type { ReplayEntry } from './writer';

const SESSIONS_DIR = path.join(process.cwd(), '.claude', 'sessions');

/**
 * Read all entries from a session replay file.
 */
export function readReplaySession(sessionId: string): ReplayEntry[] {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim().split('\n').filter(Boolean).map(line => {
    try {
      return JSON.parse(line) as ReplayEntry;
    } catch {
      return null;
    }
  }).filter(Boolean) as ReplayEntry[];
}

/**
 * List all session replay files.
 */
export function listReplaySessions(): { sessionId: string; createdAt: string; size: number }[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];

  return fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => {
      const filePath = path.join(SESSIONS_DIR, f);
      const stats = fs.statSync(filePath);
      return {
        sessionId: f.replace('.jsonl', ''),
        createdAt: stats.birthtime.toISOString(),
        size: stats.size,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Get session summary (first and last entry, cost totals).
 */
export function getReplaySessionSummary(sessionId: string): {
  entries: number;
  firstEntry?: string;
  lastEntry?: string;
  totalCostUsd: number;
  toolCalls: number;
} {
  const entries = readReplaySession(sessionId);
  if (entries.length === 0) return { entries: 0, totalCostUsd: 0, toolCalls: 0 };

  const costEntries = entries.filter(e => e.type === 'cost');
  const totalCostUsd = costEntries.reduce((sum, e) => sum + ((e.metadata?.costUsd as number) ?? 0), 0);
  const toolCalls = entries.filter(e => e.type === 'tool_use').length;

  return {
    entries: entries.length,
    firstEntry: entries[0].timestamp,
    lastEntry: entries[entries.length - 1].timestamp,
    totalCostUsd,
    toolCalls,
  };
}
