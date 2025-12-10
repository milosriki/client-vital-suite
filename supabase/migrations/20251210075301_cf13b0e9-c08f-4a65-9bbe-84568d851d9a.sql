
-- Add missing is_dismissed column to proactive_insights
ALTER TABLE public.proactive_insights 
ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT false;

-- Also add agent_conversations table if missing (seen in logs)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for agent conversations (session-based)
CREATE POLICY "Public access agent_conversations" 
ON public.agent_conversations 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for session lookup
CREATE INDEX IF NOT EXISTS idx_agent_conversations_session 
ON public.agent_conversations(session_id, created_at);
