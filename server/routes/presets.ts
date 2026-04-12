import { Router } from 'express';
import { presetRegistry } from '../presets';
import { supabase } from '../supabaseAdmin';

const router = Router();

// ── List all department roles ───────────────────────────────────────────────

router.get('/api/dept-roles', async (_req, res) => {
  try {
    const roles = await presetRegistry.getDeptRoles();

    // Count skills per department
    const countMap = new Map<string, number>();
    for (const role of roles) {
      const { count } = await supabase
        .from('agent_skills')
        .select('*', { count: 'exact', head: true })
        .eq('dept_role_id', role.id);
      countMap.set(role.id, count ?? 0);
    }

    const enriched = roles.map(r => ({
      ...r,
      skill_count: countMap.get(r.id) ?? 0,
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single department role with its skills ──────────────────────────────

router.get('/api/dept-roles/:id', async (req, res) => {
  try {
    const role = await presetRegistry.getDeptRole(req.params.id);
    if (!role) return res.status(404).json({ error: 'Department role not found' });

    const skills = await presetRegistry.getSkillsForDept(role.id);
    res.json({ ...role, skills });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get skills for a department ─────────────────────────────────────────────

router.get('/api/dept-roles/:id/skills', async (req, res) => {
  try {
    const role = await presetRegistry.getDeptRole(req.params.id);
    if (!role) return res.status(404).json({ error: 'Department role not found' });

    const skills = await presetRegistry.getSkillsForDept(role.id);
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Match skills for a task ─────────────────────────────────────────────────

router.get('/api/dept-roles/:id/skills/match', async (req, res) => {
  try {
    const role = await presetRegistry.getDeptRole(req.params.id);
    if (!role) return res.status(404).json({ error: 'Department role not found' });

    const task = (req.query.task as string) ?? '';
    if (!task) return res.status(400).json({ error: 'task query parameter required' });
    if (task.length > 5000) return res.status(400).json({ error: 'task too long (max 5000 chars)' });

    const matched = await presetRegistry.matchSkillsForTask(role.id, task);
    res.json(matched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Resolve hire config for a department ────────────────────────────────────

router.get('/api/dept-roles/:id/hire-config', async (req, res) => {
  try {
    const config = await presetRegistry.resolveHireConfig(req.params.id);
    if (!config) return res.status(404).json({ error: 'Department role not found' });
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create custom department role ───────────────────────────────────────────

router.post('/api/dept-roles', async (req, res) => {
  try {
    const { slug, name, short_name, description, system_prompt, ...rest } = req.body;
    if (!slug || !name || !short_name || !description || !system_prompt) {
      return res.status(400).json({ error: 'slug, name, short_name, description, and system_prompt are required' });
    }

    const { data, error } = await supabase.from('department_roles').insert({
      slug, name, short_name, description, system_prompt,
      dept_index: rest.dept_index ?? 99,
      default_skills: rest.default_skills ?? [],
      rules: rest.rules ?? [],
      model_tier: rest.model_tier ?? 'sonnet',
      default_budget: rest.default_budget ?? 10,
      tool_access: rest.tool_access ?? 'core',
      color: rest.color ?? '#6a7a90',
      sprite_index: rest.sprite_index ?? 0,
      mcp_servers: rest.mcp_servers ?? [],
      source: 'custom',
    }).select().single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Re-seed builtin presets ─────────────────────────────────────────────────

router.post('/api/dept-roles/seed', async (_req, res) => {
  try {
    await presetRegistry.reseed();
    res.json({ success: true, message: 'Reseeded department roles and skills' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get hiring menu (for planning prompt) ───────────────────────────────────

router.get('/api/dept-roles/hiring-menu', async (_req, res) => {
  try {
    const menu = await presetRegistry.buildHiringMenu();
    res.json({ menu });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
