import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Inspecting Real Dates (created_at) & Notes Parsing...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // Fetch 20 rows
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, scheduled_at, created_at, updated_at, notes, lead_id")
    .limit(30)
    .order("created_at", { ascending: false });

  if (!appts) return;

  console.log("\n📅 Date Comparison (Scheduled vs Created):");
  console.table(
    appts.map((a) => ({
      scheduled: a.scheduled_at,
      created: a.created_at, // HOPING for valid dates here
      updated: a.updated_at,
      notes: (a.notes || "").substring(0, 30), // Show content
    })),
  );

  // Logic Verification for BI Script
  console.log("\n🧠 Logic Test: Note -> Client Name -> Coach?");
  // Let's take the first 5 notes and try to find them in contacts

  const sampleNotes = appts.filter((a) => a.notes).slice(0, 5);
  for (const a of sampleNotes) {
    const nameGuess = (a.notes as string).split("-")[0].trim(); // "Connie " from "Connie - Shayma"
    if (nameGuess.length < 3) continue;

    console.log(`   Searching Contact: '${nameGuess}'...`);
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, owner_name, first_name, last_name")
      .ilike("first_name", `%${nameGuess}%`)
      .limit(1);

    if (contact && contact.length > 0) {
      console.log(
        `      ✅ MATCH: ${contact[0].first_name} ${contact[0].last_name} -> Coach: ${contact[0].owner_name}`,
      );
    } else {
      console.log(`      ❌ No Match in Contacts.`);
    }
  }
}

run();
