/**
 * Tool mode definitions — tiered loading from claude-task-master pattern.
 *
 * Core (7 tools, ~5K context tokens): minimal for simple tasks
 * Standard (11 tools): default for most work
 * Full (all tools): includes MCP integrations
 */

export type ToolMode = 'core' | 'standard' | 'full';

export interface ToolDefinition {
  name: string;
  description: string;
  tier: ToolMode;
}

// ── Core Mode: 7 tools ──────────────────────────────────────────────────────

const CORE_TOOLS: Record<string, string[]> = {
  default:   ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash', 'Agent'],
  CEO:       ['Read', 'Glob', 'Grep'],
  PM:        ['Read', 'Glob', 'Grep', 'Write'],
  QA:        ['Read', 'Glob', 'Grep', 'Bash'],
  Designer:  ['Read', 'Glob', 'Grep', 'Write'],
};

// ── Standard Mode: 11 tools ─────────────────────────────────────────────────

const STANDARD_TOOLS: Record<string, string[]> = {
  default:   ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'TodoWrite', 'WebFetch', 'WebSearch'],
  CEO:       ['Read', 'Glob', 'Grep', 'Agent', 'WebSearch'],
  PM:        ['Read', 'Glob', 'Grep', 'Write', 'Agent', 'TodoWrite', 'WebSearch'],
  DevOps:    ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'TodoWrite'],
  Frontend:  ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'TodoWrite', 'WebFetch'],
  Backend:   ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'TodoWrite'],
  QA:        ['Read', 'Glob', 'Grep', 'Bash', 'Agent', 'TodoWrite'],
  Designer:  ['Read', 'Write', 'Glob', 'Grep', 'Agent', 'WebFetch'],
  'Full-Stack': ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'TodoWrite', 'WebFetch'],
  Marketer:  ['Read', 'Write', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch'],
  'Content Writer': ['Read', 'Write', 'Glob', 'Grep', 'Agent', 'WebSearch'],
  Sales:     ['Read', 'Write', 'Glob', 'Grep', 'Agent', 'WebSearch'],
  Operations:['Read', 'Write', 'Glob', 'Grep', 'Agent', 'TodoWrite'],
  'Data Architect':  ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent'],
  'Data Scientist':  ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'NotebookEdit'],
  'AI Engineer':     ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent', 'WebFetch'],
  Automation:['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep', 'Agent'],
};

// ── Full Mode: all tools + MCP ───────────────────────────────────────────────

const FULL_TOOLS: Record<string, string[]> = {
  default: [
    ...STANDARD_TOOLS.default,
    'mcp__tavily__search', 'mcp__context7__resolve', 'mcp__supabase__query',
  ],
  CEO: [...(STANDARD_TOOLS.CEO ?? []), 'mcp__tavily__search'],
  PM:  [...(STANDARD_TOOLS.PM ?? []),  'mcp__tavily__search', 'mcp__context7__resolve'],
  Frontend: [...(STANDARD_TOOLS.Frontend ?? []), 'mcp__context7__resolve'],
  Backend:  [...(STANDARD_TOOLS.Backend ?? []),  'mcp__context7__resolve', 'mcp__supabase__query'],
};

// ── Export ────────────────────────────────────────────────────────────────────

export const toolModes: Record<ToolMode, Record<string, string[]>> = {
  core: CORE_TOOLS,
  standard: STANDARD_TOOLS,
  full: FULL_TOOLS,
};
