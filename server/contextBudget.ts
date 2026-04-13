/**
 * Context Budget Manager — controls total token injection into agent prompts.
 *
 * Problem: memory + skills + brain search + messages can overflow or waste tokens.
 * Solution: each section gets a budget, deduplication prevents repeats, smart truncation
 * preserves sentence boundaries.
 *
 * Budget allocation (total ~4000 tokens / ~16000 chars):
 *   System prompt:    uncapped (role-specific, always included)
 *   Agent messages:   40% (upstream context from dependency chain)
 *   Brain semantic:   25% (relevant past work from pgvector search)
 *   Episodic memory:  15% (short-term + long-term + skills)
 *   Skill context:    15% (department role skills)
 *   Rules:            5%  (always included, small)
 */

const DEFAULT_TOTAL_BUDGET_CHARS = 16000; // ~4000 tokens

interface ContextSection {
  key: string;
  content: string;
  budgetPct: number; // percentage of total budget
  priority: number;  // lower = more important (kept when over budget)
}

/**
 * Estimate token count from character length.
 * Rough: 1 token ≈ 4 chars for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Smart truncation — cut at sentence boundary, not mid-word.
 */
function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  // Try to cut at last sentence boundary before maxChars
  const truncated = text.slice(0, maxChars);
  const lastSentence = truncated.lastIndexOf('. ');
  const lastNewline = truncated.lastIndexOf('\n');
  const cutPoint = Math.max(lastSentence, lastNewline);

  if (cutPoint > maxChars * 0.5) {
    return truncated.slice(0, cutPoint + 1) + '\n...(truncated)';
  }
  return truncated + '...(truncated)';
}

/**
 * Deduplicate content across sections.
 * Uses content fingerprinting — if a sentence appears in multiple sections, keep only the first.
 */
function deduplicateSections(sections: ContextSection[]): ContextSection[] {
  const seenSentences = new Set<string>();

  return sections.map(section => {
    const lines = section.content.split('\n');
    const dedupedLines: string[] = [];

    for (const line of lines) {
      const normalized = line.trim().toLowerCase().replace(/\s+/g, ' ');
      if (normalized.length < 10) {
        // Keep short lines (headers, separators)
        dedupedLines.push(line);
        continue;
      }

      // Check if this line (or a close match) was seen before
      if (seenSentences.has(normalized)) continue;

      // Check for substring containment (fuzzy dedup) — capped to avoid O(n*m) on large contexts
      let isDuplicate = false;
      if (seenSentences.size < 300) {
        for (const seen of seenSentences) {
          if (seen.includes(normalized) || normalized.includes(seen)) {
            isDuplicate = true;
            break;
          }
        }
      }
      if (isDuplicate) continue;

      seenSentences.add(normalized);
      dedupedLines.push(line);
    }

    return { ...section, content: dedupedLines.join('\n') };
  });
}

/**
 * Assemble a budget-controlled context string from multiple sections.
 * Each section is allocated a % of the total budget.
 * If a section is under-budget, unused chars are redistributed to others.
 */
export function assembleContext(
  sections: ContextSection[],
  totalBudgetChars = DEFAULT_TOTAL_BUDGET_CHARS,
): string {
  if (sections.length === 0) return '';

  // 1. Deduplicate across sections
  const deduped = deduplicateSections(sections);

  // 2. Sort by priority (lower = more important)
  const sorted = [...deduped].sort((a, b) => a.priority - b.priority);

  // 3. First pass: allocate budgets
  const allocations = sorted.map(s => ({
    ...s,
    maxChars: Math.round(totalBudgetChars * (s.budgetPct / 100)),
    actualChars: s.content.length,
  }));

  // 4. Redistribute unused budget from under-budget sections
  let surplus = 0;
  let needMore = 0;
  for (const a of allocations) {
    if (a.actualChars < a.maxChars) {
      surplus += a.maxChars - a.actualChars;
    } else {
      needMore += a.actualChars - a.maxChars;
    }
  }

  // Give surplus to over-budget sections proportionally
  if (surplus > 0 && needMore > 0) {
    for (const a of allocations) {
      if (a.actualChars > a.maxChars) {
        const share = Math.min(
          surplus * ((a.actualChars - a.maxChars) / needMore),
          a.actualChars - a.maxChars,
        );
        a.maxChars += Math.round(share);
      }
    }
  }

  // 5. Truncate each section to its budget
  const result: string[] = [];
  for (const a of allocations) {
    if (!a.content.trim()) continue;
    const truncated = smartTruncate(a.content, a.maxChars);
    if (truncated.trim()) result.push(truncated);
  }

  return result.join('\n\n');
}

/**
 * Build a budget-controlled agent prompt context.
 * Combines all memory layers with deduplication and smart truncation.
 */
export function buildBudgetedContext(opts: {
  agentMessages?: string;  // from injectMessagesIntoContext
  brainMemory?: string;    // from buildMemoryContext (semantic search)
  episodicMemory?: string; // from buildRelevantMemoryContext
  skillContext?: string;   // from presetRegistry.buildSkillContext
  task: string;
  totalBudgetChars?: number;
}): string {
  const sections: ContextSection[] = [];

  if (opts.agentMessages?.trim()) {
    sections.push({
      key: 'messages',
      content: opts.agentMessages,
      budgetPct: 40,
      priority: 1, // highest — upstream deps are critical
    });
  }

  if (opts.brainMemory?.trim()) {
    sections.push({
      key: 'brain',
      content: opts.brainMemory,
      budgetPct: 25,
      priority: 2,
    });
  }

  if (opts.episodicMemory?.trim()) {
    sections.push({
      key: 'episodic',
      content: opts.episodicMemory,
      budgetPct: 15,
      priority: 3,
    });
  }

  if (opts.skillContext?.trim()) {
    sections.push({
      key: 'skills',
      content: opts.skillContext,
      budgetPct: 15,
      priority: 4,
    });
  }

  const context = assembleContext(sections, opts.totalBudgetChars);

  if (!context.trim()) return opts.task;

  return `${context}\n\n## Your Task\n\n${opts.task}\n\nWork in the project directory. Read relevant files first to understand the codebase, then make your changes. Be thorough but focused.`;
}
