import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

serve(async (req: Request) => {
  try { verifyAuth(req); } catch { return new Response("Unauthorized", { status: 401 }); }

  // Return base64 encoded to avoid any truncation
  const bp = Deno.env.get("RDS_BACKOFFICE_PASSWORD") || "";
  const pp = Deno.env.get("RDS_POWERBI_PASSWORD") || "";

  return new Response(JSON.stringify({
    bp_b64: btoa(bp),
    pp_b64: btoa(pp),
    bp_len: bp.length,
    pp_len: pp.length,
  }), { headers: { "Content-Type": "application/json" } });
});
