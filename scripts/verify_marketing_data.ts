import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error("❌ CRITICAL: SUPABASE_KEY is missing.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMarketingData() {
  console.log("🔍 CEO DATA AUDIT: Marketing & Attribution");

  // 1. Check Attribution Table
  const { count: attrCount, error: attrError } = await supabase
    .from("marketing_attribution")
    .select("*", { count: "exact", head: true });
  console.log(
    `- Marketing Attribution Rows: ${attrError ? "ERROR: " + attrError.message : attrCount}`,
  );

  // 2. Check Facebook Insights Table (if exists)
  const { count: fbCount, error: fbError } = await supabase
    .from("facebook_insights")
    .select("*", { count: "exact", head: true });
  console.log(
    `- Facebook Insights Rows: ${fbError ? "ERROR (Table might not exist): " + fbError.message : fbCount}`,
  );

  // 3. Check for specific "Ad Spend" logs in agent memory
  const { data: memoryScan } = await supabase
    .from("agent_memory")
    .select("query, response")
    .ilike("query", "%spend%")
    .limit(3);

  console.log(
    `- Agent 'Spend' Awareness: Found ${memoryScan?.length || 0} memory entries related to 'spend'.`,
  );

  if ((attrCount === 0 || attrCount === null) && (fbCount === 0 || fbError)) {
    console.log(
      "\n🚨 CRITICAL FINDING: You have ZERO marketing data. You cannot calculate ROAS.",
    );
  } else {
    console.log("\n✅ Marketing Data exists.");
  }
}

checkMarketingData();
