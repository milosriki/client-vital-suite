import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

type Check = { ok: boolean; detail?: string };

function present(v?: string) {
  return typeof v === "string" && v.trim().length > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const required = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const envChecks: Record<string, Check> = {};
  for (const [key, val] of Object.entries(required)) {
    envChecks[key] = present(val)
      ? { ok: true }
      : { ok: false, detail: "missing" };
  }

  const supabaseUrl = required.SUPABASE_URL || "";
  const serviceKey = required.SUPABASE_SERVICE_ROLE_KEY || "";

  const localhostCheck: Check = present(supabaseUrl)
    ? /localhost|127\.0\.0\.1/i.test(supabaseUrl)
      ? { ok: false, detail: "SUPABASE_URL points to localhost" }
      : { ok: true }
    : { ok: false, detail: "SUPABASE_URL missing" };

  // Minimal logs (no secret values)
  console.log("[system-check] env presence:", {
    VITE_SUPABASE_URL: present(required.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: present(required.VITE_SUPABASE_ANON_KEY),
    SUPABASE_URL: present(required.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: present(required.SUPABASE_SERVICE_ROLE_KEY),
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

  const allOk =
    Object.values(envChecks).every((c) => c.ok) &&
    localhostCheck.ok &&
    dbCheck.ok;

  res.status(allOk ? 200 : 500).json({
    ok: allOk,
    env: envChecks,
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

