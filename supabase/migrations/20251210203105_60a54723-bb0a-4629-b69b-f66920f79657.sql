-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge documents table for RAG
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  content_chunks TEXT[] DEFAULT '{}',
  embedding vector(1536),  -- OpenAI embedding size
  metadata JSONB DEFAULT '{}',
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX knowledge_documents_embedding_idx 
ON public.knowledge_documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Allow public read/insert for knowledge documents
CREATE POLICY "Public read knowledge_documents" 
ON public.knowledge_documents FOR SELECT USING (true);

CREATE POLICY "Public insert knowledge_documents" 
ON public.knowledge_documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin manage knowledge_documents" 
ON public.knowledge_documents FOR ALL USING (is_admin());

-- Create storage bucket for uploaded files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('knowledge-files', 'knowledge-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public upload knowledge files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'knowledge-files');

CREATE POLICY "Public read knowledge files"
ON storage.objects FOR SELECT
USING (bucket_id = 'knowledge-files');