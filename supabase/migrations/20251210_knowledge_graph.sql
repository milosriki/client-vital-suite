-- ============================================
-- PTD KNOWLEDGE GRAPH SYSTEM
-- Entity relationships for smarter reasoning
-- ============================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ENTITY NODES
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'client', 'coach', 'deal', 'campaign', 'lead', 'product'
  entity_id TEXT NOT NULL,
  name TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique entity type + entity id combination
  CONSTRAINT unique_entity UNIQUE (entity_type, entity_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_entity_type ON public.knowledge_nodes(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_entity_id ON public.knowledge_nodes(entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_name ON public.knowledge_nodes(name);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_embedding ON public.knowledge_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- RELATIONSHIP EDGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  to_node UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- 'trained_by', 'purchased', 'referred_by', 'belongs_to_campaign', 'assigned_to', 'converted_from'
  weight FLOAT DEFAULT 1.0,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate edges
  CONSTRAINT unique_edge UNIQUE (from_node, to_node, relationship)
);

-- Create indexes for graph traversal
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from_node ON public.knowledge_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_to_node ON public.knowledge_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_relationship ON public.knowledge_edges(relationship);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_weight ON public.knowledge_edges(weight DESC);

-- ============================================
-- GRAPH PATH CACHE (for frequently queried paths)
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_node UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  end_node UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  path_nodes UUID[] NOT NULL,
  path_relationships TEXT[] NOT NULL,
  total_weight FLOAT,
  path_length INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_knowledge_paths_start ON public.knowledge_paths(start_node);
CREATE INDEX IF NOT EXISTS idx_knowledge_paths_end ON public.knowledge_paths(end_node);
CREATE INDEX IF NOT EXISTS idx_knowledge_paths_expires ON public.knowledge_paths(expires_at);

-- ============================================
-- GRAPH INSIGHTS (derived patterns)
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL, -- 'pattern', 'anomaly', 'cluster', 'trend'
  title TEXT NOT NULL,
  description TEXT,
  affected_nodes UUID[],
  confidence FLOAT DEFAULT 0.5,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_knowledge_insights_type ON public.knowledge_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_insights_confidence ON public.knowledge_insights(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_insights_created ON public.knowledge_insights(created_at DESC);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_insights ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (can be restricted later)
CREATE POLICY "Public access knowledge_nodes" ON public.knowledge_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access knowledge_edges" ON public.knowledge_edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access knowledge_paths" ON public.knowledge_paths FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access knowledge_insights" ON public.knowledge_insights FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function: Clean up expired paths
CREATE OR REPLACE FUNCTION clean_expired_graph_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.knowledge_paths WHERE expires_at < now();
  DELETE FROM public.knowledge_insights WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Function: Update node timestamp on changes
CREATE OR REPLACE FUNCTION update_knowledge_node_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_node_timestamp
BEFORE UPDATE ON public.knowledge_nodes
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_node_timestamp();

-- Function: Update edge timestamp on changes
CREATE OR REPLACE FUNCTION update_knowledge_edge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_knowledge_edge_timestamp
BEFORE UPDATE ON public.knowledge_edges
FOR EACH ROW
EXECUTE FUNCTION update_knowledge_edge_timestamp();

-- Function: Search similar entities by embedding
CREATE OR REPLACE FUNCTION match_knowledge_entities(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  name text,
  properties jsonb,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kn.id,
    kn.entity_type,
    kn.entity_id,
    kn.name,
    kn.properties,
    1 - (kn.embedding <=> query_embedding) as similarity
  FROM public.knowledge_nodes kn
  WHERE
    kn.embedding IS NOT NULL
    AND (filter_entity_type IS NULL OR kn.entity_type = filter_entity_type)
    AND 1 - (kn.embedding <=> query_embedding) > match_threshold
  ORDER BY kn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL COMMENTS
-- ============================================
COMMENT ON TABLE public.knowledge_nodes IS 'Entity nodes in the knowledge graph - clients, coaches, deals, campaigns, etc.';
COMMENT ON TABLE public.knowledge_edges IS 'Relationships between entities - trained_by, purchased, referred_by, etc.';
COMMENT ON TABLE public.knowledge_paths IS 'Cached frequently-queried paths for performance optimization';
COMMENT ON TABLE public.knowledge_insights IS 'AI-discovered patterns, anomalies, and trends in the graph';
