import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Verifying Session -> Lead -> Coach Link...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Fetch Appointments (The "Done Sessions")
  // We want to see if we can link them to a Lead, and then to a Coach.
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, lead_id, scheduled_at, owner_id")
    .limit(50); // Sample

  if (!appointments || appointments.length === 0) {
    console.log("❌ No appointments found.");
    return;
  }

  console.log(`✅ Loaded ${appointments.length} appointments.`);

  // 2. Extract Lead IDs
  const leadIds = appointments.map((a) => a.lead_id).filter(Boolean);

  if (leadIds.length === 0) {
    console.log("❌ Appointments have no lead_id links!");
    return;
  }

  // 3. Fetch Leads for these Appointments
  const { data: leads } = await supabase
    .from("leads")
    .select("id, assigned_coach, name, status")
    .in("id", leadIds);

  if (!leads) {
    console.log("❌ Could not fetch linked leads.");
    return;
  }

  // 4. Map and Display
  console.log("\n🔗 Linkage Verification:");
  let matchedCount = 0;
  let coachFoundCount = 0;

  const joinResults = appointments.map((appt) => {
    const lead = leads.find((l) => l.id === appt.lead_id);
    if (lead) matchedCount++;
    if (lead && lead.assigned_coach) coachFoundCount++;

    return {
      appt_id: appt.id.substring(0, 8),
      date: appt.scheduled_at,
      lead: lead ? lead.name : "UNKNOWN",
      coach: lead ? lead.assigned_coach || "UNASSIGNED" : "N/A",
    };
  });

  console.table(joinResults.slice(0, 10)); // Show top 10

  console.log(`\n📊 Stats:`);
  console.log(`- Appointments Sampled: ${appointments.length}`);
  console.log(
    `- Linked to Lead: ${matchedCount} (${Math.round((matchedCount / appointments.length) * 100)}%)`,
  );
  console.log(
    `- Resolved to Coach: ${coachFoundCount} (${Math.round((coachFoundCount / appointments.length) * 100)}%)`,
  );

  if (coachFoundCount > 0) {
    console.log(
      "\n✅ SUCCESS: We can link Sessions to Coaches via the Lead table!",
    );
    console.log("   -> Start 'Active Client' Logic.");
  } else {
    console.log(
      "\n⚠️ FAILURE: Leads are linked, but 'assigned_coach' is empty.",
    );
  }
}

run();
