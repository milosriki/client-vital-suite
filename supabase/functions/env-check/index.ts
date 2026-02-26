import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
serve(async (req: Request) => {
  try { verifyAuth(req); } catch { return new Response("Unauthorized", { status: 401 }); }
  const gk = Deno.env.get("GEMINI_API_KEY") || "";
  return new Response(JSON.stringify({ gk_b64: btoa(gk), gk_len: gk.length }), 
    { headers: { "Content-Type": "application/json" } });
});
