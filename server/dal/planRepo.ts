import { getClient } from './db';
import type { ProjectPlan } from './types';

const db = () => getClient();

// ── Project Plans ─────────────────────────────────────────────────────────────

export async function getPlansByCompany(companyId: string, type?: string) {
  let q = db().from('project_plans').select('*').eq('company_id', companyId);
  if (type) q = q.eq('type', type);
  q = q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getMasterPlan(companyId: string) {
  const { data, error } = await db().from('project_plans')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', 'master_plan')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as ProjectPlan;
}

export async function createPlan(plan: Partial<ProjectPlan>) {
  const { data, error } = await db().from('project_plans').insert(plan).select().single();
  if (error) throw error;
  return data as ProjectPlan;
}

export async function updatePlan(id: string, updates: Partial<ProjectPlan>) {
  const { data, error } = await db().from('project_plans').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ProjectPlan;
}

export async function approvePlan(id: string) {
  const { data, error } = await db().from('project_plans')
    .update({ status: 'approved' })
    .eq('id', id).select().single();
  if (error) throw error;
  return data as ProjectPlan;
}

export async function upsertPlan(companyId: string, type: string, content: string, title: string, author?: string) {
  // Check if plan exists
  const { data: existing } = await db().from('project_plans')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', type)
    .limit(1);

  if (existing && existing.length > 0) {
    const updates: Record<string, unknown> = { content, title };
    if (author) updates.author = author;
    const { data, error } = await db().from('project_plans')
      .update(updates)
      .eq('id', existing[0].id)
      .select().single();
    if (error) throw error;
    return data as ProjectPlan;
  } else {
    const insert: Record<string, unknown> = { company_id: companyId, type, content, title };
    if (author) insert.author = author;
    const { data, error } = await db().from('project_plans')
      .insert(insert)
      .select().single();
    if (error) throw error;
    return data as ProjectPlan;
  }
}

// ── Planning Sessions ─────────────────────────────────────────────────────────

export async function getPlanningSession(id: string) {
  const { data, error } = await db().from('planning_sessions').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getPlanningSessionsByCompany(companyId: string) {
  const { data, error } = await db().from('planning_sessions')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPlanningSession(session: Record<string, unknown>) {
  const { data, error } = await db().from('planning_sessions').insert(session).select().single();
  if (error) throw error;
  return data;
}

export async function updatePlanningSession(id: string, updates: Record<string, unknown>) {
  const { data, error } = await db().from('planning_sessions').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Planning Tabs ─────────────────────────────────────────────────────────────

export async function getPlanningTabs(sessionId: string) {
  const { data, error } = await db().from('planning_tabs')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlanningTabs(tabs: Record<string, unknown>[]) {
  const { data, error } = await db().from('planning_tabs').insert(tabs).select();
  if (error) throw error;
  return data ?? [];
}

export async function updatePlanningTab(id: string, updates: Record<string, unknown>) {
  const { data, error } = await db().from('planning_tabs').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
