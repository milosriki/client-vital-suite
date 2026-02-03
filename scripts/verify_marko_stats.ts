import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function runVerify() {
  console.log("📊 Verifying Marko Antic Stats...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log(`✅ Keys Loaded.`);

  // 1. Get Marko's Contacts
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, owner_name")
    .ilike("owner_name", "%Marko%");

  if (!contacts || contacts.length === 0) {
    console.log("No contacts for Marko.");
    return;
  }

  const contactIds = contacts.map((c) => c.id);
  console.log(`Found ${contacts.length} contacts for Marko.`);

  // 2. Query Deals via Contact ID (The Proper Way)
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .in("contact_id", contactIds); // This should work now if linker worked

  console.log(`\n💰 Deals Linked Properly: ${deals?.length}`);

  if (deals && deals.length > 0) {
    console.log("Sample Linked Deal:", JSON.stringify(deals[0], null, 2));

    // Stats
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];

    const confirmed = deals.filter(
      (d) =>
        (d.stage?.includes("confirm") ||
          d.stage === "122237508" ||
          d.deal_name?.includes("confirm")) &&
        d.created_at.startsWith(yStr),
    );

    console.log(`\n--- MARKO KPIs (${yStr}) ---`);
    console.log(`Confirmed Assessments: ${confirmed.length}`);

    const booked = deals.filter(
      (d) => d.stage?.includes("122221229") || d.deal_name?.includes("Book"),
    );
    console.log(`Total Booked (All Time Visible): ${booked.length}`);
  } else {
    console.log(
      "❌ Still 0 linked deals. The linker might not have matched Marko's specific contacts yet.",
    );
  }
}

runVerify();
