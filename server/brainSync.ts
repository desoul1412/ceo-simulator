/**
 * Brain Sync — PostgreSQL-primary brain/memory layer.
 *
 * Supabase `brain_documents` table is the single source of truth.
 * Local brain/ filesystem mirror is OFF by default (set BRAIN_SYNC_ENABLED=true to enable).
 * Uses the same paperclip Supabase project — no separate brain project needed.
 */

import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseAdmin';
import { generateEmbedding, isEmbeddingEnabled } from './llm/embeddings';

const BRAIN_ROOT = path.join(process.cwd(), 'brain');
const LOCAL_SYNC = process.env.BRAIN_SYNC_ENABLED === 'true'; // default OFF

interface BrainMeta {
  companyId?: string;
  agentId?: string;
  docType: 'soul' | 'context' | 'memory' | 'plan' | 'wiki' | 'changelog' | 'index' | 'summary' | 'sprint' | 'general';
}

/**
 * Write a brain document.
 * - Supabase brain_documents (always — primary)
 * - Local filesystem (only if BRAIN_SYNC_ENABLED=true)
 */
export async function writeBrain(
  docPath: string,
  content: string,
  meta: BrainMeta,
): Promise<void> {
  // 1. Supabase (primary — always)
  try {
    const row: any = {
      path: docPath,
      content,
      company_id: meta.companyId ?? null,
      agent_id: meta.agentId ?? null,
      doc_type: meta.docType,
      updated_at: new Date().toISOString(),
    };

    // Auto-embed if embedding provider is configured
    if (isEmbeddingEnabled() && content.length > 20) {
      const embedding = await generateEmbedding(content);
      if (embedding) {
        row.embedding = JSON.stringify(embedding);
      }
    }

    await supabase.from('brain_documents').upsert(row, { onConflict: 'path' });
  } catch (err: any) {
    console.warn(`[brain-sync] Supabase write failed for ${docPath}:`, err.message);
  }

  // 2. Local filesystem mirror (optional)
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
 * Append to a brain document.
 */
export async function appendBrain(
  docPath: string,
  appendContent: string,
  meta: BrainMeta,
): Promise<void> {
  const existing = await readBrain(docPath);
  const newContent = existing ? existing + appendContent : appendContent;
  await writeBrain(docPath, newContent, meta);
}

/**
 * Read a brain document. Supabase primary, local fallback.
 */
export async function readBrain(docPath: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('brain_documents')
      .select('content')
      .eq('path', docPath)
      .single();
    if (data) return (data as any).content;
  } catch { /* fall through to local */ }

  // Local fallback
  if (LOCAL_SYNC) {
    try {
      return fs.readFileSync(path.join(BRAIN_ROOT, docPath), 'utf8');
    } catch { /* */ }
  }
  return null;
}

/**
 * List brain documents by prefix or filters.
 */
export async function listBrain(opts: {
  prefix?: string;
  companyId?: string;
  agentId?: string;
  docType?: string;
}): Promise<{ path: string; doc_type: string; updated_at: string }[]> {
  try {
    let query = supabase.from('brain_documents').select('path, doc_type, updated_at');
    if (opts.prefix) query = query.like('path', `${opts.prefix}%`);
    if (opts.companyId) query = query.eq('company_id', opts.companyId);
    if (opts.agentId) query = query.eq('agent_id', opts.agentId);
    if (opts.docType) query = query.eq('doc_type', opts.docType);
    const { data } = await query.order('updated_at', { ascending: false });
    return (data ?? []) as any[];
  } catch {
    return [];
  }
}

/**
 * Sync all brain docs from Supabase → local filesystem.
 * Called on orchestrator startup if BRAIN_SYNC_ENABLED=true.
 */
export async function syncFromSupabase(): Promise<number> {
  if (!LOCAL_SYNC) return 0;
  try {
    const { data } = await supabase.from('brain_documents').select('path, content');
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
    console.warn('[brain-sync] Sync failed:', err.message);
    return 0;
  }
}
