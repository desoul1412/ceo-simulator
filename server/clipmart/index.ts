/**
 * Clipmart — Company Template Registry.
 *
 * Pattern: claude-code-templates marketplace + component bundles.
 * Export/import company configurations with secret scrubbing.
 */

import { supabase } from '../supabaseAdmin';

export interface CompanyTemplate {
  id?: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  config: TemplateConfig;
  downloads: number;
  rating: number;
}

export interface TemplateConfig {
  agents: TemplateAgent[];
  skills?: string[];
  defaultGoal?: string;
  budget?: number;
  toolMode?: 'core' | 'standard' | 'full';
  sandboxMode?: 'none' | 'docker' | 'e2b';
}

export interface TemplateAgent {
  name: string;
  role: string;
  systemPrompt?: string;
  skills?: string[];
}

// Secret patterns to scrub from exports
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{20,}/g,    // Anthropic API keys
  /ghp_[a-zA-Z0-9]{36}/g,       // GitHub tokens
  /AKIA[A-Z0-9]{16}/g,          // AWS access keys
  /xox[bpras]-[a-zA-Z0-9-]+/g,  // Slack tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWTs
];

/**
 * Export a company as a template (scrubs secrets).
 */
export async function exportCompanyAsTemplate(
  companyId: string,
  metadata: { name: string; description: string; category: string; author: string },
): Promise<CompanyTemplate> {
  // Fetch company data
  const { data: company } = await supabase.from('companies')
    .select('name, ceo_goal, budget')
    .eq('id', companyId)
    .single();

  const { data: agents } = await supabase.from('agents')
    .select('name, role, system_prompt, skills')
    .eq('company_id', companyId)
    .eq('terminated', false);

  const config: TemplateConfig = {
    agents: (agents ?? []).map((a: any) => ({
      name: a.name,
      role: a.role,
      systemPrompt: scrubSecrets(a.system_prompt ?? ''),
      skills: a.skills ?? [],
    })),
    defaultGoal: company?.ceo_goal ?? undefined,
    budget: company?.budget ?? 1000,
  };

  return {
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    author: metadata.author,
    version: '1.0.0',
    config,
    downloads: 0,
    rating: 0,
  };
}

/**
 * Import a template to create a new company.
 */
export async function importTemplate(
  template: CompanyTemplate,
  userId?: string,
): Promise<string> {
  // Create company
  const { data: company, error } = await supabase.from('companies')
    .insert({
      name: `${template.name} (from template)`,
      ceo_goal: template.config.defaultGoal ?? null,
      budget: template.config.budget ?? 1000,
      budget_spent: 0,
    })
    .select('id')
    .single();

  if (error || !company) throw new Error(`Failed to create company: ${error?.message}`);

  const companyId = (company as any).id;

  // Create agents from template
  for (const agent of template.config.agents) {
    await supabase.from('agents').insert({
      company_id: companyId,
      name: agent.name,
      role: agent.role,
      system_prompt: agent.systemPrompt ?? null,
      skills: agent.skills ?? [],
      status: 'idle',
      terminated: false,
    });
  }

  // Link user to company if userId provided
  if (userId) {
    await supabase.from('user_companies').insert({
      user_id: userId,
      company_id: companyId,
      role: 'owner',
    });
  }

  // Track template download
  if (template.id) {
    await supabase.from('company_templates')
      .update({ downloads: (template.downloads ?? 0) + 1 })
      .eq('id', template.id);
  }

  return companyId;
}

/**
 * List available templates.
 */
export async function listTemplates(
  category?: string,
  limit = 20,
): Promise<CompanyTemplate[]> {
  let query = supabase.from('company_templates')
    .select('*')
    .order('downloads', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);

  const { data } = await query;
  return (data ?? []) as unknown as CompanyTemplate[];
}

/**
 * Save a template to the registry.
 */
export async function saveTemplate(template: CompanyTemplate): Promise<string> {
  const { data, error } = await supabase.from('company_templates')
    .insert({
      name: template.name,
      description: template.description,
      category: template.category,
      author: template.author,
      version: template.version,
      config: template.config,
      downloads: 0,
      rating: 0,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save template: ${error.message}`);
  return (data as any).id;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scrubSecrets(text: string): string {
  let scrubbed = text;
  for (const pattern of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}
