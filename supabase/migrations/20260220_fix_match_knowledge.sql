CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  category text,
  question text,
  answer text,
  tags jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.category,
    k.question,
    k.answer,
    k.tags,
    (1 - (k.embedding <=> query_embedding))::float AS similarity
  FROM knowledge_base k
  WHERE k.is_active = true
    AND k.embedding IS NOT NULL
    AND (1 - (k.embedding <=> query_embedding)) > match_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
