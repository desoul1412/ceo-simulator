-- Update brain search function to support agent-scoped queries.
-- Adds filter_agent_id param (was missing, brainSearch.ts already passes it).

CREATE OR REPLACE FUNCTION search_brain_documents(
  query_embedding TEXT,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5,
  filter_company_id UUID DEFAULT NULL,
  filter_agent_id UUID DEFAULT NULL,
  filter_doc_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  path TEXT,
  doc_type TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bd.id,
    bd.path,
    bd.doc_type,
    bd.content,
    bd.updated_at,
    1 - (bd.embedding <=> query_embedding::vector) AS similarity
  FROM brain_documents bd
  WHERE
    bd.embedding IS NOT NULL
    AND 1 - (bd.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_company_id IS NULL OR bd.company_id = filter_company_id)
    AND (filter_agent_id IS NULL OR bd.agent_id = filter_agent_id)
    AND (filter_doc_type IS NULL OR bd.doc_type = filter_doc_type)
  ORDER BY bd.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;
