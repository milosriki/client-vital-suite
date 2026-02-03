import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function checkDates() {
  console.log("📅 Checking Recent Deal Activity...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  console.log(`✅ Keys Loaded.`);

  // Fetch recent deals
  // limit 1000 to get a good sample of recent days
  const { data: deals, error } = await supabase
    .from("deals")
    .select("created_at, contact_id, stage, deal_name")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (!deals || deals.length === 0) {
    console.log(
      "❌ No deals found in the entire table (or limit 1000 returned 0).",
    );
    return;
  }

  // Aggregate by Day
  const stats: Record<string, { total: number; linked: number }> = {};

  deals.forEach((d) => {
    const day = new Date(d.created_at).toISOString().split("T")[0];
    if (!stats[day]) stats[day] = { total: 0, linked: 0 };

    stats[day].total++;
    if (d.contact_id) stats[day].linked++;
  });

  console.log("\n📊 Deal Activity by Date (Most Recent First):");
  console.log("Date       | Total Deals | Linked Deals | Health %");
  console.log("-----------|-------------|--------------|----------");

  Object.keys(stats)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14) // Show last 2 weeks if available
    .forEach((date) => {
      const { total, linked } = stats[date];
      const health = ((linked / total) * 100).toFixed(0);
      console.log(
        `${date} | ${String(total).padEnd(11)} | ${String(linked).padEnd(12)} | ${health}%`,
      );
    });

  // Check specifically for Marko's Linked Deals in this batch
  console.log(
    "\n🕵️ Checking specifically for Linked Deals in this recent batch...",
  );
  const linkedSample = deals.filter((d) => d.contact_id);
  if (linkedSample.length > 0) {
    console.log(`Found ${linkedSample.length} linked deals in recent 1000.`);
    console.log(
      `Most recent linked deal: ${linkedSample[0].created_at} - ${linkedSample[0].deal_name}`,
    );
  } else {
    console.log(
      "⚠️ No linked deals found in the recent 1000. Linkage might be breaking for NEW data.",
    );
  }
}

checkDates();
