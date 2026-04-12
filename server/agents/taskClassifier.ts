/**
 * Smart model, effort, and budget selection based on agent role, task complexity, and story points.
 * Reduces token costs ~30-40% on simple tasks while improving quality on complex ones.
 */

const COMPLEX_KEYWORDS = /architect|refactor|migration|redesign|overhaul|rewrite|security|audit/i;

type Model = 'haiku' | 'sonnet' | 'opus';
type Effort = 'low' | 'medium' | 'high';

/** Model ID strings for the DB */
export const MODEL_IDS: Record<Model, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
};

/**
 * Select the optimal model for a task based on role, story points, and task description.
 * Supports preset-based model tier override via optional deptModelTier parameter.
 */
export function selectModel(role: string, storyPoints: number, task: string, deptModelTier?: Model): Model {
  // CEO and Tech Lead always get the best model
  if (role === 'CEO' || role === 'Tech Lead') return 'opus';

  // PM always uses sonnet — specs require reading codebase + structured writing
  if (role === 'PM') return 'sonnet';

  // If a department role specifies a model tier, use it as the base
  if (deptModelTier) {
    // Still allow complexity-based upgrade: haiku -> sonnet for complex tasks
    if (deptModelTier === 'haiku' && (storyPoints > 3 || COMPLEX_KEYWORDS.test(task))) {
      return 'sonnet';
    }
    return deptModelTier;
  }

  // QA/Designer: only haiku for truly read-only tasks; sonnet if writing files
  if (storyPoints <= 2 && (role === 'QA' || role === 'Designer')) {
    return 'haiku';
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
    // CEO planning scales with project size
    base = projectSize === 'large' ? 4.0 : projectSize === 'small' ? 1.5 : 2.5;
  } else if (role === 'PM') {
    base = 2.0; // PM specs need extensive reading + structured writing
  } else if (role === 'Designer' || role === 'QA') {
    base = storyPoints <= 2 ? 0.50 : 1.0; // read-heavy, less writing
  } else {
    // Frontend, Backend, DevOps — always need decent budget for code changes
    base = storyPoints <= 2 ? 1.5 : storyPoints <= 5 ? 2.0 : 3.0;
  }

  return Math.min(base, budgetRemaining);
}
