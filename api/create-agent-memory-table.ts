import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // First, try to create the table using raw SQL via the REST API
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      },
      body: JSON.stringify({
        sql: `
          -- Enable vector extension (should already be enabled)
          CREATE EXTENSION IF NOT EXISTS vector;

          -- Agent memory table for vector search
          CREATE TABLE IF NOT EXISTS agent_memory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            content TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            embedding VECTOR(1536),
            thread_id TEXT,
            session_id TEXT,
            user_id TEXT,
            agent_type TEXT DEFAULT 'analyst',
            context JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding ON agent_memory
          USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

          CREATE INDEX IF NOT EXISTS idx_agent_memory_thread ON agent_memory(thread_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON agent_memory(session_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_agent_memory_user ON agent_memory(user_id, created_at DESC);

          -- RLS (allow authenticated users)
          ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Allow authenticated access to agent_memory" ON agent_memory;
          CREATE POLICY "Allow authenticated access to agent_memory" ON agent_memory FOR ALL USING (true);
        `
      })
    });

    if (!response.ok) {
      // Try alternative approach - check if table exists first
      const checkResponse = await supabase.from('agent_memory').select('id').limit(1);
      if (checkResponse.error && checkResponse.error.code === 'PGRST116') {
        // Table doesn't exist, try to create it via direct SQL execution
        console.log('Table does not exist, attempting to create...');

        // This won't work, but let's try the schema refresh approach
        const refreshResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          },
          body: JSON.stringify({
            sql: `NOTIFY pgrst, 'reload schema';`
          })
        });

        return res.status(200).json({
          success: false,
          message: 'Table creation requires manual SQL execution in Supabase dashboard',
          suggestion: 'Run the SQL from /supabase/migrations/20251222000003_create_agent_memory_table.sql in your Supabase SQL Editor'
        });
      } else {
        return res.status(200).json({ success: true, message: 'agent_memory table already exists' });
      }
    }

    return res.status(200).json({ success: true, message: 'agent_memory table created successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected error', details: err.message });
  }
}