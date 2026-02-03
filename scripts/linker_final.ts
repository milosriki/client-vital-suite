import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function runLinker() {
  console.log("🔗 Starting Linker Final (Target: Marko)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log(`✅ Keys Loaded.`);

  // 1. Fetch ALL Marko Contacts
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone")
    .ilike("owner_name", "%Marko%");

  if (!contacts || contacts.length === 0) {
    console.error("No contacts for Marko");
    return;
  }
  console.log(`📚 Loaded ${contacts.length} Marko contacts.`);

  // 2. Fetch Large Batch of Orphans (limit 5000)
  const { data: orphans } = await supabase
    .from("deals")
    .select("id, deal_name")
    .is("contact_id", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (!orphans || orphans.length === 0) {
    console.log("✅ No orphan deals found!");
    return;
  }

  console.log(
    `🔍 Checking ${orphans.length} orphan deals against Marko's contacts...`,
  );

  // 3. Match Logic
  let updates = [];
  let matchCount = 0;
  const normPhone = (p: string) => (p ? p.replace(/[^0-9]/g, "") : "");

  for (const contact of contacts) {
    const cPhone = normPhone(contact.phone);
    const cName = `${contact.first_name || ""} ${contact.last_name || ""}`
      .trim()
      .toLowerCase();

    const matches = orphans.filter((d) => {
      const dName = (d.deal_name || "").toLowerCase();
      const dNameNorm = normPhone(d.deal_name || "");
      if (cPhone.length > 7 && dNameNorm.includes(cPhone)) return true;
      if (cName.length > 4 && dName.includes(cName)) return true;
      return false;
    });

    if (matches.length > 0) {
      console.log(
        `✅ Marko Contact "${contact.first_name}" matches ${matches.length} deals.`,
      );
      matches.forEach((m) => {
        updates.push({ deal_id: m.id, contact_id: contact.id });
        matchCount++;
      });
    }
  }

  console.log(`\n🎯 Matched ${matchCount} total deals for Marko.`);

  // 4. Update
  if (updates.length > 0) {
    console.log("💾 Updating DB...");
    let i = 0;
    for (const up of updates) {
      await supabase
        .from("deals")
        .update({ contact_id: up.contact_id })
        .eq("id", up.deal_id);
      process.stdout.write(".");
      i++;
    }
    console.log("\n✅ Done.");
  }
}

runLinker();
