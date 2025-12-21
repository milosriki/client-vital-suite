import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import postgres from 'https://deno.land/x/postgresjs/mod.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use the connection string from env
    const databaseUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!databaseUrl) {
      throw new Error('SUPABASE_DB_URL not set')
    }

    const sql = postgres(databaseUrl)

    console.log('Running migration...')

    // 1. Create match_memories RPC
    // Drop specific signature to avoid ambiguity
    await sql`DROP FUNCTION IF EXISTS match_memories(vector, float, int, text)`
    
    
    await sql`
      CREATE OR REPLACE FUNCTION match_memories(
        query_embedding VECTOR(1536),
        match_threshold FLOAT DEFAULT 0.7,
        match_count INT DEFAULT 5,
        filter_thread_id TEXT DEFAULT NULL
      )
      RETURNS TABLE (
        id UUID,
        content TEXT,
        role TEXT,
        similarity FLOAT,
        created_at TIMESTAMPTZ
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          am.id,
          am.content,
          am.role,
          1 - (am.embedding <=> query_embedding) AS similarity,
          am.created_at
        FROM agent_memory am
        WHERE (filter_thread_id IS NULL OR am.thread_id = filter_thread_id)
          AND 1 - (am.embedding <=> query_embedding) > match_threshold
        ORDER BY am.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `
    console.log('Created match_memories RPC')

    // 2. Fix Table Naming (View)
    // Rename existing table if it exists to avoid conflict
    try {
      await sql`ALTER TABLE knowledge_base RENAME TO knowledge_base_backup`
      console.log('Backed up existing knowledge_base table')
    } catch (e) {
      // Ignore error if table doesn't exist
      console.log('No existing knowledge_base table to backup (or other error):', e.message)
    }

    await sql`
      CREATE OR REPLACE VIEW knowledge_base AS
      SELECT 
        id,
        content,
        category,
        subcategory,
        title,
        structured_data,
        embedding,
        source,
        confidence,
        created_at,
        updated_at
      FROM agent_knowledge;
    `
    console.log('Created knowledge_base view')

    // 3. Grants
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base TO authenticated`
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_base TO service_role`
    
    console.log('Granted permissions')

    return new Response(JSON.stringify({ success: true, message: 'Migration applied successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Migration error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
