/**
 * E2BSandbox — stub for E2B cloud micro-VM execution.
 * Will be implemented when E2B integration is needed.
 */

import type { SandboxInstance, SandboxConfig, ExecResult } from './types';

export async function createE2BSandbox(
  _cwd: string,
  _config: SandboxConfig = { mode: 'e2b' },
): Promise<SandboxInstance> {
  const id = `e2b-${Date.now()}`;

  // Stub implementation — returns not-implemented errors
  return {
    id,
    mode: 'e2b',
    cwd: '/workspace',

    async exec(_command: string, _args: string[] = []): Promise<ExecResult> {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'E2B sandbox not yet implemented. Set SANDBOX_MODE=none or docker.',
        durationMs: 0,
      };
    },

    async writeFile(_path: string, _content: string): Promise<void> {
      throw new Error('E2B sandbox not yet implemented');
    },

    async readFile(_path: string): Promise<string> {
      throw new Error('E2B sandbox not yet implemented');
    },

    async cleanup(): Promise<void> {
      // No-op for stub
    },
  };
}
