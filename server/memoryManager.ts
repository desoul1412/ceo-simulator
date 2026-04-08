import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseAdmin';

interface AgentMemory {
  shortTerm: string[];
  longTerm: string[];
  skills: string[];
  rules: string[];
  completedTasks: { task: string; date: string; summary: string }[];
}

const DEFAULT_MEMORY: AgentMemory = {
  shortTerm: [],
  longTerm: [],
  skills: [],
  rules: [],
  completedTasks: [],
};

/**
 * Load agent memory from Supabase.
 */
export async function loadMemory(agentId: string): Promise<AgentMemory> {
  const { data } = await supabase
    .from('agents')
    .select('memory')
    .eq('id', agentId)
    .single();
  const raw = (data as any)?.memory;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MEMORY };
  return { ...DEFAULT_MEMORY, ...raw };
}

/**
 * Save agent memory to Supabase.
 */
export async function saveMemory(agentId: string, memory: AgentMemory): Promise<void> {
  await supabase
    .from('agents')
    .update({ memory })
    .eq('id', agentId);
}

/**
 * Add a completed task summary to memory.
 * Promotes recurring themes from shortTerm to longTerm.
 */
export async function recordTaskCompletion(
  agentId: string,
  task: string,
  summary: string,
): Promise<void> {
  const memory = await loadMemory(agentId);

  // Add to completed tasks (keep last 20)
  memory.completedTasks = [
    { task, date: new Date().toISOString().split('T')[0], summary: summary.slice(0, 300) },
    ...memory.completedTasks,
  ].slice(0, 20);

  // Add to short-term memory (keep last 10)
  memory.shortTerm = [
    summary.slice(0, 200),
    ...memory.shortTerm,
  ].slice(0, 10);

  // Auto-promote: if a keyword appears 3+ times in shortTerm, move to longTerm
  const wordFreq = new Map<string, number>();
  for (const item of memory.shortTerm) {
    for (const word of item.toLowerCase().split(/\s+/)) {
      if (word.length > 4) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }
  }
  for (const [word, count] of wordFreq) {
    if (count >= 3 && !memory.longTerm.some(lt => lt.toLowerCase().includes(word))) {
      memory.longTerm.push(`Frequently works with: ${word}`);
    }
  }
  memory.longTerm = memory.longTerm.slice(0, 20);

  await saveMemory(agentId, memory);
}

/**
 * Auto-detect skills from task output and add to agent.
 */
export async function extractSkills(agentId: string, taskOutput: string): Promise<string[]> {
  const memory = await loadMemory(agentId);
  const newSkills: string[] = [];

  const SKILL_PATTERNS: [RegExp, string][] = [
    [/react|component|jsx|tsx/i, 'React'],
    [/typescript|\.ts\b/i, 'TypeScript'],
    [/tailwind|css/i, 'CSS/Tailwind'],
    [/vitest|test|spec/i, 'Testing'],
    [/supabase|postgres|sql/i, 'Database'],
    [/express|api|endpoint/i, 'API Development'],
    [/docker|deploy|ci\/cd/i, 'DevOps'],
    [/markdown|documentation|spec/i, 'Documentation'],
    [/git|branch|commit/i, 'Git'],
    [/vite|webpack|bundle/i, 'Build Tools'],
  ];

  for (const [pattern, skill] of SKILL_PATTERNS) {
    if (pattern.test(taskOutput) && !memory.skills.includes(skill)) {
      memory.skills.push(skill);
      newSkills.push(skill);
    }
  }

  if (newSkills.length > 0) {
    await saveMemory(agentId, memory);
    // Also update the skills column
    await supabase
      .from('agents')
      .update({ skills: memory.skills })
      .eq('id', agentId);
  }

  return newSkills;
}

/**
 * Write agent memory to brain/agents/{name}/memory.md as Obsidian document.
 */
export async function syncMemoryToObsidian(
  agentId: string,
  cwd: string,
): Promise<void> {
  const { data: agent } = await supabase
    .from('agents')
    .select('name, role, memory, skills')
    .eq('id', agentId)
    .single();

  if (!agent) return;
  const a = agent as any;
  const memory: AgentMemory = { ...DEFAULT_MEMORY, ...(a.memory ?? {}) };
  const agentSlug = a.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const agentDir = path.join(cwd, 'brain', 'agents', agentSlug);
  fs.mkdirSync(agentDir, { recursive: true });

  const content = `---
tags: [agent, memory, ${a.role.toLowerCase()}]
date: ${new Date().toISOString().split('T')[0]}
status: active
---

# ${a.name} — ${a.role} Agent Memory

## Skills
${(a.skills ?? []).map((s: string) => `- ${s}`).join('\n') || '- None yet'}

## Short-Term Memory
${memory.shortTerm.map(s => `- ${s}`).join('\n') || '- Empty'}

## Long-Term Knowledge
${memory.longTerm.map(s => `- ${s}`).join('\n') || '- Empty'}

## Rules
${memory.rules.map(s => `- ${s}`).join('\n') || '- Inherits global rules'}

## Completed Tasks
${memory.completedTasks.map(t => `### ${t.date} — ${t.task}\n${t.summary}\n`).join('\n') || '- No tasks completed yet'}
`;

  fs.writeFileSync(path.join(agentDir, 'memory.md'), content, 'utf8');
}
