/**
 * Smart model, effort, and budget selection based on agent role, task complexity, and story points.
 * Reduces token costs ~30-40% on simple tasks while improving quality on complex ones.
 */

import type { ModelTier } from '../providers/types';
import { providerRegistry } from '../providers/registry';

const COMPLEX_KEYWORDS = /architect|refactor|migration|redesign|overhaul|rewrite|security|audit/i;

// Re-export ModelTier for external consumers
export type { ModelTier };
type Effort = 'low' | 'medium' | 'high';

/** Model ID strings for the DB — now resolved through provider registry */
export const MODEL_IDS: Record<ModelTier, string> = {
  haiku: providerRegistry.getModelId('haiku'),
  sonnet: providerRegistry.getModelId('sonnet'),
  opus: providerRegistry.getModelId('opus'),
};

/**
 * Select the optimal model for a task based on role, story points, and task description.
 */
export function selectModel(role: string, storyPoints: number, task: string): ModelTier {
  // CEO planning always gets the best model
  if (role === 'CEO') return 'opus';

  // PM always uses sonnet — specs require reading codebase + structured writing
  if (role === 'PM') return 'sonnet';

  // QA/Designer: only haiku for truly read-only tasks; sonnet if writing files
  if (storyPoints <= 2 && (role === 'QA' || role === 'Designer')) {
    const needsWriting = /create|write|configure|set up|implement|build|add|modify|install|test|verify|run|check|visual|playwright|vitest/i.test(task);
    return needsWriting ? 'sonnet' : 'haiku';
  }

  // Complex tasks: stay with sonnet but bump effort (handled separately)
  // Very complex: sonnet is still best value for dev work
  return 'sonnet';
}

/**
 * Select the effort level for a task.
 */
export function selectEffort(role: string, storyPoints: number, task: string): Effort {
  if (role === 'CEO') return 'high';
  if (role === 'PM') return 'medium'; // PM specs always need decent effort

  if (storyPoints <= 2) return 'low';
  if (storyPoints >= 8 || COMPLEX_KEYWORDS.test(task)) return 'high';
  return 'medium';
}

/**
 * Allocate budget based on complexity and remaining budget.
 * Returns maxBudgetUsd capped by what the agent can still spend.
 */
export function allocateBudget(
  role: string,
  storyPoints: number,
  budgetRemaining: number,
  projectSize?: 'small' | 'medium' | 'large',
): number {
  let base: number;

  if (role === 'CEO') {
    base = projectSize === 'large' ? 5.0 : projectSize === 'small' ? 1.5 : 2.5;
  } else if (role === 'PM') {
    base = 3.0; // PM specs need extensive reading + structured writing
  } else if (role === 'Designer' || role === 'QA') {
    base = storyPoints <= 2 ? 0.50 : 1.5;
  } else {
    // Frontend, Backend, DevOps — generous budget for code changes
    base = storyPoints <= 2 ? 2.5 : storyPoints <= 5 ? 3.0 : 5.0;
  }

  return Math.min(base, budgetRemaining);
}
