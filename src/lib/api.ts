import { supabase, isOnline } from './supabase';
import type { CompanyRow, AgentRow, DelegationRow, ActivityRow } from './database.types';

// ── Types mapping DB rows → app state ────────────────────────────────────────

export interface ApiCompany {
  id: string;
  name: string;
  budget: number;
  budgetSpent: number;
  status: CompanyRow['status'];
  ceoGoal: string | null;
  agents: ApiAgent[];
  delegations: ApiDelegation[];
}

export interface ApiAgent {
  id: string;
  companyId: string;
  name: string;
  role: AgentRow['role'];
  status: AgentRow['status'];
  color: string;
  tileCol: number;
  tileRow: number;
  assignedTask: string | null;
  progress: number;
  spriteIndex: number;
  reportsTo: string | null;
  monthlyCost: number;
}

export interface ApiDelegation {
  id: string;
  companyId: string;
  goalId: string | null;
  toAgentId: string;
  toRole: string;
  task: string;
  progress: number;
}

// ── Row → App mappers ────────────────────────────────────────────────────────

function mapAgent(row: AgentRow): ApiAgent {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    role: row.role,
    status: row.status,
    color: row.color,
    tileCol: row.tile_col,
    tileRow: row.tile_row,
    assignedTask: row.assigned_task,
    progress: row.progress,
    spriteIndex: row.sprite_index,
    reportsTo: row.reports_to,
    monthlyCost: row.monthly_cost,
  };
}

function mapDelegation(row: DelegationRow): ApiDelegation {
  return {
    id: row.id,
    companyId: row.company_id,
    goalId: row.goal_id,
    toAgentId: row.to_agent_id,
    toRole: row.to_role,
    task: row.task,
    progress: row.progress,
  };
}

// ── Typed helpers to avoid `never` inference ─────────────────────────────────

function db() {
  return supabase!;
}

// ── Companies ────────────────────────────────────────────────────────────────

export async function fetchCompanies(): Promise<ApiCompany[]> {
  if (!isOnline()) return [];

  const { data: companies, error } = await db()
    .from('companies')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!companies?.length) return [];

  const companyIds = companies.map((c: any) => c.id);

  const [agentsRes, delegationsRes] = await Promise.all([
    db().from('agents').select('*').in('company_id', companyIds),
    db().from('delegations').select('*').in('company_id', companyIds),
  ]);

  const agentsByCompany = new Map<string, ApiAgent[]>();
  for (const row of (agentsRes.data ?? []) as AgentRow[]) {
    const mapped = mapAgent(row);
    const list = agentsByCompany.get(row.company_id) ?? [];
    list.push(mapped);
    agentsByCompany.set(row.company_id, list);
  }

  const delsByCompany = new Map<string, ApiDelegation[]>();
  for (const row of (delegationsRes.data ?? []) as DelegationRow[]) {
    const mapped = mapDelegation(row);
    const list = delsByCompany.get(row.company_id) ?? [];
    list.push(mapped);
    delsByCompany.set(row.company_id, list);
  }

  return (companies as CompanyRow[]).map(c => ({
    id: c.id,
    name: c.name,
    budget: c.budget,
    budgetSpent: c.budget_spent,
    status: c.status,
    ceoGoal: c.ceo_goal,
    agents: agentsByCompany.get(c.id) ?? [],
    delegations: delsByCompany.get(c.id) ?? [],
  }));
}

export async function createCompany(name: string, budget: number): Promise<ApiCompany> {
  if (!isOnline()) throw new Error('Offline');

  const { data, error } = await db()
    .from('companies')
    .insert({ name, budget } as any)
    .select()
    .single();
  if (error) throw error;
  const co = data as CompanyRow;

  // Seed default agents (CEO, PM, DevOps, Frontend)
  const ROLE_DEFAULTS = [
    { role: 'CEO',      name: 'Ada Chen',   color: '#00ffff', sprite: 0, col: 3, row: 13 },
    { role: 'PM',       name: 'Sam Patel',  color: '#c084fc', sprite: 1, col: 7, row: 13 },
    { role: 'DevOps',   name: 'Kai Müller', color: '#00ff88', sprite: 2, col: 5, row: 17 },
    { role: 'Frontend', name: 'Mia Torres', color: '#ff8800', sprite: 3, col: 5, row: 19 },
  ];

  const agentInserts = ROLE_DEFAULTS.map(r => ({
    company_id: co.id,
    name: r.name,
    role: r.role,
    color: r.color,
    sprite_index: r.sprite,
    tile_col: r.col,
    tile_row: r.row,
  }));

  const { data: agentsData, error: agentError } = await db()
    .from('agents')
    .insert(agentInserts as any)
    .select();
  if (agentError) throw agentError;
  const agents = (agentsData ?? []) as AgentRow[];

  // Set reports_to: all non-CEO agents report to CEO
  const ceoAgent = agents.find(a => a.role === 'CEO');
  if (ceoAgent) {
    const nonCeo = agents.filter(a => a.role !== 'CEO');
    if (nonCeo.length > 0) {
      await Promise.all(
        nonCeo.map(a =>
          db().from('agents').update({ reports_to: ceoAgent.id } as any).eq('id', a.id)
        )
      );
    }
  }

  // Log activity
  await db().from('activity_log').insert({
    company_id: co.id,
    type: 'status-change',
    message: `Company "${name}" founded with $${(budget / 1000).toFixed(0)}k budget`,
  } as any);

  return {
    id: co.id,
    name: co.name,
    budget: co.budget,
    budgetSpent: co.budget_spent,
    status: co.status,
    ceoGoal: co.ceo_goal,
    agents: agents.map(mapAgent),
    delegations: [],
  };
}

// ── Goal Assignment (CEO delegates) ──────────────────────────────────────────

export async function assignGoal(companyId: string, goal: string): Promise<{
  delegations: ApiDelegation[];
  agents: ApiAgent[];
}> {
  if (!isOnline()) throw new Error('Offline');

  // Update company ceo_goal
  await db()
    .from('companies')
    .update({ ceo_goal: goal, status: 'growing' } as any)
    .eq('id', companyId);

  // Get agents for this company
  const { data: agentsData } = await db()
    .from('agents')
    .select('*')
    .eq('company_id', companyId);
  const agents = (agentsData ?? []) as AgentRow[];

  if (!agents.length) throw new Error('No agents found');

  const ceo = agents.find(a => a.role === 'CEO');
  const workers = agents.filter(a => a.role !== 'CEO');

  // Create goal record
  const { data: goalRecord } = await db()
    .from('goals')
    .insert({
      company_id: companyId,
      title: goal,
      assigned_to: ceo?.id ?? null,
      status: 'in-progress',
    } as any)
    .select()
    .single();
  const goalRow = goalRecord as any;

  // Create delegations for each worker
  const taskMap: Record<string, string> = {
    PM: `Define requirements for: ${goal}`,
    DevOps: `Set up infra for: ${goal}`,
    Frontend: `Build UI for: ${goal}`,
    Backend: `Build API for: ${goal}`,
    QA: `Test: ${goal}`,
    Designer: `Design: ${goal}`,
  };

  const delInserts = workers.map(a => ({
    company_id: companyId,
    goal_id: goalRow?.id ?? null,
    to_agent_id: a.id,
    to_role: a.role,
    task: taskMap[a.role] ?? `Work on: ${goal}`,
    progress: 0,
  }));

  const { data: delegationsData, error: delError } = await db()
    .from('delegations')
    .insert(delInserts as any)
    .select();
  if (delError) throw delError;
  const delegations = (delegationsData ?? []) as DelegationRow[];

  // Update agent statuses to working
  const ROLE_SEATS: Record<string, { col: number; row: number }> = {
    CEO:      { col: 3, row: 13 },
    PM:       { col: 7, row: 13 },
    DevOps:   { col: 5, row: 17 },
    Frontend: { col: 5, row: 19 },
  };

  await Promise.all(
    agents.map(a => {
      const seat = ROLE_SEATS[a.role] ?? { col: a.tile_col, row: a.tile_row };
      const task = a.role === 'CEO'
        ? `Oversee: ${goal}`
        : taskMap[a.role] ?? `Work on: ${goal}`;
      return db().from('agents').update({
        status: 'working',
        assigned_task: task,
        progress: 0,
        tile_col: seat.col,
        tile_row: seat.row,
      } as any).eq('id', a.id);
    })
  );

  // Log
  await db().from('activity_log').insert({
    company_id: companyId,
    agent_id: ceo?.id ?? null,
    type: 'goal-assigned',
    message: `CEO assigned goal: "${goal}"`,
  } as any);

  // Return updated state
  const { data: updatedAgentsData } = await db()
    .from('agents')
    .select('*')
    .eq('company_id', companyId);

  return {
    delegations: delegations.map(mapDelegation),
    agents: ((updatedAgentsData ?? []) as AgentRow[]).map(mapAgent),
  };
}

// ── Simulation Tick ──────────────────────────────────────────────────────────

export async function tickCompany(companyId: string): Promise<{
  company: Partial<ApiCompany>;
  agents: ApiAgent[];
  delegations: ApiDelegation[];
  allDone: boolean;
}> {
  if (!isOnline()) throw new Error('Offline');

  // Fetch current delegations
  const { data: delsData } = await db()
    .from('delegations')
    .select('*')
    .eq('company_id', companyId);
  const dels = (delsData ?? []) as DelegationRow[];

  if (!dels.length) {
    return { company: {}, agents: [], delegations: [], allDone: true };
  }

  const increment = 8 + Math.floor(Math.random() * 12);
  let allDone = true;

  // Update delegation progress
  const updatedDels: ApiDelegation[] = [];
  for (const d of dels) {
    const newProgress = Math.min(100, d.progress + increment);
    if (newProgress < 100) allDone = false;
    await db().from('delegations').update({ progress: newProgress } as any).eq('id', d.id);
    updatedDels.push({ ...mapDelegation(d), progress: newProgress });
  }

  // Update agents based on progress
  const { data: agentsData } = await db()
    .from('agents')
    .select('*')
    .eq('company_id', companyId);
  const agents = (agentsData ?? []) as AgentRow[];

  const BREAK_POS = [
    { col: 15, row: 14 },
    { col: 15, row: 15 },
    { col: 14, row: 15 },
  ];
  const MEETING_POS = { col: 5, row: 16 };

  for (const agent of agents) {
    const del = updatedDels.find(d => d.toRole === agent.role);
    if (agent.role === 'CEO') {
      const pos = allDone ? { col: 3, row: 13 } : MEETING_POS;
      await db().from('agents').update({
        status: allDone ? 'idle' : 'meeting',
        tile_col: pos.col,
        tile_row: pos.row,
        progress: allDone ? 100 : Math.round(updatedDels.reduce((s, d) => s + d.progress, 0) / updatedDels.length),
        assigned_task: allDone ? null : agent.assigned_task,
      } as any).eq('id', agent.id);
    } else if (del) {
      if (del.progress >= 100) {
        const bp = BREAK_POS[Math.floor(Math.random() * BREAK_POS.length)];
        await db().from('agents').update({
          status: 'break',
          progress: 100,
          tile_col: bp.col,
          tile_row: bp.row,
          assigned_task: null,
        } as any).eq('id', agent.id);
      } else {
        await db().from('agents').update({ progress: del.progress } as any).eq('id', agent.id);
      }
    }
  }

  // Budget burn
  const costPerTick = 150;
  const { data: coData } = await db()
    .from('companies')
    .select('budget_spent')
    .eq('id', companyId)
    .single();
  const co = coData as any;
  const newSpent = (co?.budget_spent ?? 0) + costPerTick;

  if (allDone) {
    await db().from('companies').update({
      ceo_goal: null,
      status: 'scaling',
      budget_spent: newSpent,
    } as any).eq('id', companyId);
    await db().from('delegations').delete().eq('company_id', companyId);
    await db().from('goals')
      .update({ status: 'completed', progress: 100 } as any)
      .eq('company_id', companyId)
      .eq('status', 'in-progress');
  } else {
    await db().from('companies').update({ budget_spent: newSpent } as any).eq('id', companyId);
  }

  // Fetch final agent state
  const { data: finalData } = await db()
    .from('agents')
    .select('*')
    .eq('company_id', companyId);

  return {
    company: { budgetSpent: newSpent, status: allDone ? 'scaling' : 'growing' },
    agents: ((finalData ?? []) as AgentRow[]).map(mapAgent),
    delegations: allDone ? [] : updatedDels,
    allDone,
  };
}

// ── Agent Heartbeat ──────────────────────────────────────────────────────────

export async function sendHeartbeat(agentIds: string[]): Promise<void> {
  if (!isOnline() || agentIds.length === 0) return;
  await Promise.all(
    agentIds.map(id =>
      db().from('agents').update({
        last_heartbeat: new Date().toISOString(),
        heartbeat_status: 'alive',
      }).eq('id', id)
    )
  );
}

export async function checkStaleAgents(): Promise<void> {
  if (!isOnline()) return;
  await db().rpc('check_stale_agents');
}

// ── Activity Log ─────────────────────────────────────────────────────────────

export async function fetchActivityLog(companyId: string, limit = 20): Promise<ActivityRow[]> {
  if (!isOnline()) return [];
  const { data, error } = await db()
    .from('activity_log')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}
