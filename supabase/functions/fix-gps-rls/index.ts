import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { corsHeaders } from "../_shared/error-handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authResponse = await verifyAuth(req);
  if (authResponse) return authResponse;

  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL") ??
      `postgresql://postgres:${Deno.env.get("SUPABASE_DB_PASSWORD") ?? (() => { throw new Error("SUPABASE_DB_PASSWORD not set"); })()}@db.ztjndilxurtsfqdsvfds.supabase.co:5432/postgres`;

    const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const client = new Client(dbUrl);
    await client.connect();

    const statements = [
      // Fix coach_visits — add anon SELECT policy
      `DROP POLICY IF EXISTS "anon_read_coach_visits" ON "coach_visits"`,
      `CREATE POLICY "anon_read_coach_visits" ON "coach_visits" FOR SELECT TO anon USING (true)`,

      // Fix coach_client_notes — ensure anon can read
      `DROP POLICY IF EXISTS "anon_read_coach_client_notes" ON "coach_client_notes"`,
      `CREATE POLICY "anon_read_coach_client_notes" ON "coach_client_notes" FOR SELECT TO anon USING (true)`,
      `DROP POLICY IF EXISTS "anon_insert_coach_client_notes" ON "coach_client_notes"`,
      `CREATE POLICY "anon_insert_coach_client_notes" ON "coach_client_notes" FOR INSERT TO anon WITH CHECK (true)`,
      `DROP POLICY IF EXISTS "anon_update_coach_client_notes" ON "coach_client_notes"`,
      `CREATE POLICY "anon_update_coach_client_notes" ON "coach_client_notes" FOR UPDATE TO anon USING (true)`,
    ];

    const results: string[] = [];
    for (const sql of statements) {
      try {
        await client.queryObject(sql);
        results.push(`✅ ${sql.substring(0, 60)}...`);
      } catch (e) {
        results.push(`⚠️ ${sql.substring(0, 60)}... → ${(e as Error).message}`);
      }
    }

    await client.end();

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
