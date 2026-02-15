import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function main() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };

  console.log("🌐 Connecting to Supabase REST API...");

  try {
    // 1. Fetch Tables (from custom RPC if available, or try information_schema if exposed)
    // Note: information_schema is often NOT exposed to REST by default.
    // However, we can try to query 'pg_policies' if the user exposed it, OR rely on 'db-inspector' logic if needed.
    // Let's try querying `pg_policies` directly first. If 404/401, we know it's not exposed.

    // Attempt to query 'pg_policies' (System view)
    // Usually system schemas are not exposed on REST.
    // BUT we have the Service Role Key.
    // Service Role Key bypasses RLS, but does it expose schemas? Only if 'exposed_schemas' config includes it.
    // Most likely NOT.

    // PLAN B: Use the `get_all_tables` RPC that `db-inspector` used!
    // And ideally create a `get_all_policies` query? No, we can't create RPCs.

    // Let's assume we can't get policies via REST easily without config changes.
    // ... Unless we run a SQL query via REST?
    // Supabase pg_graphql?
    // Or /v1/query? (No, that's not standard).

    // WAIT! We can use `db-inspector` approach?
    // `db-inspector` uses `supabase.rpc('get_all_tables')`.
    // Does it? step 4754: `const { data: tables, error } = await supabase.rpc("get_all_tables");`
    // If that RPC exists, we can use it!

    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/get_all_tables`;
    const tablesResp = await fetch(rpcUrl, { method: "POST", headers });

    if (!tablesResp.ok) {
      console.log("⚠️ RPC get_all_tables failed:", await tablesResp.text());
      // Fallback or exit
    } else {
      const tables = await tablesResp.json();
      console.log(`✅ RPC get_all_tables returned ${tables.length} tables.`);
      console.log(tables);
      // But we need POLICIES.
    }

    // What about SQL?
    // Can we run SQL via `pg_meta` API?
    // `https://ztjndilxurtsfqdsvfds.supabase.co/pg_meta/default/query?key=...` ?
    // Check if PG META is reachable?

    // Let's try a direct fetch to `pg_policies` just in case.
    const policiesUrl = `${SUPABASE_URL}/rest/v1/pg_policies?select=*`;
    const policiesResp = await fetch(policiesUrl, { headers });

    if (policiesResp.ok) {
      const policies = await policiesResp.json();
      console.log(`✅ Found ${policies.length} policies via REST.`);
      console.log(JSON.stringify(policies, null, 2));
    } else {
      console.log(
        "⚠️ Failed to fetch pg_policies via REST:",
        await policiesResp.text(),
      );
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
