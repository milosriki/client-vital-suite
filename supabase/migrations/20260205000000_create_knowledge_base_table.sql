-- Create knowledge base table for RAG
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    category TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags TEXT[],
    embedding vector(1536),
    is_active BOOLEAN DEFAULT true
);

-- Index for searching
CREATE INDEX IF NOT EXISTS idx_kb_category ON public.knowledge_base(category);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Allow Service Role (Edge Function) full access
CREATE POLICY "Allow Service Role Full Access" ON public.knowledge_base
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow Read access for authenticated users (if needed for dashboard)
CREATE POLICY "Allow Authenticated Read" ON public.knowledge_base
FOR SELECT
USING (auth.role() = 'authenticated');
