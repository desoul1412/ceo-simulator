import { getClient } from './db';
import type { Company } from './types';

const db = () => getClient();

export async function getCompany(id: string) {
  const { data, error } = await db().from('companies').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Company;
}

export async function getCompanyBudget(id: string) {
  const { data, error } = await db().from('companies').select('budget, budget_spent').eq('id', id).single();
  if (error) throw error;
  return data as Pick<Company, 'budget' | 'budget_spent'>;
}

export async function getActiveCompanies() {
  const { data, error } = await db().from('companies').select('id, name, heartbeat_interval_ms, auto_approve_tickets').eq('status', 'active');
  if (error) throw error;
  return data ?? [];
}

export async function updateCompany(id: string, updates: Partial<Company>) {
  const { error } = await db().from('companies').update(updates).eq('id', id);
  if (error) throw error;
}

export async function updateBudgetSpent(companyId: string, additionalCostUnits: number) {
  const { data } = await db().from('companies').select('budget_spent').eq('id', companyId).single();
  if (data) {
    await db().from('companies').update({
      budget_spent: ((data as any).budget_spent ?? 0) + additionalCostUnits,
    }).eq('id', companyId);
  }
}

export async function connectRepo(companyId: string, repoUrl: string, branch: string, authMethod: string, token?: string) {
  const updates: any = {
    repo_url: repoUrl,
    repo_branch: branch || 'main',
    git_auth_method: authMethod || 'token',
    repo_status: 'connecting',
  };
  if (token) updates.git_token_encrypted = token;
  const { error } = await db().from('companies').update(updates).eq('id', companyId);
  if (error) throw error;
}

export async function getRepoStatus(companyId: string) {
  const { data, error } = await db().from('companies')
    .select('repo_url, repo_branch, repo_status, repo_path, git_auth_method')
    .eq('id', companyId).single();
  if (error) throw error;
  return data;
}

export async function disconnectRepo(companyId: string) {
  const { error } = await db().from('companies').update({
    repo_url: null, repo_branch: null, repo_status: null,
    repo_path: null, git_auth_method: null, git_token_encrypted: null,
  }).eq('id', companyId);
  if (error) throw error;
}
