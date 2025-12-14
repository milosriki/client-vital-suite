-- Enable pgvector extension (if not already)
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base table with embeddings for RAG
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  source TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation summaries for long-term memory
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE,
  summary TEXT NOT NULL,
  key_points JSONB DEFAULT '[]'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding ON public.knowledge_base 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_embedding ON public.conversation_summaries 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source ON public.knowledge_base(source);

-- RLS policies
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.knowledge_base FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON public.conversation_summaries FOR ALL USING (true);

-- Enhanced search function for knowledge base
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  source text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base.metadata,
    knowledge_base.source,
    knowledge_base.category,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE knowledge_base.embedding IS NOT NULL
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Seed PTD knowledge base with initial data
INSERT INTO public.knowledge_base (content, metadata, source, category) VALUES
('PTD Fitness is Dubai''s premier mobile personal training company serving executives and professionals 40+. Founded in 2012, scaled from $0 to $15M in 4.5 years with 12,000+ transformations delivered.', '{"importance": "high"}', 'company-info', 'about'),
('PTD packages range from 3,520-41,616 AED with personalized training programs. We employ 55+ Masters certified coaches and have 600+ five-star reviews.', '{"importance": "high"}', 'pricing', 'services'),
('Client health scores calculate daily at 9:30 PM Dubai time based on engagement patterns, session attendance, response rates, and risk indicators.', '{"importance": "high"}', 'intelligence-hub', 'system'),
('The PTD Intelligence Hub integrates HubSpot CRM, Supabase Edge Functions, Supabase database, and AI agents for comprehensive business automation.', '{"importance": "high"}', 'intelligence-hub', 'system'),
('We focus on sustainable fitness transformations for busy professionals through mobile training, eliminating gym commute time.', '{"importance": "medium"}', 'company-info', 'services'),
('Our coaches are Masters certified with specialized training in executive wellness, injury prevention, and results-driven programming.', '{"importance": "medium"}', 'company-info', 'team'),
('PTD uses advanced health scoring to predict client churn risk and trigger automated interventions when engagement drops.', '{"importance": "high"}', 'intelligence-hub', 'features'),
('The business intelligence agent runs daily at 7 AM generating executive summaries with key metrics and action recommendations.', '{"importance": "medium"}', 'intelligence-hub', 'features'),
('Lead reply agent automatically responds to new HubSpot leads every 2 hours with personalized messages based on lead data.', '{"importance": "medium"}', 'automation', 'features'),
('HubSpot sync runs hourly keeping client data, deals, and lifecycle stages synchronized across all systems.', '{"importance": "medium"}', 'automation', 'features'),
('Health Zone Purple (85-100): Champions - highly engaged, excellent attendance, low churn risk.', '{"importance": "high"}', 'health-scoring', 'metrics'),
('Health Zone Green (70-84): Healthy - good engagement, regular sessions, moderate monitoring needed.', '{"importance": "high"}', 'health-scoring', 'metrics'),
('Health Zone Yellow (50-69): At Risk - declining engagement, missed sessions, intervention recommended.', '{"importance": "high"}', 'health-scoring', 'metrics'),
('Health Zone Red (0-49): Critical - high churn risk, urgent intervention required, revenue at risk.', '{"importance": "high"}', 'health-scoring', 'metrics'),
('Stripe fraud patterns to watch: Unknown cards after trusted payments, instant payouts bypassing settlement, test-then-drain pattern, multiple failed charges then success.', '{"importance": "high"}', 'security', 'stripe'),
('Lead response target is under 5 minutes for optimal conversion. Deals over 50K AED require approval.', '{"importance": "high"}', 'business-rules', 'sales'),
('No session in 14+ days triggers at-risk classification. Coach reassignment may be recommended for persistent engagement issues.', '{"importance": "high"}', 'business-rules', 'retention');