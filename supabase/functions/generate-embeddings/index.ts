import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const openaiKey = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Validate OPENAI_API_KEY before processing
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { action = 'generate', text, id, table = 'knowledge_base', metadata = {} } = await req.json()
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Action: Generate embedding for new content and insert
    if (action === 'generate' && text) {
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000)
        })
      })

      if (!embRes.ok) {
        const err = await embRes.text()
        throw new Error(`OpenAI API error: ${err}`)
      }

      const embData = await embRes.json()
      const embedding = embData.data[0].embedding

      // Insert into knowledge_base
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

    // Action: Update embedding for existing row
    if (action === 'update' && id) {
      const { data: row } = await supabase
        .from(table)
        .select('content')
        .eq('id', id)
        .single()

      if (!row) throw new Error('Row not found')

      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: row.content.slice(0, 8000)
        })
      })

      const embData = await embRes.json()
      const embedding = embData.data[0].embedding

      const { error } = await supabase
        .from(table)
        .update({ embedding })
        .eq('id', id)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: Batch update all rows without embeddings
    if (action === 'batch') {
      const { data: rows } = await supabase
        .from('knowledge_base')
        .select('id, content')
        .is('embedding', null)
        .limit(50)

      if (!rows || rows.length === 0) {
        return new Response(JSON.stringify({ success: true, processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let processed = 0
      for (const row of rows) {
        try {
          const embRes = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: row.content.slice(0, 8000)
            })
          })

          const embData = await embRes.json()
          const embedding = embData.data[0].embedding

          await supabase
            .from('knowledge_base')
            .update({ embedding })
            .eq('id', row.id)

          processed++
        } catch (e) {
          console.error(`Error processing row ${row.id}:`, e)
        }
      }

      return new Response(JSON.stringify({ success: true, processed, total: rows.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Invalid action or missing parameters')

  } catch (error: unknown) {
    console.error('generate-embeddings error:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
