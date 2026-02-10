// scripts/audit_dialogflow_history.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  console.log("🔍 Starting Dialogflow History Audit (Node.js)...");

  // 1. Total Count
  const { count, error: countError } = await supabase
    .from("whatsapp_interactions")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Error counting messages:", countError);
    return;
  }

  console.log(
    `\n📊 Total Messages in Dialogflow Logs (whatsapp_interactions): ${count}`,
  );

  // 2. Check for Atlas Handoffs
  const { data: handoffs, error: handoffError } = await supabase
    .from("whatsapp_interactions")
    .select("*")
    .ilike("response_text", "%checking%finance%")
    .limit(50);

  if (handoffError) console.error("Error checking handoffs:", handoffError);
  console.log(`🤖 Potential Atlas Handoffs detected: ${handoffs?.length || 0}`);

  // 3. Check for Rule Violations
  const forbiddenKeywords = ["refund", "discount", "strategy", "approve"];
  const { data: violations, error: violationError } = await supabase
    .from("whatsapp_interactions")
    .select("phone_number, response_text, created_at")
    .or(forbiddenKeywords.map((k) => `response_text.ilike.%${k}%`).join(","))
    .order("created_at", { ascending: false })
    .limit(10);

  if (violationError)
    console.error("Error checking violations:", violationError);

  if (violations && violations.length > 0) {
    console.log(
      `\n⚠️ Potential Business Rule Violations (Keywords: ${forbiddenKeywords.join(", ")}):`,
    );
    violations.forEach((v) => {
      console.log(
        `  - [${new Date(v.created_at).toLocaleString()}] ${v.response_text.slice(0, 100)}...`,
      );
    });
  } else {
    console.log("\n✅ No obvious business keyword violations found.");
  }

  // 4. List Recent Interactions
  const { data: recent, error: recentError } = await supabase
    .from("whatsapp_interactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentError) {
    console.error("Error fetching recent:", recentError);
  } else {
    console.log("\nRecent 5 Interactions:");
    recent?.forEach((r) => {
      console.log(
        `\n[${new Date(r.created_at).toLocaleString()}] Phone: ${r.phone_number}`,
      );
      console.log(`USER: ${r.message_text}`);
      console.log(`LISA: ${r.response_text}`);
      if (r.metadata) console.log(`META: ${JSON.stringify(r.metadata)}`);
    });
  }
}

audit();
