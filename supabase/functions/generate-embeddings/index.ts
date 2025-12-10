import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// EMBEDDINGS GENERATOR v2.0 - 100x Smarter
// Supports all tables, batch processing, semantic search
// ============================================

const EMBEDDING_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 20 // Process 20 at a time for rate limiting

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!openaiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'OPENAI_API_KEY not configured'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json()
    const {
      action = 'generate',
      text,
      id,
      table = 'knowledge_base',
      metadata = {},
      query,
      limit = 10,
      threshold = 0.5
    } = body

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ============================================
    // ACTION: generate - Create embedding and insert
    // ============================================
    if (action === 'generate' && text) {
      const embedding = await generateSingleEmbedding(text, openaiKey)

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          content: text,
          embedding,
          metadata,
          source: metadata.source || 'manual',
          category: metadata.category || 'general'
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: update - Update embedding for existing row
    // ============================================
    if (action === 'update' && id) {
      const { data: row } = await supabase
        .from(table)
        .select('content, query, response, topic, entity_name')
        .eq('id', id)
        .single()

      if (!row) throw new Error('Row not found')

      // Build text based on table type
      let textToEmbed = ''
      if (table === 'agent_memory') {
        textToEmbed = `Q: ${row.query}\nA: ${row.response}`
      } else if (table === 'kg_entities') {
        textToEmbed = `${row.entity_name}`
      } else {
        textToEmbed = row.content || row.topic || ''
      }

      const embedding = await generateSingleEmbedding(textToEmbed, openaiKey)

      const { error } = await supabase
        .from(table)
        .update({ embedding })
        .eq('id', id)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: batch_memory - Generate for agent_memory
    // ============================================
    if (action === 'batch_memory') {
      const result = await batchProcessTable(supabase, openaiKey, 'agent_memory', (row: any) =>
        `Q: ${row.query}\nA: ${row.response}`.slice(0, 8000)
      )
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: batch_knowledge - Generate for knowledge_base
    // ============================================
    if (action === 'batch' || action === 'batch_knowledge') {
      const result = await batchProcessTable(supabase, openaiKey, 'knowledge_base', (row: any) =>
        `[${row.category}] ${row.topic || ''}: ${row.content}`.slice(0, 8000)
      )
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: batch_entities - Generate for kg_entities
    // ============================================
    if (action === 'batch_entities') {
      const result = await batchProcessTable(supabase, openaiKey, 'kg_entities', (row: any) => {
        const props = typeof row.properties === 'object' ? JSON.stringify(row.properties) : ''
        return `${row.entity_type}: ${row.entity_name} ${props}`.slice(0, 8000)
      })
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: batch_all - Process all tables
    // ============================================
    if (action === 'batch_all') {
      const results: Record<string, any> = {}

      // Process knowledge_base
      results.knowledge_base = await batchProcessTable(supabase, openaiKey, 'knowledge_base', (row: any) =>
        `[${row.category}] ${row.topic || ''}: ${row.content}`.slice(0, 8000)
      )

      // Process agent_memory
      results.agent_memory = await batchProcessTable(supabase, openaiKey, 'agent_memory', (row: any) =>
        `Q: ${row.query}\nA: ${row.response}`.slice(0, 8000)
      )

      // Process kg_entities
      results.kg_entities = await batchProcessTable(supabase, openaiKey, 'kg_entities', (row: any) => {
        const props = typeof row.properties === 'object' ? JSON.stringify(row.properties) : ''
        return `${row.entity_type}: ${row.entity_name} ${props}`.slice(0, 8000)
      })

      const totalProcessed = Object.values(results).reduce((sum: number, r: any) => sum + (r.processed || 0), 0)
      const totalErrors = Object.values(results).reduce((sum: number, r: any) => sum + (r.errors || 0), 0)

      return new Response(JSON.stringify({
        success: true,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        tables: results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: search - Semantic search across tables
    // ============================================
    if (action === 'search' && query) {
      const queryEmbedding = await generateSingleEmbedding(query, openaiKey)

      // Try using RPC function first
      let results: any[] = []

      if (table === 'agent_memory') {
        const { data, error } = await supabase.rpc('match_memories', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        })
        if (!error && data) {
          results = data
        } else {
          // Fallback to manual search
          results = await manualSimilaritySearch(supabase, table, queryEmbedding, limit, threshold)
        }
      } else if (table === 'knowledge_base') {
        const { data, error } = await supabase.rpc('match_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        })
        if (!error && data) {
          results = data
        } else {
          results = await manualSimilaritySearch(supabase, table, queryEmbedding, limit, threshold)
        }
      } else {
        results = await manualSimilaritySearch(supabase, table, queryEmbedding, limit, threshold)
      }

      return new Response(JSON.stringify({
        success: true,
        query,
        table,
        results,
        count: results.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================
    // ACTION: stats - Get embedding statistics
    // ============================================
    if (action === 'stats') {
      const tables = ['knowledge_base', 'agent_memory', 'kg_entities']
      const stats: Record<string, any> = {}

      for (const tbl of tables) {
        const { count: total } = await supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true })

        const { count: withEmbedding } = await supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true })
          .not('embedding', 'is', null)

        stats[tbl] = {
          total: total || 0,
          with_embedding: withEmbedding || 0,
          missing: (total || 0) - (withEmbedding || 0),
          coverage: total ? Math.round((withEmbedding || 0) / total * 100) : 0
        }
      }

      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Invalid action. Use: generate, update, batch, batch_memory, batch_entities, batch_all, search, stats')

  } catch (error: unknown) {
    console.error('generate-embeddings error:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Generate a single embedding
async function generateSingleEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000)
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error: ${err}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

// Generate batch embeddings
async function generateBatchEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map(t => t.slice(0, 8000))
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error: ${err}`)
  }

  const data = await response.json()
  return data.data.map((d: any) => d.embedding)
}

// Batch process a table
async function batchProcessTable(
  supabase: any,
  apiKey: string,
  tableName: string,
  textExtractor: (row: any) => string
): Promise<{ success: boolean; table: string; processed: number; errors: number; total: number }> {
  console.log(`[Embeddings] Starting batch processing for ${tableName}...`)

  // Get rows without embeddings
  const { data: rows, error } = await supabase
    .from(tableName)
    .select('*')
    .is('embedding', null)
    .limit(100)

  if (error) {
    console.error(`Error fetching ${tableName}:`, error)
    return { success: false, table: tableName, processed: 0, errors: 1, total: 0 }
  }

  if (!rows || rows.length === 0) {
    return { success: true, table: tableName, processed: 0, errors: 0, total: 0 }
  }

  console.log(`[Embeddings] Processing ${rows.length} rows from ${tableName}...`)

  let processed = 0
  let errors = 0

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const texts = batch.map(textExtractor)

    try {
      const embeddings = await generateBatchEmbeddings(texts, apiKey)

      // Update each row
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ embedding: embeddings[j] })
          .eq('id', batch[j].id)

        if (updateError) {
          console.error(`Error updating ${batch[j].id}:`, updateError)
          errors++
        } else {
          processed++
        }
      }
    } catch (e) {
      console.error(`Batch error at index ${i}:`, e)
      errors += batch.length
    }

    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  console.log(`[Embeddings] ${tableName} complete: ${processed} processed, ${errors} errors`)

  return { success: true, table: tableName, processed, errors, total: rows.length }
}

// Manual similarity search (fallback when RPC doesn't exist)
async function manualSimilaritySearch(
  supabase: any,
  table: string,
  queryEmbedding: number[],
  limit: number,
  threshold: number
): Promise<any[]> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .not('embedding', 'is', null)
    .limit(500)

  if (error || !data) return []

  // Calculate cosine similarity
  const withSimilarity = data.map((row: any) => ({
    ...row,
    similarity: cosineSimilarity(queryEmbedding, row.embedding),
    embedding: undefined // Don't return the embedding in results
  }))

  // Filter and sort
  return withSimilarity
    .filter((r: any) => r.similarity >= threshold)
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, limit)
}

// Cosine similarity calculation
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
