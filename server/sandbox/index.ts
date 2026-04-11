/**
 * SandboxManager — create/destroy execution environments.
 *
 * Modes:
 * - none: direct execution in worktree (current behavior)
 * - docker: container-per-company, repo mounted
 * - e2b: stub for E2B cloud micro-VMs
 */

import type { SandboxMode, SandboxConfig, SandboxInstance } from './types';
import { createNoneSandbox } from './noneSandbox';
import { createDockerSandbox } from './dockerSandbox';
import { createE2BSandbox } from './e2bSandbox';

export type { SandboxMode, SandboxConfig, SandboxInstance, ExecResult } from './types';

// Active sandboxes for cleanup tracking
const activeSandboxes = new Map<string, SandboxInstance>();

/**
 * Create a sandbox for the given company/execution context.
 */
export async function createSandbox(
  cwd: string,
  config?: SandboxConfig,
): Promise<SandboxInstance> {
  const mode: SandboxMode = config?.mode ?? (process.env.SANDBOX_MODE as SandboxMode) ?? 'none';

  let sandbox: SandboxInstance;

  switch (mode) {
    case 'docker':
      sandbox = await createDockerSandbox(cwd, config);
      break;
    case 'e2b':
      sandbox = await createE2BSandbox(cwd, config);
      break;
    case 'none':
    default:
      sandbox = createNoneSandbox(cwd);
      break;
  }

  activeSandboxes.set(sandbox.id, sandbox);
  return sandbox;
}

/**
 * Cleanup a specific sandbox.
 */
export async function destroySandbox(sandboxId: string): Promise<void> {
  const sandbox = activeSandboxes.get(sandboxId);
  if (sandbox) {
    await sandbox.cleanup();
    activeSandboxes.delete(sandboxId);
  }
}

/**
 * Cleanup all active sandboxes (for graceful shutdown).
 */
export async function destroyAllSandboxes(): Promise<void> {
  const cleanups = Array.from(activeSandboxes.values()).map(s => s.cleanup().catch(() => {}));
  await Promise.all(cleanups);
  activeSandboxes.clear();
}

/**
 * Get count of active sandboxes.
 */
export function getActiveSandboxCount(): number {
  return activeSandboxes.size;
}
