/**
 * Embedding module — generates vector embeddings for brain documents.
 * Uses OpenAI-compatible embedding API.
 *
 * Supported providers (set via env vars):
 *   Ollama (local, free):  EMBEDDING_API_URL=http://localhost:11434/v1/embeddings
 *                          EMBEDDING_MODEL=nomic-embed-text  EMBEDDING_DIMS=768
 *   OpenAI:               EMBEDDING_API_URL=https://api.openai.com/v1/embeddings
 *                          EMBEDDING_API_KEY=sk-...  EMBEDDING_MODEL=text-embedding-3-small
 *   Voyage AI:            EMBEDDING_API_URL=https://api.voyageai.com/v1/embeddings
 *                          EMBEDDING_API_KEY=pa-...  EMBEDDING_MODEL=voyage-3-lite
 *
 * Falls back gracefully (text search) if EMBEDDING_API_URL is not set.
 */

const EMBEDDING_URL = process.env.EMBEDDING_API_URL ?? '';
const EMBEDDING_KEY = process.env.EMBEDDING_API_KEY ?? ''; // optional for Ollama
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'nomic-embed-text';
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS ?? '768', 10);

let _enabled: boolean | null = null;

export function isEmbeddingEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  _enabled = !!EMBEDDING_URL; // key is optional (Ollama doesn't require one)
  if (_enabled) {
    console.log(`[embeddings] Enabled: ${EMBEDDING_MODEL} @ ${EMBEDDING_URL}`);
  } else {
    console.log('[embeddings] Disabled (EMBEDDING_API_URL not set) — using text search fallback.');
  }
  return _enabled;
}

export function getEmbeddingDims(): number {
  return EMBEDDING_DIMS;
}

/**
 * Generate an embedding vector for text content.
 * Returns null if embedding is not configured or fails.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!isEmbeddingEnabled()) return null;

  // Truncate to avoid token limits (~8k tokens ≈ 32k chars for most models)
  const truncated = text.slice(0, 30000);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (EMBEDDING_KEY) headers['Authorization'] = `Bearer ${EMBEDDING_KEY}`;

    const res = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: truncated,
        // dimensions only sent when explicitly configured (ignored by Ollama)
        ...(process.env.EMBEDDING_DIMS ? { dimensions: EMBEDDING_DIMS } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[embeddings] API error ${res.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await res.json() as any;
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      console.warn('[embeddings] Unexpected response format');
      return null;
    }
    return embedding;
  } catch (err: any) {
    console.warn(`[embeddings] Failed: ${err.message}`);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!isEmbeddingEnabled()) return texts.map(() => null);

  // Process in parallel batches of 10
  const results: (number[] | null)[] = [];
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(t => generateEmbedding(t)));
    results.push(...batchResults);
  }
  return results;
}
