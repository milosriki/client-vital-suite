import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

Deno.serve(async (req) => {
  verifyAuth(req);
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DIRECT_URL");

  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "Missing SUPABASE_DB_URL" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new PostgresClient(dbUrl);

  try {
    await client.connect();

    const body = await req.json().catch(() => ({}));
    const action = body.action || "fix_aws_cache"; // Default to original behavior

    if (action === "audit_pks") {
      const result = await client.queryObject(`
        SELECT t.table_name
        FROM information_schema.tables t
        LEFT JOIN information_schema.table_constraints tc 
          ON t.table_name = tc.table_name 
          AND tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
        WHERE t.table_schema = 'public'
          AND tc.constraint_name IS NULL
          AND t.table_type = 'BASE TABLE';
      `);
      return new Response(
        JSON.stringify({ success: true, missing_pks: result.rows }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (action === "audit_indexes") {
      // Find foreign keys without indexes
      const result = await client.queryObject(`
        SELECT
            conname AS constraint_name,
            conrelid::regclass AS table_name,
            a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
        AND NOT EXISTS (
            SELECT 1
            FROM pg_index i
            JOIN pg_attribute ia ON ia.attrelid = i.indexrelid
            WHERE i.indrelid = c.conrelid
            AND ia.attname = a.attname
        );
      `);
      return new Response(
        JSON.stringify({ success: true, unindexed_fks: result.rows }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (action === "fix_aws_cache") {
      await client.queryObject(`
        CREATE TABLE IF NOT EXISTS public.aws_truth_cache (
            id uuid primary key default gen_random_uuid(),
            email text unique NOT NULL,
            full_name text,
            outstanding_sessions int DEFAULT 0,
            last_session_date timestamptz,
            coach_name text,
            package_name text,
            updated_at timestamptz default now()
        );

        ALTER TABLE public.aws_truth_cache ENABLE ROW LEVEL SECURITY;

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view AWS truth cache') THEN
                CREATE POLICY "Users can view AWS truth cache" ON public.aws_truth_cache FOR SELECT TO authenticated USING (true);
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage AWS truth cache') THEN
                CREATE POLICY "Service role can manage AWS truth cache" ON public.aws_truth_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_aws_truth_cache_email ON public.aws_truth_cache(email);
      `);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Supreme Cache established.",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  } finally {
    await client.end();
  }
});
