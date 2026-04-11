import { getClient } from './db';
import type { Agent } from './types';

const db = () => getClient();

export async function getAgent(id: string) {
  const { data, error } = await db().from('agents').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Agent;
}

export async function getAgentsByCompany(companyId: string) {
  const { data, error } = await db().from('agents').select('*').eq('company_id', companyId);
  if (error) throw error;
  return (data ?? []) as Agent[];
}

export async function getAgentBudget(id: string) {
  const { data, error } = await db().from('agents')
    .select('budget_limit, budget_spent, status, total_cost_usd')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createAgent(agent: Partial<Agent>) {
  const { data, error } = await db().from('agents').insert(agent).select().single();
  if (error) throw error;
  return data as Agent;
}

export async function updateAgent(id: string, updates: Partial<Agent>) {
  const { error } = await db().from('agents').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteAgent(id: string) {
  // Clean up related records first
  await db().from('tickets').update({ agent_id: null }).eq('agent_id', id);
  await db().from('merge_requests').update({ agent_id: null }).eq('agent_id', id);
  await db().from('token_usage').delete().eq('agent_id', id);
  await db().from('agent_sessions').delete().eq('agent_id', id);
  const { error } = await db().from('agents').delete().eq('id', id);
  if (error) throw error;
}

export async function setAgentWorking(id: string, task: string) {
  await db().from('agents').update({
    status: 'working',
    assigned_task: task,
    last_heartbeat: new Date().toISOString(),
    heartbeat_status: 'alive',
  }).eq('id', id);
}

export async function setAgentIdle(id: string) {
  await db().from('agents').update({
    status: 'break',
    assigned_task: null,
    progress: 100,
    last_heartbeat: new Date().toISOString(),
  }).eq('id', id);
}

export async function updateAgentBudgetSpent(id: string, costUsd: number) {
  const { data } = await db().from('agents').select('total_cost_usd, budget_spent').eq('id', id).single();
  if (data) {
    await db().from('agents').update({
      total_cost_usd: ((data as any).total_cost_usd ?? 0) + costUsd,
      budget_spent: ((data as any).budget_spent ?? 0) + costUsd,
    }).eq('id', id);
  }
}

export async function heartbeat(id: string) {
  await db().from('agents').update({
    last_heartbeat: new Date().toISOString(),
    heartbeat_status: 'alive',
  }).eq('id', id);
}

export async function updateMemory(id: string, memory: Record<string, any>) {
  await db().from('agents').update({ memory }).eq('id', id);
}

export async function injectSkill(id: string, skill: string) {
  const { data } = await db().from('agents').select('skills, memory').eq('id', id).single();
  if (!data) throw new Error('Agent not found');
  const agent = data as any;
  const skills = [...(agent.skills ?? [])];
  if (!skills.includes(skill)) skills.push(skill);
  const memory = agent.memory ?? {};
  const memSkills = [...(memory.skills ?? [])];
  if (!memSkills.includes(skill)) memSkills.push(skill);
  await db().from('agents').update({
    skills, memory: { ...memory, skills: memSkills },
  }).eq('id', id);
  return { skills, memory: { ...memory, skills: memSkills } };
}

export async function updateLifecycle(id: string, status: string) {
  const updates: any = { status };
  if (status === 'paused' || status === 'terminated') {
    updates.assigned_task = null;
  }
  const { data, error } = await db().from('agents').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Agent;
}

export async function updateBudgetLimit(id: string, budgetLimit: number) {
  const { data, error } = await db().from('agents').update({ budget_limit: budgetLimit }).eq('id', id).select().single();
  if (error) throw error;
  return data as Agent;
}
