import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const clean = (v?: string) =>
  v
    ?.trim()
    .replace(/["'\\]/g, "")
    .replace(/n$/g, "")
    .trim() || "";
const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const key = clean(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
);

const s = createClient(url, key);

async function diagnose() {
  console.log("🔍 DIAGNOSING PRODUCTION DB...");

  // 1. List Tables
  const { data: tables, error: tableErr } = await s.rpc("execute_sql_query", {
    sql_query:
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  });

  if (tableErr) {
    console.error("❌ Failed to list tables:", tableErr);
  } else {
    console.log(
      "✅ Tables in public:",
      (tables as any).map((t: any) => t.table_name).join(", "),
    );
  }

  // 2. Check agent_skills specifically
  const { data: exists, error: existErr } = await s.rpc("execute_sql_query", {
    sql_query:
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_skills')",
  });
  console.log(
    "❓ agent_skills exists:",
    (exists as any)?.[0]?.exists ? "YES" : "NO",
  );

  // 3. Re-create if missing
  if (!(exists as any)?.[0]?.exists) {
    console.log("🔨 Re-applying agent_skills table migration...");
    const sql = `
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
    `;
    const { error: migErr } = await s.rpc("execute_sql_query", {
      sql_query: sql,
    });
    if (migErr) console.error("❌ Migration failed:", migErr);
    else console.log("✅ agent_skills table created/verified.");
  }
}

diagnose();
