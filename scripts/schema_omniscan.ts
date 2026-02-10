import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Starting Schema OmniScan...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Try to list Schemas via RPC (if exists) or direct query if allowed
  // Note: Standard Supabase API doesn't allow 'information_schema' queries usually.
  // But we can try to guess common schemas: 'public', 'auth', 'storage', 'private', 'stripe', 'hubspot'

  const targetSchemas = [
    "public",
    "auth",
    "private",
    "hidden",
    "internal",
    "stripe",
    "hubspot",
    "legacy",
    "wordpress",
    "wp",
  ];

  console.log("\n📂 1. Probing Schemas...");

  for (const schema of targetSchemas) {
    // Try to read a known table or just check existence via rpc?
    // Actually, we can just try to query a table we "guess" in that schema.
    // But better: Try to check if we can query "auth.users" (we can usually).

    if (schema === "auth") {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .limit(1); // implicit auth schema? No, usually not exposed.
      // Actually, supabase-js client targets 'public' by default.
      // To target other schemas, we need:
      // const { data } = await supabase.schema('private').from('table')...
    }
  }

  // 3. Brute Force Table Search in 'public' (expanded list)
  const expandedSuspects = [
    "trainer_commissions",
    "commissions",
    "payouts",
    "salary",
    "session_history",
    "class_schedule",
    "classes",
    "group_sessions",
    "pt_sessions",
    "member_checkins",
    "gate_access",
    "hubspot_deals",
    "hubspot_contacts",
    "stripe_charges",
    "wp_usermeta",
    "wp_posts",
    "leads_legacy",
  ];

  console.log("\n📋 2. Expanded Table Brute Force in 'public'...");
  for (const table of expandedSuspects) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (!error) {
      console.log(`   ✅ Found Table: '${table}'`);
      if (data && data.length > 0) {
        console.log(`      Keys: ${Object.keys(data[0]).join(", ")}`);
        // Check for 609
        if (JSON.stringify(data[0]).includes("609"))
          console.log("      🚨 609 Found in row!");
      }
    }
  }

  // 3. Try to use a raw SQL function if one exists in the schema (RPC)
  // Common names: 'exec_sql', 'run_query', 'get_tables', 'db_inspector'
  const rpcNames = ["get_tables", "get_schema_info", "list_tables", "exec_sql"];
  console.log("\n🔮 3. Probing RPC functions...");

  for (const rpc of rpcNames) {
    try {
      const { data, error } = await supabase.rpc(rpc);
      if (!error) {
        console.log(`   ✨ Found RPC: '${rpc}'`, data);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // 4. Deep Inspect 'leads' and 'contacts'
  console.log("\n🕵️‍♂️ 4. Deep Inspect Contacts/Leads...");
  const existingTables = ["leads", "contacts", "staff", "deals"];

  for (const t of existingTables) {
    const { data } = await supabase.from(t).select("*").limit(1);
    if (data && data.length > 0) {
      console.log(`   Table '${t}' Keys:`, Object.keys(data[0]).join(", "));
      // Check for any integer value = 609
      const rowStr = JSON.stringify(data[0]);
      if (rowStr.includes(":609") || rowStr.includes(": 609"))
        console.log(`      🚨 609 Found in '${t}' sample!`);
    }

    try {
      const { data: nameMatch } = await supabase
        .from(t)
        .select("*")
        .or(`owner_name.ilike.%Bouziri%`)
        .limit(1);

      if (nameMatch && nameMatch.length > 0)
        console.log(`      🎯 BOUZIRI Found in '${t}'!`, nameMatch);
    } catch (e) {}
  }
}

run();
