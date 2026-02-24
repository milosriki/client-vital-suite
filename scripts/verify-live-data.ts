
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

const envLocal = await load({ envPath: ".env.local", examplePath: null });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || envLocal["SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || envLocal["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log("🔍 Verifying Live Data...");

  const checks = [
    { table: "mdm_devices", label: "📱 Devices" },
    { table: "mdm_location_events", label: "📍 GPS Points" },
    { table: "coach_visits", label: "🏙️ Visits" },
    { table: "coach_client_notes", label: "📝 Notes" },
    { table: "training_sessions_live", label: "🏋️ Sessions" },
    { table: "view_coach_behavior_scorecard", label: "📊 Scorecard Rows" }
  ];

  for (const check of checks) {
    const { count, error } = await supabase.from(check.table).select("*", { count: "exact", head: true });
    if (error) console.error(`❌ ${check.label}: Error - ${error.message}`);
    else console.log(`✅ ${check.label}: ${count} rows`);
  }
}

verify();
