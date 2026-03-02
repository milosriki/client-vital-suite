/**
 * Ingest findings and plans into agent_knowledge (unified memory).
 * Invoke: POST { "chunks": [{ category, title, content, source }] }
 * Requires: GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Security: Phase 1 Auth Lockdown
  try { verifyAuth(req); } catch (_e) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { chunks } = (await req.json()) as {
      chunks?: Array<{ category: string; title: string; content: string; source: string }>;
    };
    if (!chunks?.length) {
      return new Response(
        JSON.stringify({ error: "chunks array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let inserted = 0;
    for (const c of chunks) {
      const text = `${c.title}\n\n${c.content}`.slice(0, 8000);
      const embedding = await unifiedAI.embed(text);
      if (!embedding?.length) continue;

      const { error } = await supabase.from("agent_knowledge").upsert(
        {
          category: c.category,
          title: c.title,
          content: c.content,
          source: c.source,
          embedding,
          is_active: true,
        },
        { onConflict: "source,title", ignoreDuplicates: false }
      );

      if (!error) inserted++;
      await new Promise((r) => setTimeout(r, 150)); // Rate limit
    }

    return new Response(
      JSON.stringify({ inserted, total: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[ingest-unified-knowledge]", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
