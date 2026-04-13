/**
 * Embedding module — generates vector embeddings for brain documents.
 * Uses OpenAI-compatible embedding API (works with OpenAI, OpenRouter, local Ollama).
 * Falls back gracefully if no embedding provider is configured.
 *
 * Config via env vars:
 *   EMBEDDING_API_URL=https://api.openai.com/v1/embeddings  (or OpenRouter, Ollama)
 *   EMBEDDING_API_KEY=sk-...
 *   EMBEDDING_MODEL=text-embedding-3-small
 *   EMBEDDING_DIMS=1536
 */

const EMBEDDING_URL = process.env.EMBEDDING_API_URL ?? '';
const EMBEDDING_KEY = process.env.EMBEDDING_API_KEY ?? '';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMS ?? '1536', 10);

let _enabled: boolean | null = null;

export function isEmbeddingEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  _enabled = !!(EMBEDDING_URL && EMBEDDING_KEY);
  if (_enabled) {
    console.log(`[embeddings] Enabled: ${EMBEDDING_MODEL} via ${EMBEDDING_URL}`);
  } else {
    console.log('[embeddings] Disabled (EMBEDDING_API_URL or EMBEDDING_API_KEY not set). Brain docs will not have vector embeddings.');
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
    const res = await fetch(EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EMBEDDING_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: truncated,
        dimensions: EMBEDDING_DIMS,
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
