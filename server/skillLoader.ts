/**
 * Skill Loader: reads installed skills from .claude/skills/ and matches them to agent roles.
 * Injects relevant skill instructions into agent prompts for better output quality.
 */

import fs from 'fs';
import path from 'path';

interface InstalledSkill {
  name: string;
  content: string;
}

// Map skill names to agent roles they're relevant for
const SKILL_ROLE_MAP: Record<string, string[]> = {
  // React/frontend skills
  'vercel-react-best-practices': ['Frontend', 'Full-Stack'],
  'frontend-design': ['Frontend', 'Designer', 'Full-Stack'],
  'web-design-guidelines': ['Frontend', 'Designer', 'Full-Stack'],
  'remotion-best-practices': ['Frontend'],
  // Backend skills
  'azure-ai': ['Backend', 'AI Engineer', 'Full-Stack'],
  // General skills
  'find-skills': ['CEO', 'PM'],
  'agent-browser': ['QA', 'Frontend'],
};

// Keyword-based fallback matching
const ROLE_KEYWORDS: Record<string, string[]> = {
  Frontend: ['react', 'css', 'ui', 'ux', 'frontend', 'component', 'tailwind', 'next', 'design'],
  Backend: ['api', 'database', 'server', 'backend', 'node', 'express', 'supabase', 'auth'],
  QA: ['test', 'quality', 'e2e', 'playwright', 'vitest', 'coverage'],
  Designer: ['design', 'ui', 'ux', 'css', 'tailwind', 'style', 'layout'],
  DevOps: ['deploy', 'ci', 'cd', 'docker', 'infrastructure', 'vercel'],
  PM: ['plan', 'spec', 'requirement', 'architecture', 'project'],
  CEO: ['strategy', 'plan', 'overview', 'architecture'],
};

/**
 * Load all installed skills from .claude/skills/
 */
function loadInstalledSkills(cwd: string): InstalledSkill[] {
  const skillsDir = path.join(cwd, '.claude', 'skills');
  const skills: InstalledSkill[] = [];

  if (!fs.existsSync(skillsDir)) return skills;

  for (const dir of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, dir);
    if (!fs.statSync(skillPath).isDirectory()) continue;

    // Read SKILL.md or any .md file for instructions
    const skillMd = path.join(skillPath, 'SKILL.md');
    const readmeMd = path.join(skillPath, 'README.md');
    const contentFile = fs.existsSync(skillMd) ? skillMd : fs.existsSync(readmeMd) ? readmeMd : null;

    if (contentFile) {
      const content = fs.readFileSync(contentFile, 'utf8');
      skills.push({ name: dir, content: content.slice(0, 2000) }); // Cap at 2K chars
    }
  }

  return skills;
}

/**
 * Match skills to a specific agent role using explicit mapping + keyword matching.
 */
function matchSkillsToRole(skills: InstalledSkill[], role: string): InstalledSkill[] {
  const matched: InstalledSkill[] = [];

  for (const skill of skills) {
    // Explicit mapping
    const mappedRoles = SKILL_ROLE_MAP[skill.name];
    if (mappedRoles?.includes(role)) {
      matched.push(skill);
      continue;
    }

    // Keyword-based matching
    const keywords = ROLE_KEYWORDS[role] ?? [];
    const nameAndContent = (skill.name + ' ' + skill.content).toLowerCase();
    const hits = keywords.filter(kw => nameAndContent.includes(kw));
    if (hits.length >= 2) {
      matched.push(skill);
    }
  }

  return matched;
}

/**
 * Build a skill context string for injection into agent prompts.
 * Returns empty string if no relevant skills found.
 */
export function buildSkillContext(role: string, cwd: string): string {
  const skills = loadInstalledSkills(cwd);
  if (skills.length === 0) return '';

  const relevant = matchSkillsToRole(skills, role);
  if (relevant.length === 0) return '';

  const sections = relevant.map(s =>
    `### Skill: ${s.name}\n${s.content}`
  ).join('\n\n');

  return `\n\n## Installed Skills (follow these guidelines)\n${sections}\n`;
}
