import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log(`✅ Loaded keys.`);

  // 1. Fetch Marko's Contacts to get Phones/Names
  console.log("\n🔍 Fetching Marko's Contacts...");
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, owner_name")
    .ilike("owner_name", "%Marko%")
    .limit(50); // increased limit

  if (!contacts || contacts.length === 0) {
    console.log("No Marko contacts.");
    return;
  }

  const targets = contacts.filter((c) => c.phone || c.first_name);
  console.log(`Checking ${targets.length} valid contacts against all deals...`);

  // 2. Fetch ALL Recent Deals (for memory matching)
  // fetching 1000 deals to be safe
  const { data: deals } = await supabase
    .from("deals")
    .select("id, deal_name, stage, created_at, status")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (!deals) {
    consnsole.log("No deals found.");
    return;
  }

  // 3. Match Logic
  let matchedDeals: any[] = [];

  // Normalize helper
  const norm = (s: string) => (s ? s.replace(/[^0-9]/g, "") : "");

  targets.forEach((c) => {
    const pRaw = c.phone || "";
    const pNorm = norm(pRaw);

    // Find deals matching Phone OR Name
    const matches = deals.filter((d) => {
      const dName = (d.deal_name || "").toLowerCase();
      const dNameNorm = norm(d.deal_name || "");

      // Name Match (needs both first and last, size > 3)
      const cName = `${c.first_name || ""} ${c.last_name || ""}`
        .trim()
        .toLowerCase();
      const nameMatch = cName.length > 4 && dName.includes(cName);

      // Phone Match (needs > 6 digits)
      const phoneMatch = pNorm.length > 6 && dNameNorm.includes(pNorm);

      return nameMatch || phoneMatch;
    });

    if (matches.length > 0) {
      console.log(
        `✅ LINK FOUND: Contact "${c.first_name}" -> ${matches.length} Deals`,
      );
      matches.forEach((m) => {
        // Deduplicate push
        if (!matchedDeals.find((md) => md.id === m.id)) {
          matchedDeals.push(m);
          // console.log(`   - Deal: ${m.deal_name} (${m.stage})`);
        }
      });
    }
  });

  // 4. Calculate Stats on Recovered Deals
  console.log(`\n============== RECOVERED STATS FOR MARKO ==============`);
  console.log(`Total Deals Found: ${matchedDeals.length}`);

  if (matchedDeals.length > 0) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];

    // Stage Analysis (Mapping IDs)
    // 122237508 might be confirmed?
    const confirmed = matchedDeals.filter((d) => {
      const s = String(d.stage);
      return (
        s === "confirmed" ||
        s === "122237508" ||
        (d.deal_name || "").toLowerCase().includes("confirmed")
      );
    });

    const confirmedYest = confirmed.filter((d) =>
      d.created_at.startsWith(yStr),
    );

    console.log(
      `Confirmed Assessments Yesterday (${yStr}): ${confirmedYest.length}`,
    );
    console.log(`Total Confirmed (All Time recovered): ${confirmed.length}`);

    const booked = matchedDeals.filter(
      (d) =>
        String(d.stage) === "122221229" || (d.deal_name || "").includes("Book"),
    );
    console.log(`Booked (Est): ${booked.length}`);
  }
}

run();
