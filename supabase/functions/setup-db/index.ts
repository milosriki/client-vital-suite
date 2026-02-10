import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders as defaultCorsHeaders,
} from "../_shared/error-handler.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL");

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (!DB_URL) {
    return apiError("INTERNAL_ERROR", "Missing SUPABASE_DB_URL", 500);
  }

  const client = new Client(DB_URL);

  try {
    await client.connect();

    const body = await req.json().catch(() => ({}));
    const customSql = body.sql;

    if (customSql) {
      console.log("Executing custom SQL...");
      await client.queryArray(customSql);
      return apiSuccess({ status: "ok", message: "Custom SQL Executed." });
    }

    const sql = `
      -- Create knowledge_base
      create table if not exists public.knowledge_base (
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

      -- Create whatsapp_interactions
      create table if not exists public.whatsapp_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number TEXT NOT NULL,
        message_text TEXT,
        response_text TEXT,
        status TEXT DEFAULT 'pending',
        whatsapp_id TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create conversation_intelligence
      create table if not exists public.conversation_intelligence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL UNIQUE,
        lead_score INT DEFAULT 10 CHECK (lead_score >= 0 AND lead_score <= 100),
        lead_temperature TEXT DEFAULT 'cold' CHECK (lead_temperature IN ('cold', 'warm', 'hot')),
        psychological_profile TEXT,
        dominant_pain TEXT,
        desired_outcome TEXT,
        primary_blocker TEXT,
        conversation_phase TEXT DEFAULT 'hook' CHECK (conversation_phase IN ('hook', 'diagnosis', 'reframe', 'close', 'followup', 'booked', 'lost')),
        last_internal_thought JSONB,
        conversation_summary TEXT,
        message_count INT DEFAULT 0,
        objections_raised TEXT[] DEFAULT '{}',
        objections_handled TEXT[] DEFAULT '{}',
        last_lead_message_at TIMESTAMPTZ,
        last_followup_at TIMESTAMPTZ,
        followup_count INT DEFAULT 0,
        followup_stage TEXT DEFAULT 'none' CHECK (followup_stage IN ('none', 'challenge_sent', 'value_drop_sent', 'breakup_sent', 'exhausted')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create system_alerts
      create table if not exists public.system_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        priority TEXT DEFAULT 'MEDIUM',
        category TEXT DEFAULT 'GENERAL',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'NEW',
        metadata JSONB DEFAULT '{}'::jsonb,
        is_resolved BOOLEAN DEFAULT false
      );

      -- Create agent_learnings (Evolution Layer)
      create table if not exists public.agent_learnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        thread_id TEXT,
        source TEXT DEFAULT 'human_feedback',
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}'::jsonb
      );

      -- Ensure columns exist (Schema evolution)
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversation_intelligence' AND column_name='last_followup_at') THEN
          ALTER TABLE public.conversation_intelligence ADD COLUMN last_followup_at TIMESTAMPTZ;
        END IF;
      END $$;

      -- Enable RLS
      alter table public.lead_states enable row level security;
      alter table public.knowledge_base enable row level security;
      alter table public.whatsapp_interactions enable row level security;
      alter table public.conversation_intelligence enable row level security;

      -- Allow Edge Functions (service_role) full access
      drop policy if exists "Service role has full access" on public.lead_states;
      create policy "Service role has full access" on public.lead_states for all to service_role using (true) with check (true);

      drop policy if exists \"Service role has full access kb\" on public.knowledge_base;
      create policy \"Service role has full access kb\" on public.knowledge_base for all to service_role using (true) with check (true);

      drop policy if exists \"Service role has full access alerts\" on public.system_alerts;
      create policy \"Service role has full access alerts\" on public.system_alerts for all to service_role using (true) with check (true);

      drop policy if exists "Service role has full access interactions" on public.whatsapp_interactions;
      create policy "Service role has full access interactions" on public.whatsapp_interactions for all to service_role using (true) with check (true);

      drop policy if exists "Service role has full access intelligence" on public.conversation_intelligence;
      create policy "Service role has full access intelligence" on public.conversation_intelligence for all to service_role using (true) with check (true);

      -- Indexes
      create index if not exists lead_states_bot_paused_idx on public.lead_states(bot_paused);
      create index if not exists idx_whatsapp_interactions_phone on public.whatsapp_interactions(phone_number, created_at desc);
      create index if not exists idx_ci_phone on public.conversation_intelligence(phone);
      create index if not exists knowledge_base_question_fts_idx on public.knowledge_base using gin (to_tsvector('english', question));
      create index if not exists knowledge_base_embedding_idx on public.knowledge_base using ivfflat (embedding vector_cosine_ops) with (lists = 100);

      -- Views
      create or replace view v_active_pipeline as
      select
        ci.phone,
        ci.lead_score,
        ci.lead_temperature,
        ci.conversation_phase,
        ci.psychological_profile,
        ci.dominant_pain,
        ci.message_count,
        ci.last_lead_message_at,
        extract(epoch from (now() - ci.last_lead_message_at)) / 3600
          as hours_since_last_message
      from conversation_intelligence ci
      where ci.conversation_phase not in ('booked', 'lost')
      order by ci.lead_score desc;

      create or replace view v_followup_queue as
      select
        ci.phone,
        ci.lead_score,
        ci.dominant_pain,
        ci.followup_stage,
        ci.followup_count,
        ci.last_lead_message_at,
        ci.last_followup_at,
        extract(epoch from (now() - ci.last_lead_message_at)) / 60
          as minutes_inactive
      from conversation_intelligence ci
      where ci.last_lead_message_at < now() - interval '30 minutes'
        and (ci.last_followup_at is null or ci.last_followup_at < ci.last_lead_message_at)
        and ci.followup_stage != 'exhausted'
        and ci.conversation_phase not in ('booked', 'lost')
      order by ci.last_lead_message_at asc;

      create or replace view v_conversion_funnel as
      select
        conversation_phase,
        count(*) as total,
        round(avg(lead_score), 1) as avg_score,
        round(avg(message_count), 1) as avg_messages
      from conversation_intelligence
      group by conversation_phase
      order by
        case conversation_phase
          when 'hook' then 1
          when 'diagnosis' then 2
          when 'reframe' then 3
          when 'close' then 4
          when 'booked' then 5
          when 'followup' then 6
          when 'lost' then 7
        end;
    `;

    await client.queryArray(sql);

    return apiSuccess({
      status: "ok",
      message: "Migration Applied: Tables synced.",
    });
  } catch (error: unknown) {
    return apiError(
      "INTERNAL_ERROR",
      JSON.stringify({ error: error.message }),
      500,
    );
  } finally {
    await client.end();
  }
});
