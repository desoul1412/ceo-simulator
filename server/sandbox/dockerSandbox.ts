/**
 * DockerSandbox — container-per-company execution isolation.
 * Mounts the company repo into a container and executes commands via docker exec.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { SandboxInstance, SandboxConfig, ExecResult } from './types';

const execFileAsync = promisify(execFile);

const DEFAULT_IMAGE = 'node:22-alpine';
const DEFAULT_TIMEOUT = 300_000; // 5 minutes
const DEFAULT_MEMORY = 512; // MB

export async function createDockerSandbox(
  cwd: string,
  config: SandboxConfig = { mode: 'docker' },
): Promise<SandboxInstance> {
  const containerId = `ceosim-sandbox-${Date.now()}`;
  const image = config.image ?? DEFAULT_IMAGE;
  const memoryMb = config.memoryMb ?? DEFAULT_MEMORY;
  const cpus = config.cpus ?? 1;

  // Start container with repo mounted
  try {
    await execFileAsync('docker', [
      'run', '-d',
      '--name', containerId,
      '--memory', `${memoryMb}m`,
      '--cpus', String(cpus),
      '-v', `${cwd}:/workspace`,
      '-w', '/workspace',
      image,
      'tail', '-f', '/dev/null', // Keep container running
    ], { timeout: 30_000 });
  } catch (err: any) {
    throw new Error(`Failed to create Docker sandbox: ${err.stderr ?? err.message}`);
  }

  // Install git in container
  await execFileAsync('docker', ['exec', containerId, 'apk', 'add', '--no-cache', 'git'], {
    timeout: 60_000,
  }).catch(() => {}); // Best effort

  return {
    id: containerId,
    mode: 'docker',
    cwd: '/workspace',

    async exec(command: string, args: string[] = []): Promise<ExecResult> {
      const start = Date.now();
      const timeout = config.timeout ?? DEFAULT_TIMEOUT;
      try {
        const { stdout, stderr } = await execFileAsync('docker', [
          'exec', containerId, command, ...args,
        ], { timeout, maxBuffer: 10 * 1024 * 1024 });

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
      // Write via docker exec with echo (safe for small files)
      const encoded = Buffer.from(content).toString('base64');
      await execFileAsync('docker', [
        'exec', containerId, 'sh', '-c',
        `echo '${encoded}' | base64 -d > /workspace/${filePath}`,
      ], { timeout: 10_000 });
    },

    async readFile(filePath: string): Promise<string> {
      const { stdout } = await execFileAsync('docker', [
        'exec', containerId, 'cat', `/workspace/${filePath}`,
      ], { timeout: 10_000 });
      return stdout;
    },

    async cleanup(): Promise<void> {
      try {
        await execFileAsync('docker', ['rm', '-f', containerId], { timeout: 15_000 });
      } catch {
        console.warn(`[sandbox] Failed to cleanup container ${containerId}`);
      }
    },
  };
}
