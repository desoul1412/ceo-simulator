---
tags: [skill, library, ai, rag, retrieval]
id: rag-systems
role: AI Engineer
status: active
date: 2026-04-10
---

# RAG Systems

**Description:** Build Retrieval-Augmented Generation systems. Chunking, embedding, vector storage, retrieval, reranking, and context assembly. Measure retrieval quality before deploying.

**Tools:** Read, Edit, Write, Bash, Grep, Supabase MCP (execute_sql, list_extensions), Context7 MCP

**System Prompt Injection:**
```
When building RAG systems:
1. CHUNKING STRATEGY:
   - Chunk size: 512-1024 tokens. Smaller for precise retrieval, larger for more context.
   - Overlap: 50-100 tokens between chunks to preserve context at boundaries.
   - Respect document boundaries: never split mid-sentence or mid-paragraph.
   - Add metadata to each chunk: source document, section title, page number, chunk index.
2. EMBEDDING:
   - Use the latest embedding model from the chosen provider.
   - Normalize vectors before storage.
   - Store in pgvector (Supabase): enable the vector extension, create a column with appropriate dimensions.
   - Create an HNSW index for fast approximate nearest neighbor search.
3. RETRIEVAL:
   - Hybrid search: combine semantic similarity (vector cosine distance) with keyword matching (tsvector full-text search).
   - Retrieve top-k candidates (k=20), then rerank to top-n (n=5).
   - Reranking: use a cross-encoder or LLM-based reranker for better relevance.
4. CONTEXT ASSEMBLY:
   - Pack retrieved chunks into the prompt. Most relevant first.
   - Include source metadata for citations (document name, section, page).
   - Stay within context window limits. Measure total tokens before sending.
   - Use prompt caching for the system prompt portion.
5. EVALUATION:
   - Retrieval metrics: precision@k, recall@k, MRR (mean reciprocal rank).
   - End-to-end metrics: answer correctness, faithfulness (no hallucination), citation accuracy.
   - Build an eval set of 50+ questions with known-good answers and source passages.
   - Measure BEFORE deploying. Iterate on chunking/retrieval until metrics meet threshold.
6. MONITORING:
   - Log: query, retrieved chunks, generated answer, latency, token count.
   - Track retrieval quality over time (are answers degrading?).
   - Alert on: empty retrievals, low similarity scores, high latency.
```

**Anti-Patterns:**
- Deploying RAG without evaluation (must measure retrieval quality first)
- Chunks that split mid-sentence or ignore document structure
- Vector search only (hybrid search with keywords consistently outperforms)
- No reranking (top-k retrieval alone has poor precision)
- Missing source citations in generated answers
- No monitoring for retrieval quality degradation

**Verification Steps:**
- [ ] Chunking respects document boundaries (no mid-sentence splits)
- [ ] Chunks include metadata (source, section, page, index)
- [ ] pgvector enabled with HNSW index on Supabase
- [ ] Hybrid search implemented (vector + full-text)
- [ ] Reranking applied to top-k candidates
- [ ] Eval set of 50+ questions with known answers created
- [ ] Precision@k and recall@k measured and above threshold
- [ ] Source citations included in generated answers
