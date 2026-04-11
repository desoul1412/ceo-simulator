import { getClient } from './db';
import type { Notification, ActivityLogEntry } from './types';

const db = () => getClient();

// ── Notifications ─────────────────────────────────────────────────────────────

export async function notify(companyId: string, type: string, title: string, message: string, link?: string) {
  const row: Record<string, unknown> = { company_id: companyId, type, title, message };
  if (link) row.link = link;
  const { error } = await db().from('notifications').insert(row);
  if (error) throw error;
}

export async function getUnreadNotifications(companyId: string) {
  const { data, error } = await db().from('notifications')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_read', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const { error } = await db().from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllRead(companyId: string) {
  const { error } = await db().from('notifications')
    .update({ is_read: true })
    .eq('company_id', companyId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function getUnreadCount(companyId: string) {
  const { count, error } = await db().from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export async function logActivity(companyId: string, type: string, message: string, agentId?: string) {
  const row: Record<string, unknown> = { company_id: companyId, type, message };
  if (agentId) row.agent_id = agentId;
  const { error } = await db().from('activity_log').insert(row);
  if (error) throw error;
}

export async function getActivityLog(companyId: string, limit = 50) {
  const { data, error } = await db().from('activity_log')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
