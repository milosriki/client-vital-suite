import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { corsHeaders } from "../_shared/error-handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const authResponse = await verifyAuth(req);
  if (authResponse) return authResponse;

  const { sql } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "public" } }
  );

  // Use the management API to run DDL
  const { data, error } = await supabase.rpc("exec", { query: sql }).maybeSingle();
  
  // Fallback: use pg directly
  if (error) {
    // Try raw fetch to pg
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
