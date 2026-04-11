import fs from 'fs';
import path from 'path';
import { supabase } from '../supabaseAdmin';

const BRAIN_ROOT = path.join(process.cwd(), 'brain');

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseMasterPlanPhases(content: string): { title: string; tasks: string[] }[] {
  const lines = content.split('\n');
  const phases: { title: string; tasks: string[] }[] = [];
  let current: { title: string; tasks: string[] } | null = null;

  for (const line of lines) {
    const phaseMatch = line.match(/^###\s+(.+)/);
    if (phaseMatch) {
      if (current) phases.push(current);
      current = { title: phaseMatch[1].trim(), tasks: [] };
      continue;
    }
    const taskMatch = line.match(/^- \[ \]\s+(.+)/);
    if (taskMatch && current) {
      current.tasks.push(taskMatch[1].trim());
    }
  }
  if (current) phases.push(current);
  return phases;
}

export async function checkSprintCompletion(sprintId: string): Promise<void> {
  try {
    const { data: sprint } = await supabase.from('sprints').select('*').eq('id', sprintId).single();
    if (!sprint) return;
    const s = sprint as any;
    if (s.status === 'completed') return;

    const { data: tickets } = await supabase.from('tickets')
      .select('id, status, board_column').eq('sprint_id', sprintId);
    if (!tickets || tickets.length === 0) return;

    const allDone = (tickets as any[]).every(
      (t) => t.board_column === 'done' || ['completed', 'cancelled'].includes(t.status)
    );
    if (!allDone) return;

    await supabase.from('sprints').update({ status: 'completed' }).eq('id', sprintId);

    await supabase.from('activity_log').insert({
      company_id: s.company_id, type: 'status-change',
      message: `Sprint "${s.name}" completed — all tickets done`,
    });

    await supabase.from('notifications').insert({
      company_id: s.company_id, type: 'system',
      title: `Sprint completed: ${s.name}`,
      message: `All tickets in "${s.name}" are done.`,
      link: `/company/${s.company_id}/board`,
    });

    await updateCompanyBrainSummary(s.company_id);

    // Auto-transition to next sprint from master plan
    const { data: plans } = await supabase.from('project_plans')
      .select('*').eq('company_id', s.company_id).eq('type', 'master_plan').eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(1);

    if (!plans || plans.length === 0) return;
    const masterPlan = plans[0] as any;
    const phases = parseMasterPlanPhases(masterPlan.content);
    if (phases.length === 0) return;

    const { data: existingSprints } = await supabase.from('sprints')
      .select('id, name').eq('company_id', s.company_id).order('created_at', { ascending: true });

    const nextSprintNumber = (existingSprints ?? []).length + 1;
    const nextPhaseIndex = (existingSprints ?? []).length;
    if (nextPhaseIndex >= phases.length) {
      await supabase.from('notifications').insert({
        company_id: s.company_id, type: 'system',
        title: 'All master plan phases completed',
        message: `All ${phases.length} phases from the master plan have been completed.`,
        link: `/company/${s.company_id}/overview`,
      });
      return;
    }

    const nextPhase = phases[nextPhaseIndex];
    const { data: newSprint } = await supabase.from('sprints').insert({
      company_id: s.company_id, name: `Sprint ${nextSprintNumber}`,
      goal: nextPhase.title, status: 'planning',
    } as any).select().single();
    if (!newSprint) return;

    const { data: agents } = await supabase.from('agents')
      .select('id, role').eq('company_id', s.company_id);
    const workers = (agents ?? []).filter((a: any) => (a.role as string).toLowerCase() !== 'ceo');

    for (let i = 0; i < nextPhase.tasks.length; i++) {
      const taskText = nextPhase.tasks[i];
      const taskLower = taskText.toLowerCase();
      const prefixMatch = taskText.match(/^(\w[\w\s-]*?):\s/);
      let agent = prefixMatch
        ? workers.find((a: any) => {
            const role = (a.role as string).toLowerCase();
            const prefix = prefixMatch[1].toLowerCase().trim();
            return prefix.includes(role) || role.includes(prefix);
          })
        : null;
      if (!agent) agent = workers.find((a: any) => taskLower.includes((a.role as string).toLowerCase())) ?? null;
      if (!agent && workers.length > 0) agent = workers[i % workers.length];

      await supabase.from('tickets').insert({
        company_id: s.company_id, agent_id: (agent as any)?.id ?? null,
        title: taskText, status: 'open', sprint_id: (newSprint as any).id,
        board_column: 'todo', story_points: 1, priority: i,
      } as any);
    }

    await supabase.from('activity_log').insert({
      company_id: s.company_id, type: 'status-change',
      message: `Auto-created Sprint ${nextSprintNumber} from master plan phase: ${nextPhase.title}`,
    });

    await supabase.from('notifications').insert({
      company_id: s.company_id, type: 'system',
      title: `Sprint ${nextSprintNumber} auto-created`,
      message: `${nextPhase.tasks.length} tickets from "${nextPhase.title}"`,
      link: `/company/${s.company_id}/board`,
    });
  } catch (err: any) {
    console.error('[checkSprintCompletion] Error:', err.message);
  }
}

export async function updateCompanyBrainSummary(companyId: string): Promise<string> {
  const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
  if (!company) throw new Error('Company not found');
  const c = company as any;

  const companySlug = slugify(c.name);
  const companyDir = path.join(BRAIN_ROOT, companySlug);
  fs.mkdirSync(companyDir, { recursive: true });

  const [sprintsRes, agentsRes, ticketsRes] = await Promise.all([
    supabase.from('sprints').select('*').eq('company_id', companyId).order('created_at', { ascending: true }),
    supabase.from('agents').select('*').eq('company_id', companyId),
    supabase.from('tickets').select('id, status, board_column, sprint_id').eq('company_id', companyId),
  ]);

  const sprints = (sprintsRes.data ?? []) as any[];
  const agents = (agentsRes.data ?? []) as any[];
  const tickets = (ticketsRes.data ?? []) as any[];

  const activeSprint = sprints.find(s => s.status !== 'completed') ?? sprints[sprints.length - 1];
  const completedSprints = sprints.filter(s => s.status === 'completed');
  const doneTickets = tickets.filter(t => t.board_column === 'done' || t.status === 'completed');
  const today = new Date().toISOString().split('T')[0];

  const completedSprintsList = completedSprints.length > 0
    ? completedSprints.map(s => `- **${s.name}**: ${s.goal ?? 'No goal set'}`).join('\n')
    : '- None yet';

  const agentList = agents.length > 0
    ? agents.map(a => `- **${a.name}** — ${a.role} (${a.status ?? 'idle'})`).join('\n')
    : '- No agents hired';

  const content = `---
tags: [company, summary]
date: ${today}
status: active
---

# ${c.name} — Project Summary

## Status
- Current Sprint: ${activeSprint?.name ?? 'None'}
- Agents: ${agents.length}
- Tickets: ${doneTickets.length}/${tickets.length}

## Completed Sprints
${completedSprintsList}

## Active Agents
${agentList}
`;

  const summaryPath = path.join(companyDir, 'summary.md');
  fs.writeFileSync(summaryPath, content, 'utf8');
  return summaryPath;
}

export async function initAgentBrain(companyId: string, agentId: string): Promise<string> {
  const [companyRes, agentRes] = await Promise.all([
    supabase.from('companies').select('name').eq('id', companyId).single(),
    supabase.from('agents').select('*').eq('id', agentId).single(),
  ]);
  if (!companyRes.data) throw new Error('Company not found');
  if (!agentRes.data) throw new Error('Agent not found');

  const company = companyRes.data as any;
  const agent = agentRes.data as any;

  const companySlug = slugify(company.name);
  const agentSlug = slugify(agent.name);
  const agentDir = path.join(BRAIN_ROOT, companySlug, agentSlug);
  fs.mkdirSync(agentDir, { recursive: true });

  const today = new Date().toISOString().split('T')[0];

  const [agentsRes, sprintsRes] = await Promise.all([
    supabase.from('agents').select('name, role').eq('company_id', companyId),
    supabase.from('sprints').select('name, goal, status').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1),
  ]);
  const teammates = (agentsRes.data ?? []) as any[];
  const currentSprint = ((sprintsRes.data ?? []) as any[])[0];

  const soulContent = `---
tags: [agent, soul]
date: ${today}
status: active
---

# ${agent.name} — ${agent.role}

## System Prompt
${agent.system_prompt ?? 'No system prompt defined.'}

## Skills
${(agent.skills ?? []).map((s: string) => `- ${s}`).join('\n') || '- None'}

## Configuration
- Model: ${agent.runtime_config?.model ?? 'default'}
- Budget Limit: $${agent.budget_limit ?? 10}
- Runtime: ${agent.runtime_type ?? 'claude_sdk'}
`;

  const teamList = teammates
    .filter(t => t.name !== agent.name)
    .map(t => `- **${t.name}** — ${t.role}`)
    .join('\n') || '- Solo agent';

  const contextContent = `---
tags: [agent, context]
date: ${today}
status: active
---

# ${agent.name} — Current Context

## Assignment
- Current Task: ${agent.assigned_task ?? 'None'}
- Status: ${agent.status ?? 'idle'}

## Sprint
- Sprint: ${currentSprint?.name ?? 'None'}
- Goal: ${currentSprint?.goal ?? 'N/A'}

## Team
${teamList}
`;

  const memoryContent = `---
tags: [agent, memory]
date: ${today}
status: active
---

# ${agent.name} — Task Memory

_Ticket summaries will be appended here as work is completed._

## Completed Tasks
`;

  fs.writeFileSync(path.join(agentDir, 'soul.md'), soulContent, 'utf8');
  fs.writeFileSync(path.join(agentDir, 'context.md'), contextContent, 'utf8');
  fs.writeFileSync(path.join(agentDir, 'memory.md'), memoryContent, 'utf8');

  return agentDir;
}

export async function updateAgentMemory(companyId: string, agentId: string, ticketTitle: string): Promise<void> {
  try {
    const [companyRes, agentRes] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('agents').select('name').eq('id', agentId).single(),
    ]);
    if (!companyRes.data || !agentRes.data) return;

    const companySlug = slugify((companyRes.data as any).name);
    const agentSlug = slugify((agentRes.data as any).name);
    const memoryPath = path.join(BRAIN_ROOT, companySlug, agentSlug, 'memory.md');

    if (!fs.existsSync(memoryPath)) {
      await initAgentBrain(companyId, agentId);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `\n- [${timestamp}] Completed: ${ticketTitle}`;
    fs.appendFileSync(memoryPath, entry, 'utf8');
  } catch (err: any) {
    console.error('[updateAgentMemory] Error:', err.message);
  }
}

export async function persistPlanToBrain(companyId: string, sessionId: string): Promise<void> {
  try {
    const [companyRes, sessionRes] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('planning_sessions').select('directive, project_size, cost_usd, created_at').eq('id', sessionId).single(),
    ]);
    if (!companyRes.data || !sessionRes.data) return;

    const companySlug = slugify((companyRes.data as any).name);
    const session = sessionRes.data as any;
    const planDir = path.join(BRAIN_ROOT, companySlug, 'plans', sessionId.slice(0, 8));
    fs.mkdirSync(planDir, { recursive: true });

    const { data: tabs } = await supabase.from('planning_tabs')
      .select('tab_key, title, content, status').eq('session_id', sessionId).order('sort_order');

    const today = new Date().toISOString().split('T')[0];

    for (const tab of (tabs ?? []) as any[]) {
      if (tab.status === 'skipped' || !tab.content) continue;
      const content = `---
tags: [plan, ${tab.tab_key}]
date: ${today}
status: active
---

# ${tab.title}

> Directive: "${session.directive}"
> Size: ${session.project_size} | Cost: $${session.cost_usd?.toFixed(4) ?? '0'}

${tab.content}
`;
      fs.writeFileSync(path.join(planDir, `${tab.tab_key}.md`), content, 'utf8');
    }

    const indexContent = `---
tags: [plan, index]
date: ${today}
status: active
---

# Planning Session — ${session.directive.slice(0, 80)}

- **Date**: ${session.created_at}
- **Size**: ${session.project_size}
- **Cost**: $${session.cost_usd?.toFixed(4) ?? '0'}

## Documents
${(tabs ?? []).filter((t: any) => t.status !== 'skipped').map((t: any) => `- [[${t.tab_key}|${t.title}]]`).join('\n')}
`;
    fs.writeFileSync(path.join(planDir, '00-index.md'), indexContent, 'utf8');
    console.log(`[brain] Persisted planning session ${sessionId.slice(0, 8)} to ${planDir}`);
  } catch (err: any) {
    console.error('[persistPlanToBrain] Error:', err.message);
  }
}

export async function persistDependencyGraph(companyId: string, sprintName: string): Promise<void> {
  try {
    const [companyRes, depsRes, ticketsRes] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('ticket_dependencies').select('*').eq('status', 'pending').or(`status.eq.satisfied`),
      supabase.from('tickets').select('id, title, agent_id').eq('company_id', companyId),
    ]);
    if (!companyRes.data) return;

    const companySlug = slugify((companyRes.data as any).name);
    const sprintSlug = slugify(sprintName);
    const sprintDir = path.join(BRAIN_ROOT, companySlug, 'sprints', sprintSlug);
    fs.mkdirSync(sprintDir, { recursive: true });

    const tickets = (ticketsRes.data ?? []) as any[];
    const deps = (depsRes.data ?? []) as any[];
    const ticketMap = new Map(tickets.map((t: any) => [t.id, t.title?.slice(0, 40) ?? t.id.slice(0, 8)]));

    const mermaidLines = ['graph TD'];
    for (const dep of deps) {
      const from = ticketMap.get(dep.blocker_ticket_id) ?? dep.blocker_ticket_id.slice(0, 8);
      const to = ticketMap.get(dep.blocked_ticket_id) ?? dep.blocked_ticket_id.slice(0, 8);
      const fromId = dep.blocker_ticket_id.slice(0, 8);
      const toId = dep.blocked_ticket_id.slice(0, 8);
      const arrow = dep.status === 'satisfied' ? '-->|done|' : '-->';
      mermaidLines.push(`  ${fromId}["${from}"] ${arrow} ${toId}["${to}"]`);
    }

    const today = new Date().toISOString().split('T')[0];
    const content = `---
tags: [sprint, dependencies]
date: ${today}
status: active
---

# Dependency Graph — ${sprintName}

\`\`\`mermaid
${mermaidLines.join('\n')}
\`\`\`
`;
    fs.writeFileSync(path.join(sprintDir, 'dependency-graph.md'), content, 'utf8');
  } catch (err: any) {
    console.error('[persistDependencyGraph] Error:', err.message);
  }
}
