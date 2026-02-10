import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Verifying Session -> CONTACT -> Coach Link...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Fetch Appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, lead_id, scheduled_at")
    .limit(50);

  if (!appointments || appointments.length === 0) return;
  console.log(`✅ Loaded ${appointments.length} appointments.`);

  const leadIds = appointments.map((a) => a.lead_id).filter(Boolean);

  // 2. Fetch CONTACTS using the 'lead_id' values
  // Hypothesis: The 'lead_id' foreign key actually points to the 'contacts' table.
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, owner_name, first_name, last_name")
    .in("id", leadIds);

  if (!contacts || contacts.length === 0) {
    console.log("❌ 'lead_id' does NOT point to 'contacts' either.");
    return;
  }

  // 4. Map and Display
  console.log("\n🔗 Linkage Verification (Appointments -> Contacts):");
  let matchedCount = 0;

  const joinResults = appointments.map((appt) => {
    const contact = contacts.find((c) => c.id === appt.lead_id);
    if (contact) matchedCount++;

    return {
      appt_id: appt.id.substring(0, 8),
      linked_to: contact
        ? `${contact.first_name || ""} ${contact.last_name || ""}`
        : "MISSING",
      coach_owner: contact ? contact.owner_name || "UNASSIGNED" : "N/A",
    };
  });

  console.table(joinResults.slice(0, 10)); // Show top 10

  console.log(`\n📊 Stats:`);
  console.log(
    `- Matched to Contacts: ${matchedCount} / ${appointments.length} (${Math.round((matchedCount / appointments.length) * 100)}%)`,
  );

  if (matchedCount > 0) {
    console.log(
      "✅ SUCCESS: Found the Data Logic! 'lead_id' in appointments -> 'id' in contacts!",
    );
  }
}

run();
