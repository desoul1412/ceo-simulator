/**
 * Pipeline stage definitions with entry/exit criteria.
 * Pattern: oh-my-claudecode staged pipeline (plan→prd→exec→verify→fix)
 */

export type PipelineStage = 'plan' | 'exec' | 'verify' | 'fix' | 'done';

export interface StageDefinition {
  name: PipelineStage;
  description: string;
  maxRetries: number;
  promptSuffix: string;  // appended to agent prompt for this stage
}

export const STAGES: Record<PipelineStage, StageDefinition> = {
  plan: {
    name: 'plan',
    description: 'Break down the task into implementation steps',
    maxRetries: 1,
    promptSuffix: `PLANNING PHASE: Before writing any code, analyze the task and output a clear implementation plan.
List each file to create/modify, the changes needed, and any dependencies.
Format: numbered steps with file paths. Do NOT write code yet.`,
  },
  exec: {
    name: 'exec',
    description: 'Execute the implementation plan',
    maxRetries: 1,
    promptSuffix: `EXECUTION PHASE: Implement the changes according to the plan.
Write clean, tested code. Follow existing patterns in the codebase.`,
  },
  verify: {
    name: 'verify',
    description: 'Run tests and verify the implementation',
    maxRetries: 1,
    promptSuffix: `VERIFICATION PHASE: Run all relevant tests to verify the implementation.
Check that acceptance criteria are met. Report pass/fail status.
If tests exist, run them. If not, verify the changes manually.`,
  },
  fix: {
    name: 'fix',
    description: 'Fix issues found during verification',
    maxRetries: 3,
    promptSuffix: `FIX PHASE: The verification step found issues. Fix them now.
Re-run tests after fixing. If tests pass, the task is complete.`,
  },
  done: {
    name: 'done',
    description: 'Task completed successfully',
    maxRetries: 0,
    promptSuffix: '',
  },
};

/**
 * Determine pipeline eligibility based on story points.
 * SP ≤ 2: direct exec (skip planning phase)
 * SP 3-4: plan → exec (skip verify for small tasks)
 * SP ≥ 5: full pipeline (plan → exec → verify → fix)
 */
export function getPipelineStages(storyPoints: number): PipelineStage[] {
  if (storyPoints <= 2) return ['exec', 'done'];
  if (storyPoints <= 4) return ['plan', 'exec', 'done'];
  return ['plan', 'exec', 'verify', 'done']; // fix injected dynamically if verify fails
}
