import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing credentials");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
  console.log("🏥 DIAGNOSING CRITICAL DATA ISSUES...");

  // 1. Check CAPI Failures (Critical)
  const { count: failedCapi } = await supabase
    .from("capi_events_enriched")
    .select("*", { count: "exact", head: true })
    .eq("send_status", "failed");
  if (failedCapi && failedCapi > 0)
    console.log(
      `❌ CRITICAL: ${failedCapi} CAPI Events Failed (Ad tracking data loss)`,
    );

  // 2. Check Missing Emails (Critical)
  const { data: noEmail, count: countNoEmail } = await supabase
    .from("client_health_scores")
    .select("firstname, lastname")
    .or("email.is.null,email.eq.");
  if (countNoEmail && countNoEmail > 0) {
    console.log(
      `❌ CRITICAL: ${countNoEmail} Clients missing Email (Cannot sync/contact)`,
    );
    noEmail?.forEach((c) => console.log(`   - ${c.firstname} ${c.lastname}`));
  }

  // 3. Check Invalid Scores (High)
  const { count: invalidScores } = await supabase
    .from("client_health_scores")
    .select("*", { count: "exact", head: true })
    .or("health_score.lt.0,health_score.gt.100");
  if (invalidScores && invalidScores > 0)
    console.log(`⚠️ HIGH: ${invalidScores} Invalid Health Scores detected`);

  // 4. Check Missing Coach (High)
  const { count: noCoach } = await supabase
    .from("client_health_scores")
    .select("*", { count: "exact", head: true })
    .or("assigned_coach.is.null")
    .in("health_zone", ["RED", "YELLOW"]);
  if (noCoach && noCoach > 0)
    console.log(`⚠️ HIGH: ${noCoach} At-Risk Clients have NO COACH assigned`);

  if (!failedCapi && !countNoEmail && !invalidScores && !noCoach) {
    console.log("✅ No Critical/High Data Issues found via direct query.");
  }
}

diagnose();
