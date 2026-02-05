import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

// Load envs
if (fs.existsSync(".env")) dotenv.config({ path: ".env" });
if (fs.existsSync(".env.local")) dotenv.config({ path: ".env.local" });

// Load environment variables if needed, though usually we rely on process.env in these scripts
// Assuming SUPABASE_URL and KEY are available or we use a placeholder for local dev if not provided
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://placeholder-url.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

if (SUPABASE_URL.includes("placeholder")) {
  console.error(
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
  );
  console.log(
    "Please run with: export SUPABASE_URL=... && export SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify_data_integrity.js",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyIntegrity() {
  console.log("🔍 Starting Data Integrity Scan...");

  // 1. Check Sync Logs (Last 24h)
  console.log("\n📊 Module 1: Sync Health (Last 24h)");
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: syncLogs, error: syncError } = await supabase
    .from("sync_logs")
    .select("*")
    .gte("started_at", oneDayAgo)
    .order("started_at", { ascending: false });

  if (syncError) {
    console.error("❌ Failed to fetch sync_logs:", syncError.message);
  } else {
    const failedSyncs = syncLogs.filter(
      (l) => !["success", "completed", "partial"].includes(l.status),
    );
    if (failedSyncs.length === 0) {
      console.log("✅ All syncs successful in last 24h.");
    } else {
      console.log(`⚠️  Found ${failedSyncs.length} failed syncs:`);
      failedSyncs.forEach((f) => {
        const details = f.error_details
          ? JSON.stringify(f.error_details).slice(0, 100)
          : "No details";
        console.log(
          `   - ${f.platform} (${f.sync_type}): ${f.error_message || "Unknown Error"} | Details: ${details}`,
        );
      });
    }
  }

  // 2. Lead Count Consistency
  console.log("\n👥 Module 2: Lead Consistency");
  // Get total leads
  const { count: totalLeads, error: countError } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  if (countError) console.error("❌ Failed to count leads:", countError);
  else console.log(`   - Total Leads in DB: ${totalLeads}`);

  // Inspect Columns if needed (optional debug)
  // const { data: sampleLead } = await supabase.from('leads').select('*').limit(1);
  // if (sampleLead && sampleLead.length > 0) console.log("Columns:", Object.keys(sampleLead[0]));

  // Check for "Ghost Leads" (Leads without HubSpot ID)
  // We confirmed column is 'hubspot_id' from previous run
  const { data: ghosts, error: ghostError } = await supabase
    .from("leads")
    .select("id, email, phone, hubspot_id")
    .is("hubspot_id", null)
    .limit(10);

  if (ghostError) console.error("❌ Check for ghosts failed:", ghostError);
  else {
    if (ghosts.length > 0) {
      console.log(
        `⚠️  Found ${ghosts.length} ACTUAL Ghost Leads (No HubSpot ID):`,
      );
      ghosts.forEach((g) =>
        console.log(`   - ${g.email || g.phone} (${g.id})`),
      );
    } else {
      console.log(
        "✅ No Ghost Leads found (All checked leads have HubSpot IDs).",
      );
    }
  }

  // 3. Stale Data Check
  console.log("\n🕒 Module 3: Knowledge Base Freshness");

  // Inspect KB columns to be sure
  const { data: sampleKB } = await supabase
    .from("knowledge_base")
    .select("*")
    .limit(1);
  if (sampleKB && sampleKB.length > 0) {
    console.log("🔍 KB Table Columns:", Object.keys(sampleKB[0]).join(", "));
  }

  // Attempt check using created_at as fallback
  const { data: kbStats, error: kbError } = await supabase
    .from("knowledge_base")
    .select("created_at") // Using created_at as fallback
    .order("created_at", { ascending: false })
    .limit(1);

  if (kbError) console.log("❌ KB check failed:", kbError.message);
  else if (kbStats.length > 0) {
    console.log(
      `   - Last KB Entry: ${new Date(kbStats[0].created_at).toLocaleString()}`,
    );
  } else {
    console.log("   - Knowledge Base is empty!");
  }

  console.log("\n🏁 Scan Complete.");

  // 4. Critical Diagnosis (Deep Dive on Data Quality Flags)
  console.log("\n🩺 Module 4: Critical Diagnosis");

  // A. Check CAPI Failures (Critical Candidate)
  const { count: capiFailures } = await supabase
    .from("capi_events_enriched")
    .select("*", { count: "exact", head: true })
    .eq("send_status", "failed");

  if (capiFailures && capiFailures > 0) {
    console.log(
      `❌ CRITICAL: Found ${capiFailures} FAILED CAPI events. This hurts ad attribution.`,
    );
  }

  // B. Check Critical Interventions (Critical Candidate)
  const { count: criticalPending } = await supabase
    .from("intervention_log")
    .select("*", { count: "exact", head: true })
    .eq("priority", "CRITICAL")
    .eq("status", "PENDING");

  if (criticalPending && criticalPending > 0) {
    console.log(
      `❌ CRITICAL: Found ${criticalPending} PENDING CRITICAL INTERVENTIONS. Immediate action required.`,
    );
  }

  // C. Check Missing Coaches (High Candidate)
  const { count: missingCoach } = await supabase
    .from("client_health_scores")
    .select("*", { count: "exact", head: true })
    .in("health_zone", ["RED", "YELLOW"])
    .is("assigned_coach", null);

  if (missingCoach && missingCoach > 0) {
    console.log(
      `⚠️  HIGH: Found ${missingCoach} At-Risk Clients (Red/Yellow) with NO COACH assigned.`,
    );
  }
}

verifyIntegrity();
