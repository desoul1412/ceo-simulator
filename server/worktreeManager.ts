import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Manages git worktrees for isolated agent execution.
 * Each worker agent gets its own branch to avoid conflicts.
 */

const WORKTREE_DIR = '.agent-worktrees';

export function getWorktreeBase(cwd: string): string {
  return path.join(cwd, WORKTREE_DIR);
}

/**
 * Create a git worktree for a worker agent.
 * Returns the absolute path to the worktree directory.
 */
export function createWorktree(
  cwd: string,
  branchName: string,
): string {
  const base = getWorktreeBase(cwd);
  const worktreePath = path.join(base, branchName);

  // Ensure base directory exists
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }

  // If worktree already exists, return it
  if (fs.existsSync(worktreePath)) {
    return worktreePath;
  }

  try {
    // Create a new branch from origin/main (not current HEAD which may be stale)
    const startPoint = (() => {
      try {
        execSync('git rev-parse origin/main', { cwd, stdio: 'pipe' });
        return 'origin/main';
      } catch {
        return 'HEAD';
      }
    })();
    execSync(`git worktree add -b "${branchName}" "${worktreePath}" ${startPoint}`, {
      cwd,
      stdio: 'pipe',
    });
    console.log(`[worktree] Created: ${branchName} at ${worktreePath}`);
  } catch (err: any) {
    // Branch might already exist, try without -b
    try {
      execSync(`git worktree add "${worktreePath}" "${branchName}"`, {
        cwd,
        stdio: 'pipe',
      });
      console.log(`[worktree] Attached existing branch: ${branchName}`);
    } catch {
      console.error(`[worktree] Failed to create: ${err.message}`);
      // Fallback: use main cwd
      return cwd;
    }
  }

  return worktreePath;
}

/**
 * Remove a git worktree after task completion.
 */
export function removeWorktree(cwd: string, branchName: string): void {
  const worktreePath = path.join(getWorktreeBase(cwd), branchName);

  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd,
      stdio: 'pipe',
    });
    console.log(`[worktree] Removed: ${branchName}`);
  } catch (err: any) {
    console.warn(`[worktree] Failed to remove ${branchName}: ${err.message}`);
  }
}

/**
 * List all active worktrees.
 */
export function listWorktrees(cwd: string): string[] {
  try {
    const output = execSync('git worktree list --porcelain', { cwd, encoding: 'utf8' });
    const worktrees: string[] = [];
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        worktrees.push(line.replace('worktree ', ''));
      }
    }
    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Generate a branch name for an agent task.
 */
export function taskBranchName(role: string, taskSlug: string): string {
  const slug = taskSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)
    .replace(/^-|-$/g, '');
  return `agent/${role.toLowerCase()}-${slug}`;
}
