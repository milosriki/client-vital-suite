import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response(JSON.stringify({ error: "No DB URL" }), { status: 500, headers: corsHeaders });

  const client = new Client(dbUrl);
  try {
    await client.connect();

    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS coach_client_notes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('coach', 'client')),
        entity_name TEXT NOT NULL,
        entity_id TEXT,
        note TEXT NOT NULL,
        note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'concern', 'positive', 'action_item', 'follow_up')),
        created_by TEXT DEFAULT 'team_leader',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        is_resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMPTZ
      );
    `);

    await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_ccn_entity ON coach_client_notes(entity_type, entity_name);`);
    await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_ccn_created ON coach_client_notes(created_at DESC);`);
    await client.queryArray(`ALTER TABLE coach_client_notes ENABLE ROW LEVEL SECURITY;`);
    await client.queryArray(`DROP POLICY IF EXISTS ccn_auth_all ON coach_client_notes;`);
    await client.queryArray(`CREATE POLICY ccn_auth_all ON coach_client_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);`);

    return new Response(JSON.stringify({ success: true, message: "coach_client_notes table created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await client.end();
  }
});
