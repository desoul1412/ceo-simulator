/**
 * NoneSandbox — pass-through sandbox (no isolation).
 * Current behavior: executes directly in worktree directory.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { SandboxInstance, ExecResult } from './types';

const execFileAsync = promisify(execFile);

export function createNoneSandbox(cwd: string): SandboxInstance {
  const id = `none-${Date.now()}`;

  return {
    id,
    mode: 'none',
    cwd,

    async exec(command: string, args: string[] = []): Promise<ExecResult> {
      const start = Date.now();
      try {
        const { stdout, stderr } = await execFileAsync(command, args, {
          cwd,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return { exitCode: 0, stdout, stderr, durationMs: Date.now() - start };
      } catch (err: any) {
        return {
          exitCode: err.code ?? 1,
          stdout: err.stdout ?? '',
          stderr: err.stderr ?? err.message,
          durationMs: Date.now() - start,
        };
      }
    },

    async writeFile(filePath: string, content: string): Promise<void> {
      const fullPath = path.resolve(cwd, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    },

    async readFile(filePath: string): Promise<string> {
      const fullPath = path.resolve(cwd, filePath);
      return fs.readFile(fullPath, 'utf8');
    },

    async cleanup(): Promise<void> {
      // No-op for none sandbox
    },
  };
}
