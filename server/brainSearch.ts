/**
 * Brain Search — semantic similarity search over brain_documents using pgvector.
 * Provides both API endpoint logic and a function agents can use.
 */

import { supabase } from './supabaseAdmin';
import { generateEmbedding, isEmbeddingEnabled } from './llm/embeddings';
import { escapeLike } from './utils';

export interface SearchResult {
  id: string;
  path: string;
  doc_type: string;
  content: string;
  score: number;
  updated_at: string;
}

/**
 * Semantic search: find brain documents similar to a query.
 * Uses pgvector cosine distance (<=>).
 * Falls back to text search if embeddings are not configured.
 */
export async function searchBrain(
  query: string,
  opts: {
    companyId?: string;
    agentId?: string;
    docType?: string;
    limit?: number;
    minScore?: number;
  } = {},
): Promise<SearchResult[]> {
  const limit = opts.limit ?? 5;
  const minScore = opts.minScore ?? 0.3;

  // Try vector search first
  if (isEmbeddingEnabled()) {
    const embedding = await generateEmbedding(query);
    if (embedding) {
      return vectorSearch(embedding, opts.companyId, opts.agentId, opts.docType, limit, minScore);
    }
  }

  // Fallback: text search (ILIKE)
  return textSearch(query, opts.companyId, opts.agentId, opts.docType, limit);
}

async function vectorSearch(
  embedding: number[],
  companyId?: string,
  agentId?: string,
  docType?: string,
  limit = 5,
  minScore = 0.3,
): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase.rpc('search_brain_documents', {
      query_embedding: JSON.stringify(embedding),
      match_threshold: minScore,
      match_count: limit,
      filter_company_id: companyId ?? null,
      filter_agent_id: agentId ?? null,
      filter_doc_type: docType ?? null,
    });

    if (error) {
      console.warn('[brain-search] RPC error, falling back to text search:', error.message);
      return [];
    }

    return (data ?? []).map((r: any) => ({
      id: r.id,
      path: r.path,
      doc_type: r.doc_type,
      content: r.content,
      score: r.similarity,
      updated_at: r.updated_at,
    }));
  } catch (err: any) {
    console.warn('[brain-search] Vector search failed:', err.message);
    return [];
  }
}

async function textSearch(
  query: string,
  companyId?: string,
  agentId?: string,
  docType?: string,
  limit = 5,
): Promise<SearchResult[]> {
  try {
    let q = supabase.from('brain_documents').select('id, path, doc_type, content, updated_at');
    if (companyId) q = q.eq('company_id', companyId);
    if (agentId) q = q.eq('agent_id', agentId);
    if (docType) q = q.eq('doc_type', docType);
    if (query.length < 3) return []; // too short for text search
    q = q.ilike('content', `%${escapeLike(query)}%`);
    const { data } = await q.order('updated_at', { ascending: false }).limit(limit);
    return (data ?? []).map((r: any) => ({ ...r, score: 1.0 }));
  } catch {
    return [];
  }
}

/**
 * Build a memory context string for an agent from relevant brain documents.
 * Used to inject relevant past knowledge into agent prompts.
 */
export async function buildMemoryContext(
  task: string,
  companyId: string,
  agentId?: string,
  maxDocs = 3,
): Promise<string> {
  const results = await searchBrain(task, { companyId, limit: maxDocs });
  if (results.length === 0) return '';

  const sections = results.map(r =>
    `--- ${r.path} (${r.doc_type}, score: ${r.score.toFixed(2)}) ---\n${r.content.slice(0, 1000)}`
  );

  return `\n## Relevant Memory (from brain)\n${sections.join('\n\n')}`;
}
