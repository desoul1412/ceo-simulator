/**
 * Tool-Call Audit Trail — intercept and log every tool call/result.
 *
 * Pattern: ruflo immutable audit with HMAC-SHA256 proof chain.
 * Every tool call is logged with timing, cost, and block status.
 */

import crypto from 'crypto';
import { supabase } from '../supabaseAdmin';

const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'ceo-sim-audit-v2';

export interface AuditEntry {
  companyId: string;
  agentId: string;
  ticketId?: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutputSummary?: string;
  costUsd?: number;
  latencyMs?: number;
  blocked?: boolean;
  blockReason?: string;
}

// In-memory chain state for HMAC continuity
let lastProof = '0';

/**
 * Log a tool call to the audit trail with HMAC proof chain.
 */
export async function logToolCall(entry: AuditEntry): Promise<string | null> {
  try {
    // Build HMAC proof: H(previousProof + toolName + timestamp)
    const timestamp = new Date().toISOString();
    const proofInput = `${lastProof}:${entry.toolName}:${timestamp}`;
    const proof = crypto.createHmac('sha256', HMAC_SECRET).update(proofInput).digest('hex');
    lastProof = proof;

    const row = {
      company_id: entry.companyId,
      agent_id: entry.agentId,
      ticket_id: entry.ticketId ?? null,
      tool_name: entry.toolName,
      tool_input: truncateInput(entry.toolInput),
      tool_output_summary: entry.toolOutputSummary?.slice(0, 500) ?? null,
      cost_usd: entry.costUsd ?? 0,
      latency_ms: entry.latencyMs ?? 0,
      blocked: entry.blocked ?? false,
      block_reason: entry.blockReason ?? null,
      proof,
    };

    const { error } = await supabase.from('tool_audit_log').insert(row);
    if (error) {
      console.error('[audit] Failed to log tool call:', error.message);
      return null;
    }

    return proof;
  } catch (err: any) {
    console.error('[audit] Error logging tool call:', err.message);
    return null;
  }
}

/**
 * Query audit log for a company.
 */
export async function getAuditLog(
  companyId: string,
  options: {
    agentId?: string;
    toolName?: string;
    blocked?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ entries: any[]; total: number }> {
  let query = supabase.from('tool_audit_log')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (options.agentId) query = query.eq('agent_id', options.agentId);
  if (options.toolName) query = query.eq('tool_name', options.toolName);
  if (options.blocked !== undefined) query = query.eq('blocked', options.blocked);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[audit] Failed to query log:', error.message);
    return { entries: [], total: 0 };
  }

  return { entries: data ?? [], total: count ?? 0 };
}

/**
 * Verify HMAC proof chain integrity for a company's audit log.
 */
export async function verifyProofChain(companyId: string): Promise<{
  valid: boolean;
  verified: number;
  brokenAt?: number;
}> {
  const { data } = await supabase.from('tool_audit_log')
    .select('tool_name, proof, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (!data || data.length === 0) return { valid: true, verified: 0 };

  let prevProof = '0';
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const proofInput = `${prevProof}:${entry.tool_name}:${entry.created_at}`;
    const expected = crypto.createHmac('sha256', HMAC_SECRET).update(proofInput).digest('hex');

    if (expected !== entry.proof) {
      return { valid: false, verified: i, brokenAt: i };
    }
    prevProof = entry.proof;
  }

  return { valid: true, verified: data.length };
}

/**
 * Get audit summary stats for a company.
 */
export async function getAuditSummary(companyId: string): Promise<{
  totalCalls: number;
  blockedCalls: number;
  totalCostUsd: number;
  topTools: { tool: string; count: number }[];
}> {
  const { data } = await supabase.from('tool_audit_log')
    .select('tool_name, cost_usd, blocked')
    .eq('company_id', companyId);

  if (!data || data.length === 0) {
    return { totalCalls: 0, blockedCalls: 0, totalCostUsd: 0, topTools: [] };
  }

  const blocked = data.filter((d: any) => d.blocked).length;
  const totalCost = data.reduce((sum: number, d: any) => sum + (d.cost_usd ?? 0), 0);

  // Count tools
  const toolCounts: Record<string, number> = {};
  for (const d of data) {
    const name = (d as any).tool_name;
    toolCounts[name] = (toolCounts[name] ?? 0) + 1;
  }
  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, count }));

  return { totalCalls: data.length, blockedCalls: blocked, totalCostUsd: totalCost, topTools };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncateInput(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 300) {
      result[key] = value.slice(0, 300) + '...';
    } else {
      result[key] = value;
    }
  }
  return result;
}
