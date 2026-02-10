-- Migration for Vector RAG

create extension if not exists vector;

alter table knowledge_documents add column if not exists embedding vector(768);

create index on knowledge_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_knowledge_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
stable
as 14462
begin
  return query
  select
    knowledge_documents.id,
    knowledge_documents.content,
    1 - (knowledge_documents.embedding <=> query_embedding) as similarity
  from knowledge_documents
  where 1 - (knowledge_documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
14462;
