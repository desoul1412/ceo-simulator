import { getClient } from './db';
import type { MergeRequest } from './types';

const db = () => getClient();

export async function getMergeRequest(id: string) {
  const { data, error } = await db().from('merge_requests').select('*').eq('id', id).single();
  if (error) throw error;
  return data as MergeRequest;
}

export async function getMergeRequestsByCompany(companyId: string) {
  const { data, error } = await db().from('merge_requests')
    .select('*, agents(name, role)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMergeRequest(mr: Partial<MergeRequest>) {
  const { data, error } = await db().from('merge_requests').insert(mr).select().single();
  if (error) throw error;
  return data as MergeRequest;
}

export async function updateMergeRequest(id: string, updates: Partial<MergeRequest>) {
  const { data, error } = await db().from('merge_requests').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as MergeRequest;
}

export async function markMerged(id: string) {
  return updateMergeRequest(id, {
    status: 'merged',
    merged_at: new Date().toISOString(),
  } as Partial<MergeRequest>);
}

export async function markRejected(id: string) {
  return updateMergeRequest(id, { status: 'rejected' } as Partial<MergeRequest>);
}

export async function markConflicted(id: string) {
  return updateMergeRequest(id, { status: 'conflicted' } as Partial<MergeRequest>);
}

export async function getOpenMergeRequests(companyId: string) {
  const { data } = await db().from('merge_requests')
    .select('branch_name')
    .eq('company_id', companyId)
    .in('status', ['open', 'conflicted']);
  return data ?? [];
}

export async function nullifyAgentMergeRequests(agentId: string) {
  await db().from('merge_requests')
    .update({ agent_id: null })
    .eq('agent_id', agentId);
}
