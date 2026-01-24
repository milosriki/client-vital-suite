import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL
)
  ?.replace(/["'\\]/g, "")
  .replace(/n$/g, "")
  .trim();
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)
  ?.replace(/["'\\]/g, "")
  .replace(/n$/g, "")
  .trim();

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

const migrations = [
  {
    name: "agent_skills_table",
    sql: `
      create table if not exists public.agent_skills (
        id text primary key,
        name text not null,
        description text,
        content text not null,
        capabilities jsonb default '[]'::jsonb,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
      alter table public.agent_skills enable row level security;
      drop policy if exists "Allow read access to everyone" on public.agent_skills;
      create policy "Allow read access to everyone" on public.agent_skills for select to authenticated, service_role using (true);
      drop policy if exists "Allow write access to service role" on public.agent_skills;
      create policy "Allow write access to service role" on public.agent_skills for all to service_role using (true) with check (true);
      
      create or replace function public.handle_updated_at()
      returns trigger as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$ language plpgsql;

      drop trigger if exists handle_agent_skills_updated_at on public.agent_skills;
      create trigger handle_agent_skills_updated_at
        before update on public.agent_skills
        for each row
        execute function public.handle_updated_at();
    `,
  },
  {
    name: "dashboard_stats_rpc",
    sql: `
      CREATE OR REPLACE FUNCTION get_dashboard_stats()
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        now_date date := current_date;
        this_month_start date := date_trunc('month', now_date);
        this_month_end date := (date_trunc('month', now_date) + interval '1 month - 1 day')::date;
        last_month_start date := date_trunc('month', now_date - interval '1 month');
        last_month_end date := (date_trunc('month', now_date - interval '1 month') + interval '1 month - 1 day')::date;
        
        revenue_this_month numeric;
        revenue_last_month numeric;
        revenue_today numeric;
        pipeline_val numeric;
        pipeline_cnt integer;
        revenue_trend numeric;
      BEGIN
        -- Revenue This Month
        SELECT COALESCE(SUM(deal_value), 0) INTO revenue_this_month
        FROM deals
        WHERE status = 'closed' 
        AND close_date >= this_month_start 
        AND close_date <= this_month_end;

        -- Revenue Last Month
        SELECT COALESCE(SUM(deal_value), 0) INTO revenue_last_month
        FROM deals
        WHERE status = 'closed' 
        AND close_date >= last_month_start 
        AND close_date <= last_month_end;

        -- Revenue Today
        SELECT COALESCE(SUM(deal_value), 0) INTO revenue_today
        FROM deals
        WHERE status = 'closed' 
        AND close_date >= now_date;

        -- Pipeline
        SELECT COALESCE(SUM(deal_value), 0), COUNT(*) INTO pipeline_val, pipeline_cnt
        FROM deals
        WHERE status NOT IN ('closed', 'lost');

        -- Calculate Trend
        IF revenue_last_month > 0 THEN
          revenue_trend := ROUND(((revenue_this_month - revenue_last_month) / revenue_last_month) * 100, 0);
        ELSE
          revenue_trend := 0;
        END IF;

        RETURN json_build_object(
          'revenue_this_month', revenue_this_month,
          'revenue_last_month', revenue_last_month,
          'revenue_today', revenue_today,
          'revenue_trend', revenue_trend,
          'pipeline_value', pipeline_val,
          'pipeline_count', pipeline_cnt,
          'is_positive_trend', revenue_trend >= 0
        );
      END;
      $$;
    `,
  },
];

async function applyMigrations() {
  for (const m of migrations) {
    console.log(`Applying ${m.name}...`);
    const { data, error } = await supabase.rpc("execute_sql_query", {
      sql_query: m.sql,
    });
    if (error) {
      console.error(`❌ Failed to apply ${m.name}:`, error);
    } else {
      console.log(`✅ Applied ${m.name} successfully.`);
    }
  }
}

applyMigrations();
