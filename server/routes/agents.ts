import { Router } from 'express';
import { supabase } from '../supabaseAdmin';
import { AUTO_NAMES, ROLE_COLORS, ROLE_SPRITES, DEFAULT_SYSTEM_PROMPTS, DEFAULT_SKILLS, DESK_POSITIONS } from '../constants';
import { initAgentBrain } from '../helpers/brain';
import { getAgentMessages, sendMessage as sendAgentMessage, getUnreadMessages, markRead as markMsgRead } from '../agentMessenger';
import { presetRegistry } from '../presets';

const router = Router();

// ── Hire Agent ───────────────────────────────────────────────────────────────

router.post('/api/hire-agent', async (req, res) => {
  const { companyId, mode, role, name, systemPrompt, skills, monthlyCost, model, runtimeType, runtimeConfig, budgetLimit, deptRoleId } = req.body;

  if (!companyId || !role) {
    return res.status(400).json({ error: 'Missing companyId or role' });
  }

  try {
    // If a deptRoleId is provided, resolve full config from the preset
    let presetConfig: any = null;
    if (deptRoleId) {
      presetConfig = await presetRegistry.resolveHireConfig(deptRoleId);
    }

    const { data: existingAgents } = await supabase
      .from('agents').select('id, role, tile_col, tile_row, name').eq('company_id', companyId);

    const ceo = (existingAgents ?? []).find((a: any) => a.role === 'CEO');

    const agentName = name || (() => {
      const pool = AUTO_NAMES[role] ?? AUTO_NAMES.Frontend;
      const usedNames = (existingAgents ?? []).map((a: any) => a.name);
      return pool.find(n => !usedNames.includes(n)) ?? `Agent ${Math.floor(Math.random() * 900 + 100)}`;
    })();

    const usedPositions = new Set((existingAgents ?? []).map((a: any) => `${a.tile_col},${a.tile_row}`));
    const desk = DESK_POSITIONS.find(p => !usedPositions.has(`${p.col},${p.row}`)) ?? { col: 5, row: 15 };

    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({
        company_id: companyId, name: agentName, role,
        color: presetConfig?.color ?? ROLE_COLORS[role] ?? '#6a7a90',
        sprite_index: presetConfig?.spriteIndex ?? ROLE_SPRITES[role] ?? 0,
        tile_col: desk.col, tile_row: desk.row,
        monthly_cost: monthlyCost ?? 5000,
        reports_to: ceo?.id ?? null,
        system_prompt: systemPrompt ?? presetConfig?.systemPrompt ?? DEFAULT_SYSTEM_PROMPTS[role] ?? `You are a ${role}.`,
        skills: skills ?? presetConfig?.skills ?? DEFAULT_SKILLS[role] ?? [],
        memory: {},
        runtime_type: runtimeType ?? 'claude_sdk',
        runtime_config: runtimeConfig ?? (model ? { model } : {}),
        budget_limit: budgetLimit ?? presetConfig?.budget ?? 10.00,
        dept_role_id: deptRoleId ?? null,
        department: presetConfig?.department ?? null,
      })
      .select().single();

    if (error) throw error;

    const deptLabel = presetConfig?.department ? ` [${presetConfig.department}]` : '';
    await supabase.from('activity_log').insert({
      company_id: companyId, agent_id: (newAgent as any).id,
      type: 'agent-hired',
      message: `${agentName} hired as ${role}${deptLabel}${mode === 'auto' ? ' (auto)' : ''}`,
    });

    initAgentBrain(companyId, (newAgent as any).id).catch(e =>
      console.error('[hire-agent-hook] brain init error:', e.message)
    );

    res.json({ success: true, agent: newAgent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fire Agent ───────────────────────────────────────────────────────────────

router.delete('/api/agents/:agentId', async (req, res) => {
  try {
    const { data: agent } = await supabase
      .from('agents').select('name, role, company_id').eq('id', req.params.agentId).single();

    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    await supabase.from('tickets').update({ agent_id: null }).eq('agent_id', req.params.agentId);
    await supabase.from('merge_requests').update({ agent_id: null }).eq('agent_id', req.params.agentId);
    await supabase.from('token_usage').delete().eq('agent_id', req.params.agentId);
    await supabase.from('agent_sessions').delete().eq('agent_id', req.params.agentId);
    await supabase.from('agents').delete().eq('id', req.params.agentId);

    await supabase.from('activity_log').insert({
      company_id: (agent as any).company_id, type: 'agent-fired',
      message: `${(agent as any).name} (${(agent as any).role}) was let go`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Agent Update ─────────────────────────────────────────────────────────────

router.patch('/api/agents/:agentId', async (req, res) => {
  const allowed = ['name', 'system_prompt', 'budget_limit', 'skills', 'role'];
  const updates: any = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  const { data, error } = await supabase.from('agents').update(updates).eq('id', req.params.agentId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Skill Injection ──────────────────────────────────────────────────────────

router.post('/api/agents/:agentId/inject-skill', async (req, res) => {
  const { skill } = req.body;
  if (!skill) return res.status(400).json({ error: 'Missing skill name' });

  const { data: agent } = await supabase.from('agents').select('skills, memory').eq('id', req.params.agentId).single();
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const a = agent as any;
  const skills = [...new Set([...(a.skills ?? []), skill])];
  const memory = { ...(a.memory ?? {}), shortTerm: [...(a.memory?.shortTerm ?? []), `Skill injected: ${skill}`].slice(-10) };

  await supabase.from('agents').update({ skills, memory }).eq('id', req.params.agentId);

  await supabase.from('audit_log').insert({
    company_id: null, agent_id: req.params.agentId,
    event_type: 'system', message: `Skill injected at runtime: ${skill}`,
  });

  res.json({ success: true, skills });
});

// ── Agent Lifecycle ──────────────────────────────────────────────────────────

router.patch('/api/agents/:agentId/lifecycle', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused', 'throttled', 'terminated'].includes(status)) {
    return res.status(400).json({ error: 'Invalid lifecycle status' });
  }

  const { data, error } = await supabase.from('agents')
    .update({ lifecycle_status: status }).eq('id', req.params.agentId).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_log').insert({
    company_id: (data as any).company_id, agent_id: req.params.agentId,
    event_type: 'status_change', message: `Agent lifecycle changed to: ${status}`,
  });

  res.json(data);
});

// ── Agent Budget ─────────────────────────────────────────────────────────────

router.patch('/api/agents/:agentId/budget', async (req, res) => {
  const { budget_limit } = req.body;
  const { data, error } = await supabase.from('agents')
    .update({ budget_limit, lifecycle_status: 'active' })
    .eq('id', req.params.agentId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Agent Messages ───────────────────────────────────────────────────────────

router.get('/api/agents/:id/messages', async (req, res) => {
  const messages = await getAgentMessages(req.params.id, parseInt(req.query.limit as string) || 50);
  res.json(messages);
});

router.get('/api/agents/:id/messages/unread', async (req, res) => {
  const messages = await getUnreadMessages(req.params.id);
  res.json(messages);
});

router.post('/api/agents/:id/messages', async (req, res) => {
  const { to_agent_id, ticket_id, message_type, subject, content, metadata } = req.body;
  const { data: agent } = await supabase.from('agents').select('company_id').eq('id', req.params.id).single();
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const msgId = await sendAgentMessage(
    (agent as any).company_id, req.params.id,
    to_agent_id ?? null, ticket_id ?? null,
    message_type ?? 'context_share', subject ?? 'Message',
    content ?? '', metadata ?? {},
  );
  res.json({ success: !!msgId, id: msgId });
});

router.post('/api/messages/:id/read', async (req, res) => {
  await markMsgRead(req.params.id);
  res.json({ success: true });
});

export default router;
