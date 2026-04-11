import { getClient } from './db';
import type { AuditLogEntry, DeadLetterEntry, TokenUsage } from './types';

const db = () => getClient();

// ── Audit Log ─────────────────────────────────────────────────────────────────

export async function logAudit(entry: Partial<AuditLogEntry>) {
  const { error } = await db().from('audit_log').insert(entry);
  if (error) throw error;
}

export async function getAuditLog(companyId: string, limit = 100) {
  const { data, error } = await db().from('audit_log')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ── Dead Letter Queue ─────────────────────────────────────────────────────────

export async function getDLQEntries(companyId: string) {
  const { data, error } = await db().from('dead_letter_queue')
    .select('*, tickets(title, agent_id)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertDLQ(entry: Partial<DeadLetterEntry>) {
  const { data, error } = await db().from('dead_letter_queue').insert(entry).select().single();
  if (error) throw error;
  return data as DeadLetterEntry;
}

export async function getDLQEntry(id: string) {
  const { data, error } = await db().from('dead_letter_queue').select('*').eq('id', id).single();
  if (error) throw error;
  return data as DeadLetterEntry;
}

export async function resolveDLQ(id: string, reason?: string) {
  const updates: Record<string, unknown> = { status: 'resolved' };
  if (reason) updates.resolution = reason;
  const { error } = await db().from('dead_letter_queue').update(updates).eq('id', id);
  if (error) throw error;
}

// ── Token Usage ───────────────────────────────────────────────────────────────

export async function recordTokenUsage(usage: Partial<TokenUsage>) {
  const { error } = await db().from('token_usage').insert(usage);
  if (error) throw error;
}

export async function getTokenUsageByCompany(companyId: string) {
  const { data, error } = await db().from('token_usage')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteTokenUsageByAgent(agentId: string) {
  const { error } = await db().from('token_usage').delete().eq('agent_id', agentId);
  if (error) throw error;
}
