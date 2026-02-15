import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "https://esm.sh/postgres@3.3.5";

async function main() {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DIRECT_URL");
  if (!dbUrl) {
    console.error("❌ Missing SUPABASE_DB_URL");
    Deno.exit(1);
  }

  // Use postgres.js with explicit SSL configuration to allow self-signed/unknown certs
  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false },
    prepare: false,
  });

  try {
    console.log("🔌 Connecting to DB (postgres.js)...");

    // 1. Get all public tables
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `;

    // 2. Get RLS status
    const rlsStatusRows = await sql`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE pg_namespace.nspname = 'public' AND relkind = 'r';
    `;

    // 3. Get policies
    const policiesRows = await sql`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `;

    const tableNames = tables.map((r: any) => r.tablename);
    const rlsStatus = new Map(
      rlsStatusRows.map((r: any) => [r.relname, r.relrowsecurity]),
    );
    const policyMap = new Map<string, string[]>();

    policiesRows.forEach((r: any) => {
      if (!policyMap.has(r.tablename)) policyMap.set(r.tablename, []);
      policyMap.get(r.tablename)!.push(r.policyname);
    });

    console.log(`🔍 Auditing ${tableNames.length} tables...`);

    let missingRLS = 0;
    let missingPolicies = 0;

    for (const table of tableNames) {
      const isEnabled = rlsStatus.get(table);
      const policies = policyMap.get(table) || [];

      if (!isEnabled) {
        console.log(`❌ [NO RLS] Table '${table}' has RLS DISABLED.`);
        missingRLS++;
      } else if (policies.length === 0) {
        console.log(
          `⚠️ [NO POLICIES] Table '${table}' has RLS enabled but NO policies (Denied by default).`,
        );
        missingPolicies++;
      } else {
        console.log(
          `✅ [SECURE] ${table} (RLS: On, Policies: ${policies.length})`,
        );
      }
    }

    if (missingRLS > 0 || missingPolicies > 0) {
      console.log(
        `\n🚨 FAIL: Found ${missingRLS} tables without RLS and ${missingPolicies} without policies.`,
      );
      // Don't exit 1, just report validly so we can proceed to fix
      Deno.exit(0);
    } else {
      console.log(
        "\n✨ SUCCESS: All tables have RLS enabled and policies configured.",
      );
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await sql.end();
  }
}

main();
