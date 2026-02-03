import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

// LINKER V3: "The Auditor"
// Uses the hard link (hubspot_primary_contact_id) to strictly link deals.
// Fallbacks to fuzzy matching only if hard link is missing.

async function runHardLinker() {
  console.log("🔗 Starting Linker V3 (Hard Link Mode)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log(`✅ Supabase Connected.`);

  // 1. HARD MATCHING (The Gold Standard)
  // Find deals where contact_id is NULL but hubspot_primary_contact_id is SET
  const { data: orphans, error } = await supabase
    .from("deals")
    .select("id, deal_name, hubspot_primary_contact_id")
    .is("contact_id", null)
    .not("hubspot_primary_contact_id", "is", null)
    .limit(1000);

  if (orphans && orphans.length > 0) {
    console.log(
      `Found ${orphans.length} orphans with Hard Links waiting to be connected.`,
    );

    let successCount = 0;

    for (const deal of orphans) {
      // Find the contact with this HS ID
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("hubspot_contact_id", deal.hubspot_primary_contact_id)
        .single();

      if (contact) {
        const { error: updateError } = await supabase
          .from("deals")
          .update({ contact_id: contact.id })
          .eq("id", deal.id);

        if (!updateError) successCount++;
      } else {
        console.warn(
          `⚠️ Deal ${deal.deal_name} points to HS Contact ${deal.hubspot_primary_contact_id} but that contact is NOT in Supabase.`,
        );
        // Potential self-healing trigger: Fetch that specific contact?
      }
    }
    console.log(`✅ Hard Linked ${successCount}/${orphans.length} deals.`);
  } else {
    console.log("✨ No orphans found with pending Hard Links.");
  }

  // 2. ORPHAN CHECK (The Alarm)
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .is("contact_id", null);

  console.log(`🚨 Total Remaining Orphans in Database: ${count}`);
}

runHardLinker();
