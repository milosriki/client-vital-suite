import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// We attempt to read from process.env, assuming .env.local or similar is loaded,
// OR we rely on the hardcoded fallback which matches the user's known project.
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ CRITICAL: SUPABASE_KEY is missing. Cannot verify DB.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable(tableName: string) {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`❌ TABLE CHECK FAILED: [${tableName}] - ${error.message}`);
    return false;
  }
  console.log(`✅ TABLE [${tableName}] is ONLINE. Row count: ${count}`);
  return true;
}

async function checkEdgeFunction(funcName: string) {
  // Try a simple ping to the function
  const { data, error } = await supabase.functions.invoke(funcName, {
    body: {
      message: "System Integrity Check Ping",
      thread_id: "test-integrity",
    },
  });

  if (error) {
    console.error(`❌ FUNCTION CHECK FAILED: [${funcName}] - ${error.message}`);
    if (error.context) {
      console.error("Context:", JSON.stringify(error.context));
    }
    // SUpabase JS doesn't always give the body on error.
    return false;
  }

  if (data) {
    console.log(`✅ FUNCTION [${funcName}] responded.`);
    return true;
  }
  return false;
}

async function verifyIntegrity() {
  console.log("🔍 STARTING SYSTEM INTEGRITY SCAN (Node.js)...");
  console.log(`📡 URL: ${SUPABASE_URL}`);

  // 1. Check Core Tables (Data Sources)
  console.log("\n--- Checking Critical Tables ---");
  await checkTable("contacts"); // Leads
  await checkTable("client_health_scores"); // Clients & Coaches
  await checkTable("intervention_log"); // Calls
  await checkTable("agent_memory"); // AI Memory

  // 2. Check Meta/FB Data
  // 'marketing_attribution' or similar might hold FB data
  const metaTable = await checkTable("marketing_attribution");
  if (!metaTable)
    console.log(
      "⚠️ [marketing_attribution] table check failed. FB Data might be in raw logs.",
    );

  // 3. Function Ping (The 112 Agents)
  console.log("\n--- Invoking 'ptd-agent-gemini' (Head Agent) ---");
  await checkEdgeFunction("ptd-agent-gemini");

  console.log("\n--- Invoking 'stripe-treasury' (Finance) ---");
  await checkEdgeFunction("stripe-treasury");

  console.log("\n✅ SCAN COMPLETE.");
}

verifyIntegrity();
