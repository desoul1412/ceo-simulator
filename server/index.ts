import express from 'express';
import cors from 'cors';
import { executeCeoGoal } from './agents/ceo';
import { processNextTask, getQueueStatus } from './taskProcessor';
import { processNextTicket, getTicketQueueStatus } from './ticketProcessor';
import { startHeartbeatDaemon, stopHeartbeatDaemon, isDaemonRunning } from './heartbeatDaemon';
import { listWorktrees } from './worktreeManager';
import { supabase } from './supabaseAdmin';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:5173',     // Vite dev server
    'http://localhost:4173',     // Vite preview
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

    // Get the project working directory (where code lives)
    const cwd = process.cwd();

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

app.post('/api/process-queue', async (_req, res) => {
  try {
    const cwd = process.cwd();
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

// ── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n▣ CEO.SIM Orchestrator running on http://localhost:${PORT}`);
  console.log(`  Supabase: ${process.env.SUPABASE_URL ? '● connected' : '○ missing'}`);
  console.log(`  Agent SDK: ● ready`);

  // Auto-start heartbeat daemon
  startHeartbeatDaemon(process.cwd());
  console.log(`  Heartbeat: ● daemon active (30s interval)\n`);
});
