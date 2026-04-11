/**
 * ToolRegistry — manages tool catalog per role + mode.
 *
 * Patterns adopted:
 * - claude-task-master: Tiered loading (Core 7 / Standard 15 / Full)
 * - wshobson/agents: Progressive disclosure (metadata → instructions → resources)
 * - Zod validation on tool inputs (blocks path traversal, secret patterns)
 */

import { toolModes, type ToolMode, type ToolDefinition } from './toolModes';
import { validateToolInput, type ValidationResult } from './schemas';

export type { ToolMode, ToolDefinition };

class ToolRegistry {
  /**
   * Get tools for a role at a given mode level.
   * Falls back gracefully: if role not found, uses 'default'.
   */
  getTools(role: string, mode: ToolMode = 'standard'): string[] {
    const roleDefs = toolModes[mode];
    return roleDefs[role] ?? roleDefs['default'] ?? toolModes.core['default'];
  }

  /**
   * Get tool definitions with metadata (for progressive disclosure).
   * First call returns name + 1-line description only.
   */
  getToolMetadata(role: string, mode: ToolMode = 'standard'): ToolDefinition[] {
    const toolNames = this.getTools(role, mode);
    return toolNames.map(name => TOOL_CATALOG[name] ?? { name, description: name, tier: 'standard' });
  }

  /**
   * Validate tool input before execution.
   * Blocks path traversal, secret patterns, dangerous commands.
   */
  validateInput(toolName: string, input: Record<string, unknown>): ValidationResult {
    return validateToolInput(toolName, input);
  }

  /** Check if a tool is available for a role at a given mode */
  isAvailable(tool: string, role: string, mode: ToolMode = 'standard'): boolean {
    return this.getTools(role, mode).includes(tool);
  }
}

// ── Tool Catalog (progressive disclosure metadata) ───────────────────────────

const TOOL_CATALOG: Record<string, ToolDefinition> = {
  Read:  { name: 'Read',  description: 'Read file contents', tier: 'core' },
  Glob:  { name: 'Glob',  description: 'Find files by pattern', tier: 'core' },
  Grep:  { name: 'Grep',  description: 'Search file contents', tier: 'core' },
  Write: { name: 'Write', description: 'Create or overwrite files', tier: 'core' },
  Edit:  { name: 'Edit',  description: 'Edit existing files', tier: 'core' },
  Bash:  { name: 'Bash',  description: 'Execute shell commands', tier: 'core' },
  Agent: { name: 'Agent', description: 'Launch sub-agents for parallel tasks', tier: 'core' },
  // Standard tier
  WebFetch:    { name: 'WebFetch',    description: 'Fetch web pages', tier: 'standard' },
  WebSearch:   { name: 'WebSearch',   description: 'Search the web', tier: 'standard' },
  TodoWrite:   { name: 'TodoWrite',   description: 'Track task progress', tier: 'standard' },
  NotebookEdit:{ name: 'NotebookEdit',description: 'Edit Jupyter notebooks', tier: 'standard' },
  // Full tier (MCP tools, etc.)
  'mcp__tavily__search':     { name: 'mcp__tavily__search',     description: 'Tavily web search', tier: 'full' },
  'mcp__context7__resolve':  { name: 'mcp__context7__resolve',  description: 'Resolve library docs', tier: 'full' },
  'mcp__supabase__query':    { name: 'mcp__supabase__query',    description: 'Query Supabase', tier: 'full' },
};

// ── Singleton ────────────────────────────────────────────────────────────────

export const toolRegistry = new ToolRegistry();
