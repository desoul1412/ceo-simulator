import { supabase } from '../supabaseAdmin';
import type { DepartmentRole, AgentSkill, ResolvedHireConfig } from './types';
import { LEGACY_ROLE_TO_DEPT } from './types';
import { seedDepartmentRoles } from './presetSeeder';

// ── Preset Registry ──────────────────────────────────────────────────────────

class PresetRegistry {
  private deptCache: DepartmentRole[] | null = null;
  private skillCache = new Map<string, AgentSkill[]>(); // deptRoleId → skills

  /** Seed database on startup if empty */
  async seed(): Promise<void> {
    const { count } = await supabase.from('department_roles').select('*', { count: 'exact', head: true });
    if (!count || count === 0) {
      await seedDepartmentRoles();
    } else {
      console.log(`[presets] ${count} department roles already seeded, skipping.`);
    }
    this.deptCache = null; // clear cache after seed
    this.skillCache.clear();
  }

  /** Force re-seed (drops and recreates) */
  async reseed(): Promise<void> {
    await seedDepartmentRoles();
    this.deptCache = null;
    this.skillCache.clear();
  }

  // ── Layer 1: Department Roles (for hiring) ──

  async getDeptRoles(): Promise<DepartmentRole[]> {
    if (this.deptCache) return this.deptCache;
    const { data } = await supabase
      .from('department_roles')
      .select('*')
      .eq('is_active', true)
      .order('dept_index');
    this.deptCache = (data ?? []) as DepartmentRole[];
    return this.deptCache;
  }

  async getDeptRole(idOrSlug: string): Promise<DepartmentRole | null> {
    // Try slug first (more common usage)
    const roles = await this.getDeptRoles();
    const bySlug = roles.find(r => r.slug === idOrSlug);
    if (bySlug) return bySlug;
    const byId = roles.find(r => r.id === idOrSlug);
    return byId ?? null;
  }

  /** Map legacy role names (e.g. "Frontend") to a department */
  async getDeptRoleForLegacy(role: string): Promise<DepartmentRole | null> {
    const deptSlug = LEGACY_ROLE_TO_DEPT[role];
    if (!deptSlug) return null;
    return this.getDeptRole(deptSlug);
  }

  // ── Layer 2: Skills (for execution) ──

  async getSkillsForDept(deptRoleId: string): Promise<AgentSkill[]> {
    if (this.skillCache.has(deptRoleId)) return this.skillCache.get(deptRoleId)!;
    const { data } = await supabase
      .from('agent_skills')
      .select('*')
      .eq('dept_role_id', deptRoleId)
      .order('name');
    const skills = (data ?? []) as AgentSkill[];
    this.skillCache.set(deptRoleId, skills);
    return skills;
  }

  /**
   * Match skills relevant to a task description.
   * Uses keyword scoring (same pattern as worker.ts buildRelevantMemoryContext).
   * Returns top-N most relevant skills.
   */
  async matchSkillsForTask(
    deptRoleId: string,
    taskDescription: string,
    topN = 5,
  ): Promise<AgentSkill[]> {
    const skills = await this.getSkillsForDept(deptRoleId);
    if (skills.length <= topN) return skills;

    // Extract keywords from task
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'have', 'will', 'your', 'task',
      'make', 'file', 'code', 'work', 'read', 'write', 'then', 'into',
      'each', 'also', 'when', 'what', 'should', 'create', 'build',
    ]);
    const keywords = taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    // Score each skill by keyword match against name + description
    const scored = skills.map(skill => {
      const words = new Set(
        `${skill.name} ${skill.description}`.toLowerCase().split(/\s+/),
      );
      // Check exact word match first (fast), then substring match for partial keywords
      const score = keywords.filter(kw =>
        words.has(kw) || [...words].some(w => w.includes(kw)),
      ).length;
      return { skill, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .filter(s => s.score > 0)
      .map(s => s.skill);
  }

  // ── Resolved Config (for hiring) ──

  async resolveHireConfig(deptRoleIdOrSlug: string): Promise<ResolvedHireConfig | null> {
    const deptRole = await this.getDeptRole(deptRoleIdOrSlug);
    if (!deptRole) return null;

    return {
      role: deptRole.short_name,
      department: deptRole.name,
      deptRoleId: deptRole.id,
      systemPrompt: deptRole.system_prompt,
      skills: deptRole.default_skills,
      rules: deptRole.rules,
      modelTier: deptRole.model_tier,
      budget: deptRole.default_budget,
      toolAccess: deptRole.tool_access,
      color: deptRole.color,
      spriteIndex: deptRole.sprite_index,
      mcpServers: deptRole.mcp_servers,
    };
  }

  /** Build a prompt section with matched skills for injection into worker prompts */
  async buildSkillContext(deptRoleId: string, taskDescription: string): Promise<string> {
    const matched = await this.matchSkillsForTask(deptRoleId, taskDescription);
    if (matched.length === 0) return '';

    let ctx = '\n\n## Relevant Expertise\n';
    ctx += 'Based on the task, these specialized skills apply:\n';
    for (const skill of matched) {
      ctx += `- **${skill.name}** (${skill.seniority}): ${skill.description}\n`;
    }
    return ctx;
  }

  /** Build the hiring menu for the CEO planning prompt (~2k tokens) */
  async buildHiringMenu(): Promise<string> {
    const roles = await this.getDeptRoles();
    let menu = 'Available Department Roles (pick up to 8 for your team):\n\n';
    menu += '| Slug | Role | Model | Budget | Capabilities |\n';
    menu += '|------|------|-------|--------|-------------|\n';
    for (const r of roles) {
      const skills = r.default_skills.slice(0, 4).join(', ');
      menu += `| ${r.slug} | ${r.short_name} | ${r.model_tier} | $${r.default_budget} | ${skills} |\n`;
    }
    return menu;
  }
}

export const presetRegistry = new PresetRegistry();
