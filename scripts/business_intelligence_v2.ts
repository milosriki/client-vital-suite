import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("📊 Starting Business Intelligence Audit (v2)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Coach Roster (Source: Contacts)
  console.log("\n👥 1. Coach Client Roster (Source: 'contacts')...");
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, owner_name, lead_status, last_contacted");

  const coachClients: Record<string, number> = {};
  if (contacts) {
    contacts.forEach((c) => {
      const owner = c.owner_name || "Unassigned";
      coachClients[owner] = (coachClients[owner] || 0) + 1;
    });
    console.table(coachClients);
  }

  // 2. Revenue Analysis (Source: Deals)
  console.log("\n💰 2. Revenue Analysis (Source: 'deals' - Last 30 Days)...");
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: deals } = await supabase
    .from("deals")
    .select("id, deal_name, value_aed, owner_name, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const revenueByCoach: Record<string, number> = {};
  let totalRevenue = 0;

  if (deals) {
    deals.forEach((d) => {
      const val = Number(d.value_aed) || 0; // Assuming value_aed is the price column (needs verification if VAT included)
      const owner = d.owner_name || "Unassigned";
      revenueByCoach[owner] = (revenueByCoach[owner] || 0) + val;
      totalRevenue += val;
    });

    console.log("Revenue by Coach (30d):");
    console.table(revenueByCoach);
    console.log(`Total Revenue (30d): AED ${totalRevenue.toLocaleString()}`);
  }

  // 3. Gap Report
  console.log("\n⚠️ 3. GAP REPORT (PowerBI vs Supabase)");
  console.log("---------------------------------------");
  const supabaseCoaches = Object.keys(coachClients);
  const zouheirFound = supabaseCoaches.some(
    (c) =>
      c.toLowerCase().includes("zouheir") ||
      c.toLowerCase().includes("bouziri"),
  );

  console.log(
    `Zouheir Bouziri Found in Supabase? ${zouheirFound ? "✅ YES" : "❌ NO"}`,
  );
  if (!zouheirFound) {
    console.log(
      "   -> Action: Zouheir's data must be migrated from Legacy DB to Supabase to be visible.",
    );
  }

  console.log(
    "Nevena Antonijevic Found? " +
      (supabaseCoaches.some((c) => c.includes("Nevena")) ? "✅ YES" : "❌ NO"),
  );
}

run();
