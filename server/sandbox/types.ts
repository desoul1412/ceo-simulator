/**
 * Sandbox types — execution environment abstraction.
 */

export type SandboxMode = 'none' | 'docker' | 'e2b';

export interface SandboxConfig {
  mode: SandboxMode;
  image?: string;     // Docker image name
  timeout?: number;   // Max execution time in ms
  memoryMb?: number;  // Memory limit
  cpus?: number;      // CPU limit
}

export interface SandboxInstance {
  id: string;
  mode: SandboxMode;
  cwd: string;
  /** Execute a command inside the sandbox. */
  exec(command: string, args?: string[]): Promise<ExecResult>;
  /** Write a file inside the sandbox. */
  writeFile(path: string, content: string): Promise<void>;
  /** Read a file from the sandbox. */
  readFile(path: string): Promise<string>;
  /** Cleanup and destroy the sandbox. */
  cleanup(): Promise<void>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}
