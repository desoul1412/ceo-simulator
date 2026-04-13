import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseAdmin';

const REPOS_BASE = path.resolve(process.cwd(), '.company-repos');

/** Allowlist: branch names may only contain safe git ref characters. */
const SAFE_BRANCH_RE = /^[a-zA-Z0-9._\-\/]+$/;
function validateBranch(branch: string): void {
  if (!SAFE_BRANCH_RE.test(branch)) {
    throw new Error(`Invalid branch name "${branch}": only alphanumeric, dots, hyphens, underscores and slashes are allowed.`);
  }
}

/**
 * Get the local filesystem path for a company's repo.
 */
export function getRepoPath(companyId: string): string {
  return path.join(REPOS_BASE, companyId);
}

/**
 * Clone or pull a company's Git repository.
 * Returns the local path to the repo.
 */
export async function ensureRepo(companyId: string): Promise<string> {
  // Fetch company repo config
  const { data: company } = await supabase
    .from('companies')
    .select('repo_url, repo_branch, git_auth_method, git_token_encrypted, repo_path')
    .eq('id', companyId)
    .single();

  if (!company) throw new Error(`Company ${companyId} not found`);
  const co = company as any;

  // If no repo URL, use the ceo-simulator's own cwd as fallback
  if (!co.repo_url) {
    return process.cwd();
  }

  const repoDir = co.repo_path || getRepoPath(companyId);

  // Build authenticated URL if PAT is provided
  let authUrl = co.repo_url;
  if (co.git_auth_method === 'pat' && co.git_token_encrypted) {
    // Insert token into HTTPS URL: https://TOKEN@github.com/user/repo.git
    authUrl = co.repo_url.replace('https://', `https://${co.git_token_encrypted}@`);
  }

  const branch = co.repo_branch || 'main';
  validateBranch(branch); // reject shell-injectable values early

  // Ensure base directory exists
  if (!fs.existsSync(REPOS_BASE)) {
    fs.mkdirSync(REPOS_BASE, { recursive: true });
  }

  try {
    if (fs.existsSync(path.join(repoDir, '.git'))) {
      // Repo already cloned — pull latest
      await updateRepoStatus(companyId, 'ready');
      try {
        // Use execFileSync (array args) — no shell, immune to injection
        execFileSync('git', ['-C', repoDir, 'fetch', 'origin'], { stdio: 'pipe', timeout: 60000 });
        execFileSync('git', ['-C', repoDir, 'reset', '--hard', `origin/${branch}`], { stdio: 'pipe', timeout: 60000 });
        await supabase.from('companies').update({
          repo_last_synced_at: new Date().toISOString(),
        }).eq('id', companyId);
      } catch (pullErr: any) {
        console.warn(`[repo] Pull failed for ${companyId}: ${pullErr.message}`);
        // Still usable — just couldn't pull latest
      }
    } else {
      // Clone fresh
      await updateRepoStatus(companyId, 'cloning');
      console.log(`[repo] Cloning ${co.repo_url} → ${repoDir}`);

      execFileSync('git', ['clone', '--branch', branch, '--single-branch', authUrl, repoDir], {
        stdio: 'pipe',
        timeout: 120000,
      });

      // Store the repo path
      await supabase.from('companies').update({
        repo_path: repoDir,
        repo_status: 'ready',
        repo_last_synced_at: new Date().toISOString(),
        repo_error: null,
      }).eq('id', companyId);

      console.log(`[repo] Cloned successfully: ${repoDir}`);
    }

    return repoDir;
  } catch (err: any) {
    await updateRepoStatus(companyId, 'error', err.message);
    throw new Error(`Failed to setup repo: ${err.message}`);
  }
}

/**
 * Update repo status in DB.
 */
async function updateRepoStatus(companyId: string, status: string, error?: string) {
  await supabase.from('companies').update({
    repo_status: status,
    repo_error: error || null,
  }).eq('id', companyId);
}

/**
 * Get the working directory for a company's agents.
 * Falls back to ceo-simulator cwd if no repo is connected.
 */
export async function getCompanyCwd(companyId: string): Promise<string> {
  const { data: company } = await supabase
    .from('companies')
    .select('repo_url, repo_path')
    .eq('id', companyId)
    .single();

  const co = company as any;

  // If company has a connected repo, use its path
  if (co?.repo_url && co?.repo_path && fs.existsSync(co.repo_path)) {
    return co.repo_path;
  }

  // If repo URL is set but not cloned yet, clone it
  if (co?.repo_url) {
    return ensureRepo(companyId);
  }

  // No repo connected — use server's cwd
  return process.cwd();
}

/**
 * Sync (pull latest) for a company's repo.
 */
export async function syncRepo(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureRepo(companyId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * List all cloned company repos.
 */
export function listRepos(): { companyId: string; path: string; exists: boolean }[] {
  if (!fs.existsSync(REPOS_BASE)) return [];
  return fs.readdirSync(REPOS_BASE).map(dir => ({
    companyId: dir,
    path: path.join(REPOS_BASE, dir),
    exists: fs.existsSync(path.join(REPOS_BASE, dir, '.git')),
  }));
}
