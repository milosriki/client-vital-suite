import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

serve(async (req) => {
  try {
    verifyAuth(req); // Security Hardening
    const url = Deno.env.get("SUPABASE_URL") ?? "https://example.com";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "key";
    const client = createClient(url, key);

    return new Response(
      JSON.stringify({ message: "Supabase Client Init OK" }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
