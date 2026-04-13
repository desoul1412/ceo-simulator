/**
 * Brain Sync — dual-write to Supabase brain project (always) + local filesystem (optional).
 *
 * Supabase brain project is the primary store.
 * Local brain/ directory is an optional mirror for Obsidian viewing.
 * If brain project is not configured, falls back to local-only.
 */

import fs from 'fs';
import path from 'path';
import { brainSupabase, isBrainConfigured } from './brainSupabase';

const BRAIN_ROOT = path.join(process.cwd(), 'brain');
const LOCAL_SYNC = process.env.BRAIN_SYNC_ENABLED !== 'false'; // default true

interface BrainMeta {
  companyId?: string;
  agentId?: string;
  docType: 'soul' | 'context' | 'memory' | 'plan' | 'wiki' | 'changelog' | 'index' | 'summary' | 'sprint' | 'general';
}

/**
 * Write a brain document.
 * - Supabase brain project (if configured): always
 * - Local filesystem: if BRAIN_SYNC_ENABLED
 */
export async function writeBrain(
  docPath: string,
  content: string,
  meta: BrainMeta,
): Promise<void> {
  // 1. Supabase brain project (primary)
  if (isBrainConfigured() && brainSupabase) {
    try {
      await brainSupabase.from('brain_documents').upsert({
        path: docPath,
        content,
        company_id: meta.companyId ?? null,
        agent_id: meta.agentId ?? null,
        doc_type: meta.docType,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'path' });
    } catch (err: any) {
      console.warn(`[brain-sync] Supabase write failed for ${docPath}:`, err.message);
    }
  }

  // 2. Local filesystem mirror
  if (LOCAL_SYNC) {
    try {
      const fullPath = path.join(BRAIN_ROOT, docPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    } catch (err: any) {
      console.warn(`[brain-sync] Local write failed for ${docPath}:`, err.message);
    }
  }
}

/**
 * Append to a brain document (e.g., memory.md entries).
 */
export async function appendBrain(
  docPath: string,
  appendContent: string,
  meta: BrainMeta,
): Promise<void> {
  // Read existing content first
  const existing = await readBrain(docPath);
  const newContent = existing ? existing + appendContent : appendContent;
  await writeBrain(docPath, newContent, meta);
}

/**
 * Read a brain document.
 * Supabase primary, local fallback.
 */
export async function readBrain(docPath: string): Promise<string | null> {
  // 1. Try Supabase
  if (isBrainConfigured() && brainSupabase) {
    try {
      const { data } = await brainSupabase
        .from('brain_documents')
        .select('content')
        .eq('path', docPath)
        .single();
      if (data) return (data as any).content;
    } catch { /* fall through to local */ }
  }

  // 2. Local fallback
  try {
    const fullPath = path.join(BRAIN_ROOT, docPath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * List brain documents by prefix.
 */
export async function listBrain(prefix: string): Promise<string[]> {
  if (isBrainConfigured() && brainSupabase) {
    try {
      const { data } = await brainSupabase
        .from('brain_documents')
        .select('path')
        .like('path', `${prefix}%`);
      return (data ?? []).map((d: any) => d.path);
    } catch { /* fall through */ }
  }

  // Local fallback
  try {
    const dir = path.join(BRAIN_ROOT, prefix);
    if (!fs.existsSync(dir)) return [];
    const entries: string[] = [];
    function walk(d: string, rel: string) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const fullRel = path.join(rel, entry.name);
        if (entry.isDirectory()) walk(path.join(d, entry.name), fullRel);
        else entries.push(path.join(prefix, fullRel).replace(/\\/g, '/'));
      }
    }
    walk(dir, '');
    return entries;
  } catch {
    return [];
  }
}

/**
 * Sync all brain documents from Supabase to local filesystem.
 * Used on orchestrator startup.
 */
export async function syncFromSupabase(): Promise<number> {
  if (!isBrainConfigured() || !brainSupabase) return 0;
  if (!LOCAL_SYNC) return 0;

  try {
    const { data } = await brainSupabase.from('brain_documents').select('path, content');
    if (!data) return 0;

    let count = 0;
    for (const doc of data as any[]) {
      const fullPath = path.join(BRAIN_ROOT, doc.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, doc.content, 'utf8');
      count++;
    }
    console.log(`[brain-sync] Synced ${count} documents from Supabase to local`);
    return count;
  } catch (err: any) {
    console.warn('[brain-sync] Sync from Supabase failed:', err.message);
    return 0;
  }
}
