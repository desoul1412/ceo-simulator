import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { executeCeoGoal, executeCeoProjectReview } from './agents/ceo';
import { processNextTask, getQueueStatus } from './taskProcessor';
import { processNextTicket, getTicketQueueStatus } from './ticketProcessor';
import { startHeartbeatDaemon, stopHeartbeatDaemon, isDaemonRunning } from './heartbeatDaemon';
import { listWorktrees } from './worktreeManager';
import { getCompanyCwd, ensureRepo, syncRepo, listRepos } from './repoManager';
import { supabase } from './supabaseAdmin';

const app = express();
const PORT = process.env.PORT || 3001;

const BRAIN_ROOT = path.join(process.cwd(), 'brain');

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Parse phases from a master plan markdown.
 * Returns array of { title, tasks[] } where tasks are from `- [ ] ...` lines
 * Each phase starts at a `### Phase N: ...` heading.
 */
function parseMasterPlanPhases(content: string): { title: string; tasks: string[] }[] {
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

/**
 * Feature 1: Check if all tickets in a sprint are done, and if so,
 * complete the sprint and create the next one from the master plan.
 */
async function checkSprintCompletion(sprintId: string): Promise<void> {
  try {
    // 1. Get the sprint
    const { data: sprint } = await supabase
      .from('sprints')
      .select('*')
      .eq('id', sprintId)
      .single();
    if (!sprint) return;
    const s = sprint as any;
    if (s.status === 'completed') return; // already done

    // 2. Get all tickets for this sprint
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, status, board_column')
      .eq('sprint_id', sprintId);

    if (!tickets || tickets.length === 0) return;

    // 3. Check if ALL tickets are done/cancelled
    const allDone = (tickets as any[]).every(
      (t) => t.board_column === 'done' || ['completed', 'cancelled'].includes(t.status)
    );
    if (!allDone) return;

    // 4. Mark sprint as completed
    await supabase.from('sprints')
      .update({ status: 'completed' })
      .eq('id', sprintId);

    await supabase.from('activity_log').insert({
      company_id: s.company_id,
      type: 'status-change',
      message: `Sprint "${s.name}" completed — all tickets done`,
    });

    await supabase.from('notifications').insert({
      company_id: s.company_id,
      type: 'system',
      title: `Sprint completed: ${s.name}`,
      message: `All tickets in "${s.name}" are done.`,
      link: `/company/${s.company_id}/board`,
    });

    // 5. Update the company brain summary
    await updateCompanyBrainSummary(s.company_id);

    // 6. Look up master_plan for auto-transition
    const { data: plans } = await supabase
      .from('project_plans')
      .select('*')
      .eq('company_id', s.company_id)
      .eq('type', 'master_plan')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!plans || plans.length === 0) return;
    const masterPlan = plans[0] as any;

    // 7. Parse all phases
    const phases = parseMasterPlanPhases(masterPlan.content);
    if (phases.length === 0) return;

    // 8. Count existing sprints to determine next sprint number
    const { data: existingSprints } = await supabase
      .from('sprints')
      .select('id, name')
      .eq('company_id', s.company_id)
      .order('created_at', { ascending: true });

    const nextSprintNumber = (existingSprints ?? []).length + 1;

    // 9. Find the next unprocessed phase
    // Existing sprints consumed phases 0..N-1, so next phase index = existingSprints.length - 1 + 1
    // But we just completed one, so the count includes it. Next phase = existingSprints.length (0-indexed)
    const nextPhaseIndex = (existingSprints ?? []).length; // already includes the just-completed sprint
    if (nextPhaseIndex >= phases.length) {
      // All phases done
      await supabase.from('notifications').insert({
        company_id: s.company_id,
        type: 'system',
        title: 'All master plan phases completed',
        message: `All ${phases.length} phases from the master plan have been completed.`,
        link: `/company/${s.company_id}/overview`,
      });
      return;
    }

    const nextPhase = phases[nextPhaseIndex];

    // 10. Create new sprint
    const { data: newSprint } = await supabase.from('sprints').insert({
      company_id: s.company_id,
      name: `Sprint ${nextSprintNumber}`,
      goal: nextPhase.title,
      status: 'planning',
    } as any).select().single();

    if (!newSprint) return;

    // 11. Create tickets from the phase's tasks
    const { data: agents } = await supabase.from('agents')
      .select('id, role').eq('company_id', s.company_id);

    for (let i = 0; i < nextPhase.tasks.length; i++) {
      const taskText = nextPhase.tasks[i];
      const agent = (agents ?? []).find((a: any) => {
        const r = (a.role as string).toLowerCase();
        return taskText.toLowerCase().includes(r);
      }) ?? (agents ?? [])[i % Math.max((agents ?? []).length, 1)];

      await supabase.from('tickets').insert({
        company_id: s.company_id,
        agent_id: (agent as any)?.id ?? null,
        title: taskText,
        status: 'open',
        sprint_id: (newSprint as any).id,
        board_column: 'backlog',
        story_points: 1,
        priority: i,
      } as any);
    }

    // 12. Notify
    await supabase.from('activity_log').insert({
      company_id: s.company_id,
      type: 'status-change',
      message: `Auto-created Sprint ${nextSprintNumber} from master plan phase: ${nextPhase.title}`,
    });

    await supabase.from('notifications').insert({
      company_id: s.company_id,
      type: 'system',
      title: `Sprint ${nextSprintNumber} auto-created`,
      message: `${nextPhase.tasks.length} tickets from "${nextPhase.title}"`,
      link: `/company/${s.company_id}/board`,
    });
  } catch (err: any) {
    console.error('[checkSprintCompletion] Error:', err.message);
  }
}

/**
 * Feature 2: Update the company brain summary file.
 */
async function updateCompanyBrainSummary(companyId: string): Promise<string> {
  // Get company info
  const { data: company } = await supabase
    .from('companies').select('*').eq('id', companyId).single();
  if (!company) throw new Error('Company not found');
  const c = company as any;

  const companySlug = slugify(c.name);
  const companyDir = path.join(BRAIN_ROOT, companySlug);
  fs.mkdirSync(companyDir, { recursive: true });

  // Fetch data in parallel
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

/**
 * Feature 3: Initialize an agent's brain directory.
 */
async function initAgentBrain(companyId: string, agentId: string): Promise<string> {
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

  // Get team members and sprint info
  const [agentsRes, sprintsRes] = await Promise.all([
    supabase.from('agents').select('name, role').eq('company_id', companyId),
    supabase.from('sprints').select('name, goal, status').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1),
  ]);
  const teammates = (agentsRes.data ?? []) as any[];
  const currentSprint = ((sprintsRes.data ?? []) as any[])[0];

  // soul.md
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

  // context.md
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

  // memory.md
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

/**
 * Feature 3: Append a completed ticket summary to the agent's memory.md.
 */
async function updateAgentMemory(companyId: string, agentId: string, ticketTitle: string): Promise<void> {
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
      // Init brain first if it doesn't exist
      await initAgentBrain(companyId, agentId);
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const entry = `\n- [${timestamp}] Completed: ${ticketTitle}`;
    fs.appendFileSync(memoryPath, entry, 'utf8');
  } catch (err: any) {
    console.error('[updateAgentMemory] Error:', err.message);
  }
}

app.use(cors({
  origin: [
    /^http:\/\/localhost:\d+$/,  // Any localhost port (Vite dev server)
    /\.vercel\.app$/,            // Vercel deployments
  ],
}));
app.use(express.json());

// ── Health Check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      agentSdk: true,
    },
  });
});

// ── Assign Goal to CEO ───────────────────────────────────────────────────────

app.post('/api/assign-goal', async (req, res) => {
  const { companyId, goal } = req.body;

  if (!companyId || !goal) {
    return res.status(400).json({ error: 'Missing companyId or goal' });
  }

  try {
    // Activity logger — writes to Supabase activity_log
    const logActivity = async (message: string) => {
      await supabase.from('activity_log').insert({
        company_id: companyId,
        type: 'ceo-reasoning',
        message,
      });
    };

    // Get the project working directory for THIS company's repo
    const cwd = await getCompanyCwd(companyId);

    const result = await executeCeoGoal(companyId, goal, cwd, logActivity);

    res.json({
      success: true,
      plan: result.plan,
      cost: {
        usd: result.costUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
      sessionId: result.sessionId,
    });
  } catch (err: any) {
    console.error('[assign-goal] Error:', err.message);

    // Log failure
    await supabase.from('activity_log').insert({
      company_id: companyId,
      type: 'status-change',
      message: `CEO goal assignment failed: ${err.message}`,
    });

    res.status(500).json({ error: err.message });
  }
});

// ── CEO Project Review (structured plan generation) ──────────────────────────

app.post('/api/companies/:id/review', async (req, res) => {
  try {
    const cwd = await getCompanyCwd(req.params.id);
    const { requirements } = req.body ?? {};
    const logActivity = async (message: string) => {
      await supabase.from('activity_log').insert({
        company_id: req.params.id, type: 'ceo-reasoning', message,
      });
    };
    const result = await executeCeoProjectReview(req.params.id, cwd, logActivity, requirements);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[review] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get Task Queue Status ────────────────────────────────────────────────────

app.get('/api/tasks/:companyId', async (req, res) => {
  const { data, error } = await supabase
    .from('task_queue')
    .select('*')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Get Token Usage ──────────────────────────────────────────────────────────

app.get('/api/costs/:companyId', async (req, res) => {
  const { data, error } = await supabase
    .from('token_usage')
    .select('*')
    .eq('company_id', req.params.companyId)
    .order('invoked_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });

  const total = (data ?? []).reduce((sum: number, r: any) => sum + (r.cost_usd ?? 0), 0);
  res.json({ entries: data, totalCostUsd: total });
});

// ── Process Task Queue ───────────────────────────────────────────────────────

app.post('/api/process-queue', async (req, res) => {
  try {
    const companyId = req.body?.companyId;
    const cwd = companyId ? await getCompanyCwd(companyId) : process.cwd();
    const result = await processNextTask(cwd);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Queue Status ─────────────────────────────────────────────────────────────

app.get('/api/queue-status/:companyId', async (req, res) => {
  try {
    const status = await getQueueStatus(req.params.companyId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Worktrees ────────────────────────────────────────────────────────────────

app.get('/api/worktrees', (_req, res) => {
  const worktrees = listWorktrees(process.cwd());
  res.json({ worktrees });
});

// ── Hire Agent ───────────────────────────────────────────────────────────────

const AUTO_NAMES: Record<string, string[]> = {
  PM:       ['Sam Patel', 'Rin Tanaka', 'Alex Duval', 'Priya Kapoor', 'Liam Chen'],
  DevOps:   ['Kai Müller', 'Zara Osei', 'Jin Zhao', 'Noor Ali', 'Yuki Sato'],
  Frontend: ['Mia Torres', 'Dev Sharma', 'Luka Pavlov', 'Ava Kim', 'Noah Berg'],
  Backend:  ['Raj Gupta', 'Elena Volkov', 'Tomás Silva', 'Fatima Hassan', 'Oscar Wu'],
  QA:       ['Maya Reyes', 'Chris Ng', 'Ines Moreau', 'Leo Park', 'Aisha Ibrahim'],
  Designer: ['Freya Lin', 'Mateo Ruiz', 'Yuna Choi', 'Oliver Strand', 'Nia Okafor'],
  CEO:      ['Ada Chen', 'Leo Voss', 'Sofia Bianchi'],
};

const ROLE_COLORS: Record<string, string> = {
  CEO: '#00ffff', PM: '#c084fc', DevOps: '#00ff88', Frontend: '#ff8800',
  Backend: '#3b82f6', QA: '#ef4444', Designer: '#f59e0b',
};

const ROLE_SPRITES: Record<string, number> = {
  CEO: 0, PM: 1, DevOps: 2, Frontend: 3, Backend: 4, QA: 5, Designer: 5,
};

const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  PM: 'You are a Project Manager. Break down requirements into user stories, write specs, define acceptance criteria.',
  DevOps: 'You are a DevOps Engineer. Set up infrastructure, CI/CD, Docker, deployment scripts, monitoring.',
  Frontend: 'You are a Frontend Developer. Build React components with TypeScript, Tailwind CSS, and vitest tests.',
  Backend: 'You are a Backend Developer. Build API endpoints, database schemas, server-side logic, integration tests.',
  QA: 'You are a QA Engineer. Write test suites, identify bugs, verify acceptance criteria, report coverage.',
  Designer: 'You are a UI/UX Designer. Create design specs, color schemes, component mockups, CSS examples.',
};

const DEFAULT_SKILLS: Record<string, string[]> = {
  PM: ['Requirements', 'Documentation', 'User Stories'],
  DevOps: ['CI/CD', 'Docker', 'Infrastructure'],
  Frontend: ['React', 'TypeScript', 'CSS/Tailwind'],
  Backend: ['API Design', 'Database', 'TypeScript'],
  QA: ['Testing', 'Automation', 'Bug Triage'],
  Designer: ['UI Design', 'Design Systems', 'CSS/Tailwind'],
};

app.post('/api/hire-agent', async (req, res) => {
  const { companyId, mode, role, name, systemPrompt, skills, monthlyCost, model, runtimeType, runtimeConfig, budgetLimit } = req.body;

  if (!companyId || !role) {
    return res.status(400).json({ error: 'Missing companyId or role' });
  }

  try {
    // Get existing agents to find CEO and next desk position
    const { data: existingAgents } = await supabase
      .from('agents')
      .select('id, role, tile_col, tile_row')
      .eq('company_id', companyId);

    const ceo = (existingAgents ?? []).find((a: any) => a.role === 'CEO');

    // Auto-generate name if not provided
    const agentName = name || (() => {
      const pool = AUTO_NAMES[role] ?? AUTO_NAMES.Frontend;
      const usedNames = (existingAgents ?? []).map((a: any) => a.name);
      return pool.find(n => !usedNames.includes(n)) ?? `Agent ${Math.floor(Math.random() * 900 + 100)}`;
    })();

    // Pick desk position (spread agents across office)
    const DESK_POSITIONS = [
      { col: 3, row: 13 }, { col: 7, row: 13 }, { col: 5, row: 17 },
      { col: 5, row: 19 }, { col: 9, row: 13 }, { col: 11, row: 13 },
      { col: 9, row: 17 }, { col: 11, row: 17 }, { col: 13, row: 13 },
    ];
    const usedPositions = new Set((existingAgents ?? []).map((a: any) => `${a.tile_col},${a.tile_row}`));
    const desk = DESK_POSITIONS.find(p => !usedPositions.has(`${p.col},${p.row}`)) ?? { col: 5, row: 15 };

    // Insert agent
    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({
        company_id: companyId,
        name: agentName,
        role,
        color: ROLE_COLORS[role] ?? '#6a7a90',
        sprite_index: ROLE_SPRITES[role] ?? 0,
        tile_col: desk.col,
        tile_row: desk.row,
        monthly_cost: monthlyCost ?? 5000,
        reports_to: ceo?.id ?? null,
        system_prompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPTS[role] ?? `You are a ${role}.`,
        skills: skills ?? DEFAULT_SKILLS[role] ?? [],
        memory: {},
        runtime_type: runtimeType ?? 'claude_sdk',
        runtime_config: runtimeConfig ?? (model ? { model } : {}),
        budget_limit: budgetLimit ?? 10.00,
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from('activity_log').insert({
      company_id: companyId,
      agent_id: (newAgent as any).id,
      type: 'agent-hired',
      message: `${agentName} hired as ${role}${mode === 'auto' ? ' (auto)' : ''}`,
    });

    // Hook: auto-init agent brain directory
    initAgentBrain(companyId, (newAgent as any).id).catch(e =>
      console.error('[hire-agent-hook] brain init error:', e.message)
    );

    res.json({ success: true, agent: newAgent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fire Agent ───────────────────────────────────────────────────────────────

app.delete('/api/agents/:agentId', async (req, res) => {
  try {
    const { data: agent } = await supabase
      .from('agents')
      .select('name, role, company_id')
      .eq('id', req.params.agentId)
      .single();

    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Nullify agent references on tickets (preserve ticket history)
    await supabase.from('tickets').update({ agent_id: null }).eq('agent_id', req.params.agentId);
    await supabase.from('merge_requests').update({ agent_id: null }).eq('agent_id', req.params.agentId);
    // Delete agent sessions + token usage
    await supabase.from('token_usage').delete().eq('agent_id', req.params.agentId);
    await supabase.from('agent_sessions').delete().eq('agent_id', req.params.agentId);
    // Delete the agent
    await supabase.from('agents').delete().eq('id', req.params.agentId);

    await supabase.from('activity_log').insert({
      company_id: (agent as any).company_id,
      type: 'agent-fired',
      message: `${(agent as any).name} (${(agent as any).role}) was let go`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Configs CRUD (three-level: global → company → agent) ─────────────────────

// List configs by scope + type
app.get('/api/configs', async (req, res) => {
  const { scope, scope_id, type } = req.query;
  let query = supabase.from('configs').select('*').order('created_at', { ascending: true });
  if (scope) query = query.eq('scope', scope);
  if (scope_id) query = query.eq('scope_id', scope_id);
  if (type) query = query.eq('type', type);
  // For global scope, scope_id is null
  if (scope === 'global') query = query.is('scope_id', null);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get effective config for an agent (merged global → company → agent)
app.get('/api/configs/effective/:agentId', async (req, res) => {
  const { data: agent } = await supabase
    .from('agents')
    .select('id, company_id')
    .eq('id', req.params.agentId)
    .single();

  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const a = agent as any;

  // Fetch all three levels
  const [globalRes, companyRes, agentRes] = await Promise.all([
    supabase.from('configs').select('*').eq('scope', 'global').is('scope_id', null),
    supabase.from('configs').select('*').eq('scope', 'company').eq('scope_id', a.company_id),
    supabase.from('configs').select('*').eq('scope', 'agent').eq('scope_id', a.id),
  ]);

  // Merge: agent overrides company overrides global (by key)
  const merged = new Map<string, any>();
  for (const row of (globalRes.data ?? []) as any[]) {
    if (row.enabled) merged.set(`${row.type}:${row.key}`, row);
  }
  for (const row of (companyRes.data ?? []) as any[]) {
    if (row.enabled) merged.set(`${row.type}:${row.key}`, row);
    else merged.delete(`${row.type}:${row.key}`); // disabled at company level removes global
  }
  for (const row of (agentRes.data ?? []) as any[]) {
    if (row.enabled) merged.set(`${row.type}:${row.key}`, row);
    else merged.delete(`${row.type}:${row.key}`);
  }

  res.json(Array.from(merged.values()));
});

// Create config
app.post('/api/configs', async (req, res) => {
  const { scope, scope_id, type, key, value, enabled } = req.body;
  if (!scope || !type || !key) {
    return res.status(400).json({ error: 'Missing scope, type, or key' });
  }

  const { data, error } = await supabase
    .from('configs')
    .insert({
      scope,
      scope_id: scope === 'global' ? null : scope_id,
      type,
      key,
      value: value ?? {},
      enabled: enabled ?? true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update config
app.patch('/api/configs/:id', async (req, res) => {
  const updates: any = {};
  if (req.body.value !== undefined) updates.value = req.body.value;
  if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
  if (req.body.key !== undefined) updates.key = req.body.key;

  const { data, error } = await supabase
    .from('configs')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete config
app.delete('/api/configs/:id', async (req, res) => {
  const { error } = await supabase.from('configs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Repository Management ────────────────────────────────────────────────────

// Connect a company to a Git repo
app.post('/api/companies/:companyId/repo', async (req, res) => {
  const { repoUrl, branch, authMethod, token } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repoUrl' });

  try {
    await supabase.from('companies').update({
      repo_url: repoUrl,
      repo_branch: branch || 'main',
      git_auth_method: authMethod || (token ? 'pat' : 'none'),
      git_token_encrypted: token || null,
      repo_status: 'not_connected',
    }).eq('id', req.params.companyId);

    // Clone immediately
    const repoPath = await ensureRepo(req.params.companyId);

    await supabase.from('activity_log').insert({
      company_id: req.params.companyId,
      type: 'status-change',
      message: `Connected to repo: ${repoUrl} (branch: ${branch || 'main'})`,
    });

    res.json({ success: true, repoPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync (pull latest) a company's repo
app.post('/api/companies/:companyId/repo/sync', async (req, res) => {
  const result = await syncRepo(req.params.companyId);
  res.json(result);
});

// Get repo status for a company
app.get('/api/companies/:companyId/repo', async (req, res) => {
  const { data } = await supabase
    .from('companies')
    .select('repo_url, repo_branch, repo_path, repo_status, repo_error, repo_last_synced_at, git_auth_method')
    .eq('id', req.params.companyId)
    .single();
  res.json(data ?? {});
});

// Disconnect repo
app.delete('/api/companies/:companyId/repo', async (req, res) => {
  await supabase.from('companies').update({
    repo_url: null,
    repo_branch: 'main',
    repo_path: null,
    git_auth_method: 'none',
    git_token_encrypted: null,
    repo_status: 'not_connected',
    repo_error: null,
  }).eq('id', req.params.companyId);
  res.json({ success: true });
});

// List all managed repos
app.get('/api/repos', (_req, res) => {
  res.json(listRepos());
});

// ── Tickets ──────────────────────────────────────────────────────────────────

app.get('/api/tickets/:companyId', async (req, res) => {
  const { data, error } = await supabase
    .from('tickets')
    .select('*, ticket_comments(id, author_type, content, created_at)')
    .eq('company_id', req.params.companyId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/ticket-status/:companyId', async (req, res) => {
  const status = await getTicketQueueStatus(req.params.companyId);
  res.json(status);
});

// ── Approval Gates ───────────────────────────────────────────────────────────

app.post('/api/approve/:ticketId', async (req, res) => {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: 'approved',
      approved_by: req.body.approvedBy ?? 'CEO (human)',
      approved_at: new Date().toISOString(),
    })
    .eq('id', req.params.ticketId)
    .eq('status', 'awaiting_approval')
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: 'Ticket not found or not awaiting approval' });

  // Add comment
  await supabase.from('ticket_comments').insert({
    ticket_id: req.params.ticketId,
    author_type: 'human',
    content: `Approved by ${req.body.approvedBy ?? 'CEO (human)'}`,
  });

  // Update agent status
  const t = data as any;
  if (t.agent_id) {
    await supabase.from('agents').update({
      status: 'working',
      assigned_task: t.title,
    }).eq('id', t.agent_id);
  }

  await supabase.from('audit_log').insert({
    company_id: t.company_id,
    agent_id: t.agent_id,
    ticket_id: t.id,
    event_type: 'approval',
    message: `Ticket approved: "${t.title}"`,
  });

  res.json({ success: true, ticket: data });
});

app.post('/api/reject/:ticketId', async (req, res) => {
  const { data, error } = await supabase
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('id', req.params.ticketId)
    .select()
    .single();

  if (error || !data) return res.status(404).json({ error: 'Ticket not found' });

  await supabase.from('ticket_comments').insert({
    ticket_id: req.params.ticketId,
    author_type: 'human',
    content: `Rejected: ${req.body.reason ?? 'No reason given'}`,
  });

  res.json({ success: true });
});

// Approve all pending tickets for a company
app.post('/api/approve-all/:companyId', async (req, res) => {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: 'approved',
      approved_by: 'CEO (human) — bulk',
      approved_at: new Date().toISOString(),
    })
    .eq('company_id', req.params.companyId)
    .eq('status', 'awaiting_approval')
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Update all agents
  for (const t of (data ?? []) as any[]) {
    if (t.agent_id) {
      await supabase.from('agents').update({
        status: 'working',
        assigned_task: t.title,
      }).eq('id', t.agent_id);
    }
  }

  res.json({ success: true, approved: (data ?? []).length });
});

// ── Runtime Skill Injection ───────────────────────────────────────────────────

app.post('/api/agents/:agentId/inject-skill', async (req, res) => {
  const { skill } = req.body;
  if (!skill) return res.status(400).json({ error: 'Missing skill name' });

  const { data: agent } = await supabase
    .from('agents').select('skills, memory').eq('id', req.params.agentId).single();
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const a = agent as any;
  const skills = [...new Set([...(a.skills ?? []), skill])];
  const memory = { ...(a.memory ?? {}), shortTerm: [...(a.memory?.shortTerm ?? []), `Skill injected: ${skill}`].slice(-10) };

  await supabase.from('agents').update({ skills, memory }).eq('id', req.params.agentId);

  await supabase.from('audit_log').insert({
    company_id: null,
    agent_id: req.params.agentId,
    event_type: 'system',
    message: `Skill injected at runtime: ${skill}`,
  });

  res.json({ success: true, skills });
});

// ── Agent Update (name, budget, system_prompt) ──────────────────────────────

app.patch('/api/agents/:agentId', async (req, res) => {
  const allowed = ['name', 'system_prompt', 'budget_limit', 'skills', 'role'];
  const updates: any = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  const { data, error } = await supabase
    .from('agents').update(updates).eq('id', req.params.agentId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Agent Lifecycle ──────────────────────────────────────────────────────────

app.patch('/api/agents/:agentId/lifecycle', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused', 'throttled', 'terminated'].includes(status)) {
    return res.status(400).json({ error: 'Invalid lifecycle status' });
  }

  const { data, error } = await supabase
    .from('agents')
    .update({ lifecycle_status: status })
    .eq('id', req.params.agentId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_log').insert({
    company_id: (data as any).company_id,
    agent_id: req.params.agentId,
    event_type: 'status_change',
    message: `Agent lifecycle changed to: ${status}`,
  });

  res.json(data);
});

// Update per-agent budget
app.patch('/api/agents/:agentId/budget', async (req, res) => {
  const { budget_limit } = req.body;
  const { data, error } = await supabase
    .from('agents')
    .update({ budget_limit, lifecycle_status: 'active' }) // unthrottle on budget increase
    .eq('id', req.params.agentId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Heartbeat Daemon Control ─────────────────────────────────────────────────

app.post('/api/daemon/start', (_req, res) => {
  startHeartbeatDaemon(process.cwd());
  res.json({ running: true });
});

app.post('/api/daemon/stop', (_req, res) => {
  stopHeartbeatDaemon();
  res.json({ running: false });
});

app.get('/api/daemon/status', (_req, res) => {
  res.json({ running: isDaemonRunning() });
});

// ── Merge Requests ──────────────────────────────────────────────────────────

app.get('/api/companies/:id/merge-requests', async (req, res) => {
  const { data, error } = await supabase
    .from('merge_requests')
    .select('*')
    .eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/merge-requests/:id/merge', async (req, res) => {
  try {
    const { data: mr } = await supabase
      .from('merge_requests')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!mr) return res.status(404).json({ error: 'MR not found' });
    const m = mr as any;

    // Attempt git merge in the company repo
    const cwd = await getCompanyCwd(m.company_id);
    const { execSync } = await import('child_process');
    try {
      execSync(`git merge ${m.branch_name} --no-ff -m "Merge ${m.branch_name}"`, { cwd, stdio: 'pipe' });
    } catch (mergeErr: any) {
      return res.status(409).json({ error: `Merge conflict: ${mergeErr.message}` });
    }

    await supabase.from('merge_requests').update({ status: 'merged', merged_at: new Date().toISOString() }).eq('id', req.params.id);
    await supabase.from('notifications').insert({
      company_id: m.company_id,
      type: 'merge_request',
      title: `MR merged: ${m.branch_name}`,
      message: `Branch ${m.branch_name} merged to ${m.target_branch}`,
      link: `/company/${m.company_id}/board`,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/merge-requests/:id/reject', async (req, res) => {
  const { error } = await supabase
    .from('merge_requests')
    .update({ status: 'rejected' })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/merge-requests/:id/revert', async (req, res) => {
  try {
    const { data: mr } = await supabase
      .from('merge_requests').select('*').eq('id', req.params.id).single();
    if (!mr) return res.status(404).json({ error: 'MR not found' });
    const m = mr as any;
    if (m.status !== 'merged') return res.status(400).json({ error: 'Can only revert merged MRs' });

    const cwd = await getCompanyCwd(m.company_id);
    const { execSync } = await import('child_process');

    // Find the merge commit and revert it
    try {
      // Get the merge commit hash
      const mergeLog = execSync(
        `git log --oneline --all --grep="Merge ${m.branch_name}" -1`,
        { cwd, encoding: 'utf8' }
      ).trim();
      const mergeHash = mergeLog.split(' ')[0];

      if (mergeHash) {
        execSync(`git revert --no-edit ${mergeHash}`, { cwd, stdio: 'pipe' });
      } else {
        // Fallback: revert the branch tip
        execSync(`git revert --no-edit HEAD`, { cwd, stdio: 'pipe' });
      }

      // Update MR status
      await supabase.from('merge_requests').update({
        status: 'rejected',
        diff_summary: `Reverted at ${new Date().toISOString()}`,
      }).eq('id', req.params.id);

      await supabase.from('notifications').insert({
        company_id: m.company_id,
        type: 'merge_request',
        title: `Reverted: ${m.branch_name}`,
        message: `MR "${m.title}" was reverted on main.`,
        link: `/company/${m.company_id}/merge-requests`,
      });

      await supabase.from('activity_log').insert({
        company_id: m.company_id,
        type: 'status-change',
        message: `Reverted merge: ${m.branch_name} (${m.title})`,
      });

      res.json({ success: true });
    } catch (revertErr: any) {
      res.status(409).json({ error: `Revert failed: ${revertErr.message}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/merge-requests/:id/diff', async (req, res) => {
  try {
    const { data: mr } = await supabase
      .from('merge_requests')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (!mr) return res.status(404).json({ error: 'MR not found' });
    const m = mr as any;

    const cwd = await getCompanyCwd(m.company_id);
    const { execSync } = await import('child_process');
    let diff = '';
    try {
      diff = execSync(`git diff ${m.target_branch}...${m.branch_name} --stat`, { cwd, encoding: 'utf8' });
    } catch { /* branch may not exist locally */ }
    res.json({ diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sprints ─────────────────────────────────────────────────────────────────

app.get('/api/companies/:id/sprints', async (req, res) => {
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('company_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/companies/:id/sprints', async (req, res) => {
  const { name, goal, start_date, end_date } = req.body;
  const { data, error } = await supabase
    .from('sprints')
    .insert({ company_id: req.params.id, name, goal, start_date, end_date })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/sprints/:id', async (req, res) => {
  const updates: any = {};
  for (const key of ['name', 'goal', 'start_date', 'end_date', 'status']) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase
    .from('sprints')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/sprints/:id/tickets', async (req, res) => {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('sprint_id', req.params.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Project Plans ───────────────────────────────────────────────────────────

app.get('/api/companies/:id/plans', async (req, res) => {
  let query = supabase.from('project_plans').select('*').eq('company_id', req.params.id);
  if (req.query.type) query = query.eq('type', req.query.type as string);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/companies/:id/plans', async (req, res) => {
  const { type, title, content } = req.body;
  const { data, error } = await supabase
    .from('project_plans')
    .insert({ company_id: req.params.id, type, title, content })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/plans/:id', async (req, res) => {
  const { content, title } = req.body;
  const updates: any = {};
  if (content !== undefined) updates.content = content;
  if (title !== undefined) updates.title = title;
  const { data, error } = await supabase
    .from('project_plans')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/plans/:id/approve', async (req, res) => {
  const { data: plan, error } = await supabase
    .from('project_plans')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  const p = plan as any;

  await supabase.from('notifications').insert({
    company_id: p.company_id,
    type: 'plan_submitted',
    title: `Plan approved: ${p.title}`,
    message: `${p.type} plan "${p.title}" was approved`,
    link: `/company/${p.company_id}/overview`,
  });

  // ── Autonomous execution triggers based on plan type ──────────────────
  try {
    if (p.type === 'hiring_plan') {
      // Parse hiring plan table and auto-hire agents
      const lines = (p.content as string).split('\n').filter((l: string) => l.startsWith('|') && !l.includes('---') && !l.toLowerCase().includes('role'));
      for (const line of lines) {
        const cols = line.split('|').map((c: string) => c.trim()).filter(Boolean);
        if (cols.length >= 2) {
          const role = cols[0];
          const model = cols[1] || 'sonnet';
          const budgetStr = cols[2] || '$10';
          const budget = parseFloat(budgetStr.replace('$', '')) || 10;

          // Check if this role already exists for this company
          const { data: existing } = await supabase
            .from('agents').select('id').eq('company_id', p.company_id).eq('role', role);
          if (existing?.length) continue; // already hired

          // Auto-hire via the existing hire logic
          const namePool = AUTO_NAMES[role] ?? ['Agent'];
          const agentName = namePool[Math.floor(Math.random() * namePool.length)];
          const color = ROLE_COLORS[role] ?? '#6a7a90';
          const sprite = ROLE_SPRITES[role] ?? 0;
          const prompt = DEFAULT_SYSTEM_PROMPTS[role] ?? `You are a ${role}.`;
          const skills = DEFAULT_SKILLS[role] ?? [];

          const DESK_POSITIONS = [
            { col: 4, row: 3 }, { col: 18, row: 3 }, { col: 4, row: 14 },
            { col: 9, row: 3 }, { col: 24, row: 3 }, { col: 9, row: 14 },
            { col: 13, row: 3 }, { col: 13, row: 14 }, { col: 18, row: 14 },
          ];
          const { data: allAgents } = await supabase.from('agents').select('tile_col, tile_row').eq('company_id', p.company_id);
          const used = new Set((allAgents ?? []).map((a: any) => `${a.tile_col},${a.tile_row}`));
          const desk = DESK_POSITIONS.find(d => !used.has(`${d.col},${d.row}`)) ?? { col: 5, row: 15 };

          const ceo = (allAgents as any[])?.find?.((a: any) => a.role === 'CEO');

          const { data: hiredAgent } = await supabase.from('agents').insert({
            company_id: p.company_id, name: agentName, role, color,
            sprite_index: sprite, tile_col: desk.col, tile_row: desk.row,
            system_prompt: prompt, skills, budget_limit: budget,
            reports_to: ceo?.id ?? null, memory: {},
          } as any).select().single();

          await supabase.from('activity_log').insert({
            company_id: p.company_id, type: 'agent-hired',
            message: `Auto-hired ${agentName} as ${role} (from approved hiring plan)`,
          });

          // Hook: auto-init agent brain directory
          if (hiredAgent) {
            initAgentBrain(p.company_id, (hiredAgent as any).id).catch(e =>
              console.error('[plan-hire-hook] brain init error:', e.message)
            );
          }
        }
      }

      await supabase.from('notifications').insert({
        company_id: p.company_id, type: 'system',
        title: 'Agents hired from plan',
        message: 'Hiring plan approved — agents auto-hired.',
        link: `/company/${p.company_id}/agents`,
      });
    }

    if (p.type === 'master_plan') {
      // Parse phases into a sprint + tickets
      const phases = (p.content as string).match(/###\s+(.+)/g) ?? [];
      const tasks = (p.content as string).match(/- \[ \]\s+(.+)/g) ?? [];

      if (phases.length > 0 || tasks.length > 0) {
        // Create Sprint 1
        const { data: sprint } = await supabase.from('sprints').insert({
          company_id: p.company_id,
          name: 'Sprint 1',
          goal: phases[0]?.replace('### ', '') ?? 'Phase 1',
          status: 'planning',
        } as any).select().single();

        // Create tickets from tasks
        if (sprint && tasks.length > 0) {
          const { data: agents } = await supabase.from('agents')
            .select('id, role').eq('company_id', p.company_id);

          for (let i = 0; i < tasks.length; i++) {
            const taskText = tasks[i].replace(/- \[ \]\s+/, '');
            // Try to match task to an agent role
            const agent = (agents ?? []).find((a: any) => {
              const r = (a.role as string).toLowerCase();
              return taskText.toLowerCase().includes(r);
            }) ?? (agents ?? [])[i % (agents ?? []).length];

            await supabase.from('tickets').insert({
              company_id: p.company_id,
              agent_id: (agent as any)?.id ?? null,
              title: taskText,
              status: 'open',
              sprint_id: (sprint as any).id,
              board_column: 'backlog',
              story_points: 1,
              priority: i,
            } as any);
          }
        }

        await supabase.from('notifications').insert({
          company_id: p.company_id, type: 'system',
          title: 'Sprint created from master plan',
          message: `Sprint 1 created with ${tasks.length} tickets.`,
          link: `/company/${p.company_id}/board`,
        });
      }
    }

    if (p.type === 'daily_plan') {
      // Daily plan approved — notify about pending tickets but do NOT auto-approve them
      // Human reviews tickets individually from the Board or Approval Panel
      const { data: pendingTickets } = await supabase.from('tickets')
        .select('id')
        .eq('company_id', p.company_id)
        .in('status', ['open', 'awaiting_approval']);

      await supabase.from('notifications').insert({
        company_id: p.company_id, type: 'ticket_approval',
        title: 'Daily plan approved — review tickets',
        message: `${(pendingTickets ?? []).length} tickets awaiting your review on the Board.`,
        link: `/company/${p.company_id}/board`,
      });
    }
  } catch (execErr: any) {
    console.error('[approve] Execution trigger error:', execErr.message);
  }

  res.json(plan);
});

app.post('/api/plans/:id/comments', async (req, res) => {
  const { content, author } = req.body;
  const { data, error } = await supabase
    .from('plan_comments')
    .insert({ plan_id: req.params.id, content, author: author ?? 'CEO' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/plans/:id/comments', async (req, res) => {
  const { data, error } = await supabase
    .from('plan_comments')
    .select('*')
    .eq('plan_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Sprint Manual Completion ────────────────────────────────────────────────

app.post('/api/sprints/:id/complete', async (req, res) => {
  try {
    const { data: sprint } = await supabase
      .from('sprints').select('*').eq('id', req.params.id).single();
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    await checkSprintCompletion(req.params.id);

    // If checkSprintCompletion didn't mark it (not all tickets done), force complete
    const { data: updated } = await supabase
      .from('sprints').select('status').eq('id', req.params.id).single();
    if ((updated as any)?.status !== 'completed') {
      await supabase.from('sprints')
        .update({ status: 'completed' })
        .eq('id', req.params.id);

      const s = sprint as any;
      await supabase.from('activity_log').insert({
        company_id: s.company_id,
        type: 'status-change',
        message: `Sprint "${s.name}" manually completed`,
      });

      await supabase.from('notifications').insert({
        company_id: s.company_id,
        type: 'system',
        title: `Sprint completed: ${s.name}`,
        message: `Sprint "${s.name}" was manually completed.`,
        link: `/company/${s.company_id}/board`,
      });

      // Still trigger auto-transition for next sprint
      // Re-fetch and run the transition logic
      await updateCompanyBrainSummary(s.company_id);

      // Create next sprint from master plan
      const { data: plans } = await supabase
        .from('project_plans')
        .select('*')
        .eq('company_id', s.company_id)
        .eq('type', 'master_plan')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (plans && plans.length > 0) {
        const masterPlan = plans[0] as any;
        const phases = parseMasterPlanPhases(masterPlan.content);

        const { data: existingSprints } = await supabase
          .from('sprints')
          .select('id')
          .eq('company_id', s.company_id);

        const nextSprintNumber = (existingSprints ?? []).length + 1;
        const nextPhaseIndex = (existingSprints ?? []).length;

        if (nextPhaseIndex < phases.length) {
          const nextPhase = phases[nextPhaseIndex];
          const { data: newSprint } = await supabase.from('sprints').insert({
            company_id: s.company_id,
            name: `Sprint ${nextSprintNumber}`,
            goal: nextPhase.title,
            status: 'planning',
          } as any).select().single();

          if (newSprint) {
            const { data: agents } = await supabase.from('agents')
              .select('id, role').eq('company_id', s.company_id);

            for (let i = 0; i < nextPhase.tasks.length; i++) {
              const taskText = nextPhase.tasks[i];
              const agent = (agents ?? []).find((a: any) => {
                const r = (a.role as string).toLowerCase();
                return taskText.toLowerCase().includes(r);
              }) ?? (agents ?? [])[i % Math.max((agents ?? []).length, 1)];

              await supabase.from('tickets').insert({
                company_id: s.company_id,
                agent_id: (agent as any)?.id ?? null,
                title: taskText,
                status: 'open',
                sprint_id: (newSprint as any).id,
                board_column: 'backlog',
                story_points: 1,
                priority: i,
              } as any);
            }

            await supabase.from('notifications').insert({
              company_id: s.company_id,
              type: 'system',
              title: `Sprint ${nextSprintNumber} auto-created`,
              message: `${nextPhase.tasks.length} tickets from "${nextPhase.title}"`,
              link: `/company/${s.company_id}/board`,
            });
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Company Brain Summary ──────────────────────────────────────────────────

app.post('/api/companies/:id/brain/update-summary', async (req, res) => {
  try {
    const summaryPath = await updateCompanyBrainSummary(req.params.id);
    res.json({ success: true, path: summaryPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Agent Brain Init ────────────────────────────────────────────────────────

app.post('/api/companies/:companyId/agents/:agentId/brain/init', async (req, res) => {
  try {
    const agentDir = await initAgentBrain(req.params.companyId, req.params.agentId);
    res.json({ success: true, path: agentDir });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Agent Brain Memory Update ───────────────────────────────────────────────

app.post('/api/companies/:companyId/agents/:agentId/brain/update-memory', async (req, res) => {
  try {
    const { ticketTitle } = req.body;
    if (!ticketTitle) return res.status(400).json({ error: 'Missing ticketTitle' });
    await updateAgentMemory(req.params.companyId, req.params.agentId, ticketTitle);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Notifications ───────────────────────────────────────────────────────────

app.get('/api/notifications', async (_req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/notifications/:id/read', async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/notifications/read-all', async (_req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/notifications/count', async (_req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) return res.status(500).json({ error: error.message });
  // Supabase head: true doesn't return data, use count header
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false);
  res.json({ count: count ?? 0 });
});

// ── Env Vars ────────────────────────────────────────────────────────────────

app.get('/api/companies/:id/env-vars', async (req, res) => {
  const { data, error } = await supabase
    .from('project_env_vars')
    .select('*')
    .eq('company_id', req.params.id)
    .order('key', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  // Mask secret values
  const masked = (data ?? []).map((row: any) => ({
    ...row,
    value: row.is_secret ? '********' : row.value,
  }));
  res.json(masked);
});

app.post('/api/companies/:id/env-vars', async (req, res) => {
  const { key, value, is_secret } = req.body;
  const { data, error } = await supabase
    .from('project_env_vars')
    .insert({ company_id: req.params.id, key, value, is_secret: is_secret ?? false })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/env-vars/:id', async (req, res) => {
  const updates: any = {};
  for (const key of ['key', 'value', 'is_secret']) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase
    .from('project_env_vars')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/env-vars/:id', async (req, res) => {
  const { error } = await supabase.from('project_env_vars').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Ticket Board Column ─────────────────────────────────────────────────────

app.patch('/api/tickets/:id/column', async (req, res) => {
  const { board_column } = req.body;
  if (!board_column) return res.status(400).json({ error: 'Missing board_column' });
  const { data, error } = await supabase
    .from('tickets')
    .update({ board_column })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Hook: check sprint completion + update agent memory when moved to done
  const t = data as any;
  if (board_column === 'done' && t.sprint_id) {
    checkSprintCompletion(t.sprint_id).catch(e => console.error('[column-hook] sprint check error:', e.message));
    if (t.agent_id) {
      updateAgentMemory(t.company_id, t.agent_id, t.title).catch(e => console.error('[column-hook] memory error:', e.message));
    }
  }

  res.json(data);
});

// ── Ticket PATCH & Reject ────────────────────────────────────────────────────

app.patch('/api/tickets/:id', async (req, res) => {
  const allowed = ['title', 'description', 'story_points', 'board_column', 'sprint_id', 'agent_id'];
  const updates: any = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const { data, error } = await supabase.from('tickets').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Hook: check sprint completion + update agent memory when board_column set to done
  const t = data as any;
  if (updates.board_column === 'done' && t.sprint_id) {
    checkSprintCompletion(t.sprint_id).catch(e => console.error('[ticket-patch-hook] sprint check error:', e.message));
    if (t.agent_id) {
      updateAgentMemory(t.company_id, t.agent_id, t.title).catch(e => console.error('[ticket-patch-hook] memory error:', e.message));
    }
  }

  res.json(data);
});

app.post('/api/tickets/:id/reject', async (req, res) => {
  // Get ticket info before updating (for sprint check)
  const { data: ticket } = await supabase.from('tickets').select('sprint_id, company_id').eq('id', req.params.id).single();
  const { error } = await supabase.from('tickets').update({ status: 'cancelled', board_column: 'done' }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  // Hook: check sprint completion after ticket rejection
  if (ticket && (ticket as any).sprint_id) {
    checkSprintCompletion((ticket as any).sprint_id).catch(e =>
      console.error('[ticket-reject-hook] sprint check error:', e.message)
    );
  }

  res.json({ success: true });
});

// ── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n▣ CEO.SIM Orchestrator running on http://localhost:${PORT}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? '● connected' : '○ missing'}`);
  console.log(`  Agent SDK: ● ready`);

  // Auto-start heartbeat daemon
  startHeartbeatDaemon(process.cwd());
  console.log(`  Heartbeat: ● daemon active (30s interval)\n`);
});
