import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log(
    "🕵️‍♂️ Tracing Appointment Foreign Keys (The 'Needle in Haystack')...",
  );

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Get a Target UUID from Appointments
  const { data: appts } = await supabase
    .from("appointments")
    .select("lead_id, id")
    .not("lead_id", "is", null)
    .limit(1);

  if (!appts || appts.length === 0) {
    console.log("❌ No appointments with lead_id found.");
    return;
  }

  const targetId = appts[0].lead_id;
  console.log(`🎯 Target UUID from Appointments: ${targetId}`);

  // 2. Define Suspect Tables to Scan
  const suspects = [
    "leads",
    "contacts",
    "users",
    "profiles",
    "clients",
    "members",
    "hubspot_contacts",
    "hubspot_leads",
    "legacy_users",
  ];

  // 3. Scan Each Table for this ID
  console.log("\n🔍 Scanning tables for this ID...");

  for (const table of suspects) {
    try {
      const { data } = await supabase
        .from(table)
        .select("id")
        .eq("id", targetId)
        .limit(1);

      if (data && data.length > 0) {
        console.log(`✅ MATCH FOUND in table: '${table}'`);
        // If found, let's see the record to check for coach info
        const { data: record } = await supabase
          .from(table)
          .select("*")
          .eq("id", targetId);
        console.log("   -> Record:", record);
        return;
      } else {
        process.stdout.write(`   [${table}]: No match `);
      }
    } catch (e) {
      process.stdout.write(`   [${table}]: Access Error `);
    }
  }

  console.log("\n\n❌ ID not found in any standard 'id' column.");
  console.log(
    "   -> Checking secondary columns (e.g. hubspot_id, foreign keys)...",
  );

  // 4. Check Secondary Columns in Leads/Contacts
  // Maybe appointments.lead_id -> leads.hubspot_id?
  const { data: secondaryMatch } = await supabase
    .from("leads")
    .select("*")
    .or(`hubspot_id.eq.${targetId},facebook_lead_id.eq.${targetId}`)
    .limit(1);

  if (secondaryMatch && secondaryMatch.length > 0) {
    console.log(
      "✅ MATCH FOUND in 'leads' (Secondary Column)!",
      secondaryMatch,
    );
  }
}

run();
