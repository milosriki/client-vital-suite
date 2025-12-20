import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

type Check = { ok: boolean; detail?: string };

function present(v?: string) {
  return typeof v === "string" && v.trim().length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  // ============================================
  // REQUIRED VARIABLES (5) - Must be present
  // ============================================
  const required = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // ============================================
  // OPTIONAL VARIABLES (9) - Nice to have
  // ============================================
  const optional = {
    VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY,
    FB_PIXEL_ID: process.env.FB_PIXEL_ID,
    FB_ACCESS_TOKEN: process.env.FB_ACCESS_TOKEN,
    FB_TEST_EVENT_CODE: process.env.FB_TEST_EVENT_CODE,
    EVENT_SOURCE_URL: process.env.EVENT_SOURCE_URL,
    VITE_META_CAPI_URL: process.env.VITE_META_CAPI_URL,
    VITE_API_BASE: process.env.VITE_API_BASE,
    AGENT_API_KEY: process.env.AGENT_API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  // Check required variables
  const requiredChecks: Record<string, Check> = {};
  for (const [key, val] of Object.entries(required)) {
    requiredChecks[key] = present(val)
      ? { ok: true }
      : { ok: false, detail: "missing" };
  }

  // Check optional variables
  const optionalChecks: Record<string, Check> = {};
  for (const [key, val] of Object.entries(optional)) {
    optionalChecks[key] = present(val)
      ? { ok: true }
      : { ok: false, detail: "not set" };
  }

  const supabaseUrl = required.SUPABASE_URL || "";
  const serviceKey = required.SUPABASE_SERVICE_ROLE_KEY || "";

  const localhostCheck: Check = present(supabaseUrl)
    ? /localhost|127\.0\.0\.1/i.test(supabaseUrl)
      ? { ok: false, detail: "SUPABASE_URL points to localhost" }
      : { ok: true }
    : { ok: false, detail: "SUPABASE_URL missing" };

  // Count stats
  const requiredOkCount = Object.values(requiredChecks).filter(c => c.ok).length;
  const optionalOkCount = Object.values(optionalChecks).filter(c => c.ok).length;

  // Minimal logs (no secret values)
  console.log("[system-check] env presence:", {
    required: `${requiredOkCount}/${Object.keys(required).length}`,
    optional: `${optionalOkCount}/${Object.keys(optional).length}`,
    supabase_url_localhost: /localhost|127\.0\.0\.1/i.test(supabaseUrl),
  });

  const supabaseReady = present(supabaseUrl) && present(serviceKey) && localhostCheck.ok;

  let dbCheck: Check = supabaseReady
    ? { ok: false, detail: "not run" }
    : { ok: false, detail: "skipped: missing SUPABASE_URL or service role key" };
  let edgeFnCheck: Check = supabaseReady
    ? { ok: false, detail: "not run" }
    : { ok: false, detail: "skipped: missing Supabase credentials" };

  // Only try Supabase checks if server-side creds exist and point to non-localhost
  if (supabaseReady) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Lightweight query: pick a known table; if your schema differs, change "contacts"
      const { error } = await supabase
        .from("contacts")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      dbCheck = error
        ? { ok: false, detail: `DB query failed: ${error.message}` }
        : { ok: true };

      // Optional Edge Function probe
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "verify-all-keys",
          { body: { ping: true } }
        );

        edgeFnCheck = fnErr
          ? { ok: false, detail: `Edge function error: ${fnErr.message}` }
          : { ok: true, detail: `ok (${typeof data})` };
      } catch (e: any) {
        edgeFnCheck = { ok: false, detail: `Edge invoke threw: ${e?.message || e}` };
      }
    } catch (e: any) {
      dbCheck = { ok: false, detail: `Supabase client failed: ${e?.message || e}` };
    }
  }

  // All required must pass, optional are informational
  const allRequiredOk = Object.values(requiredChecks).every((c) => c.ok);
  const allOk = allRequiredOk && localhostCheck.ok && dbCheck.ok;

  res.status(allOk ? 200 : 500).json({
    ok: allOk,
    summary: {
      required: `${requiredOkCount}/${Object.keys(required).length}`,
      optional: `${optionalOkCount}/${Object.keys(optional).length}`,
      total: `${requiredOkCount + optionalOkCount}/${Object.keys(required).length + Object.keys(optional).length}`,
    },
    env: {
      required: requiredChecks,
      optional: optionalChecks,
    },
    localhost: localhostCheck,
    supabase: {
      db: dbCheck,
      edge_function_verify_all_keys: edgeFnCheck,
    },
    meta: {
      now: new Date().toISOString(),
    },
  });
}

