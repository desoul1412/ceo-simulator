import { getClient } from './db';
import type { Sprint } from './types';

const db = () => getClient();

export async function getSprint(id: string) {
  const { data, error } = await db().from('sprints').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Sprint;
}

export async function getSprintsByCompany(companyId: string) {
  const { data, error } = await db().from('sprints')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestSprint(companyId: string) {
  const { data, error } = await db().from('sprints')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as Sprint;
}

export async function getSprintCount(companyId: string) {
  const { data } = await db().from('sprints')
    .select('id')
    .eq('company_id', companyId);
  return data?.length ?? 0;
}

export async function createSprint(sprint: Partial<Sprint>) {
  const { data, error } = await db().from('sprints').insert(sprint).select().single();
  if (error) throw error;
  return data as Sprint;
}

export async function updateSprint(id: string, updates: Partial<Sprint>) {
  const { error } = await db().from('sprints').update(updates).eq('id', id);
  if (error) throw error;
}

export async function completeSprint(id: string) {
  const { error } = await db().from('sprints')
    .update({ status: 'completed' })
    .eq('id', id);
  if (error) throw error;
}

export async function getSprintStatus(sprintId: string) {
  const { data, error } = await db().from('sprints')
    .select('status')
    .eq('id', sprintId)
    .single();
  if (error) throw error;
  return data?.status;
}
