/**
 * Input validation for tool calls — blocks path traversal, secret patterns, dangerous commands.
 *
 * Patterns: ruflo schema-gate, claude-code-templates supply-chain guard.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

// ── Path Safety ──────────────────────────────────────────────────────────────

const BLOCKED_PATH_PATTERNS = [
  /\.\.\//,           // directory traversal
  /^~\//,             // home directory escape
  /^\/etc\//,         // system config
  /^\/usr\//,         // system binaries
  /^\/var\//,         // system logs
  /^\/root\//,        // root home
  /^\/proc\//,        // proc filesystem
  /\.env$/,           // environment files
  /credentials/i,     // credential files
  /\.ssh\//,          // SSH keys
  /\.aws\//,          // AWS credentials
];

function isPathSafe(path: string): ValidationResult {
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return {
        valid: false,
        blocked: true,
        blockReason: `Path blocked by security policy: ${pattern}`,
        error: `Unsafe path: ${path}`,
      };
    }
  }
  return { valid: true };
}

// ── Secret Detection (supply-chain guard) ────────────────────────────────────

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,          // Anthropic/OpenAI keys
  /ghp_[a-zA-Z0-9]{36,}/,         // GitHub PATs
  /AKIA[A-Z0-9]{16}/,             // AWS access keys
  /xox[bpras]-[a-zA-Z0-9-]+/,     // Slack tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ/,       // JWTs (non-exhaustive)
];

function checkForSecrets(content: string): ValidationResult {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return {
        valid: false,
        blocked: true,
        blockReason: `Output contains potential secret pattern: ${pattern}`,
        error: 'Content contains potential secrets',
      };
    }
  }
  return { valid: true };
}

// ── Tool-Specific Validation ─────────────────────────────────────────────────

const TOOL_VALIDATORS: Record<string, (input: Record<string, unknown>) => ValidationResult> = {
  Read(input) {
    const path = input.file_path as string;
    if (!path) return { valid: false, error: 'Missing file_path' };
    return isPathSafe(path);
  },

  Write(input) {
    const path = input.file_path as string;
    if (!path) return { valid: false, error: 'Missing file_path' };
    const pathCheck = isPathSafe(path);
    if (!pathCheck.valid) return pathCheck;

    const content = input.content as string;
    if (content) return checkForSecrets(content);
    return { valid: true };
  },

  Edit(input) {
    const path = input.file_path as string;
    if (!path) return { valid: false, error: 'Missing file_path' };
    return isPathSafe(path);
  },

  Bash(input) {
    const cmd = input.command as string;
    if (!cmd) return { valid: false, error: 'Missing command' };

    // Block obviously dangerous commands
    const BLOCKED_COMMANDS = [
      /rm\s+-rf\s+\//,       // rm -rf /
      /mkfs/,                 // format filesystem
      /dd\s+if=/,             // raw disk write
      /:(){ :|:& };:/,       // fork bomb
      /curl.*\|\s*sh/,       // pipe curl to shell
      /wget.*\|\s*sh/,       // pipe wget to shell
    ];

    for (const pattern of BLOCKED_COMMANDS) {
      if (pattern.test(cmd)) {
        return {
          valid: false,
          blocked: true,
          blockReason: `Dangerous command blocked: ${pattern}`,
          error: `Blocked command: ${cmd.slice(0, 50)}`,
        };
      }
    }

    return { valid: true };
  },

  Glob(input) {
    const path = input.path as string;
    if (path) return isPathSafe(path);
    return { valid: true };
  },

  Grep(input) {
    const path = input.path as string;
    if (path) return isPathSafe(path);
    return { valid: true };
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

export function validateToolInput(toolName: string, input: Record<string, unknown>): ValidationResult {
  const validator = TOOL_VALIDATORS[toolName];
  if (!validator) return { valid: true }; // no validator = pass through
  return validator(input);
}

/** Scan output text for leaked secrets */
export function scanOutputForSecrets(output: string): ValidationResult {
  return checkForSecrets(output);
}
