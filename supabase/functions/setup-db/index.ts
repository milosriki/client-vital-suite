import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL");

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (!DB_URL) {
    return new Response("Missing SUPABASE_DB_URL", { status: 500 });
  }

  const client = new Client(DB_URL);

  try {
    await client.connect();

    const sql = `
      -- FORCE CLEANUP (Nuclear Option for Dev)
      drop table if exists public.lead_states;
      drop view if exists public.knowledge_base;
      drop table if exists public.knowledge_base; 

      -- Create knowledge_base
      create table public.knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        category TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        tags TEXT[],
        embedding vector(1536),
        is_active BOOLEAN DEFAULT true
      );
      
      -- Create lead_states
      create table if not exists public.lead_states (
        phone_number text primary key,
        bot_paused boolean default false,
        paused_until timestamptz,
        last_interaction timestamptz default now(),
        created_at timestamptz default now()
      );

      -- Enable RLS
      alter table public.lead_states enable row level security;
      alter table public.knowledge_base enable row level security;

      -- Allow Edge Functions (service_role) full access
      drop policy if exists "Service role has full access" on public.lead_states;
      create policy "Service role has full access" on public.lead_states for all to service_role using (true) with check (true);

      drop policy if exists "Service role has full access kb" on public.knowledge_base;
      create policy "Service role has full access kb" on public.knowledge_base for all to service_role using (true) with check (true);

      -- Indexes
      create index if not exists lead_states_bot_paused_idx on public.lead_states(bot_paused);
      create index if not exists knowledge_base_question_fts_idx on public.knowledge_base using gin (to_tsvector('english', question));
      create index if not exists knowledge_base_embedding_idx on public.knowledge_base using ivfflat (embedding vector_cosine_ops) with (lists = 100);
    `;

    await client.queryArray(sql);

    return new Response("Migration Applied: Tables synced.", { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    await client.end();
  }
});
