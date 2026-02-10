import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  console.log("🕵️‍♂️ Starting Forensic Session Analysis...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Inspect Appointments Structure (Raw Dump)
  console.log("\n🔍 1. Raw Appointment Trace (Top 3)");
  const { data: rawAppts } = await supabase
    .from("appointments")
    .select("*")
    .limit(3);

  if (rawAppts && rawAppts.length > 0) {
    console.log("Keys available:", Object.keys(rawAppts[0]));
    console.log(
      "Sample ID Refs:",
      rawAppts.map((a) => ({
        id: a.id,
        owner_id: a.owner_id,
        // hubspot_owner_id: a.hubspot_owner_id, // Potential hidden column
        lead_id: a.lead_id,
        created_by: a.created_by, // Check if this exists
        updated_at: a.updated_at,
      })),
    );
  }

  // 2. Group by Owner ID (The "Ghost Coach" Finder)
  console.log("\n👻 2. Grouping by Owner ID...");

  // We fetch a larger batch to aggregate
  const { data: allAppts } = await supabase
    .from("appointments")
    .select("owner_id, scheduled_at")
    .limit(2000);

  if (allAppts) {
    const ownerCounts: Record<string, { count: number; range: string[] }> = {};
    const dates: Date[] = [];

    allAppts.forEach((a) => {
      const owner = a.owner_id || "NULL_OWNER";
      if (!ownerCounts[owner]) ownerCounts[owner] = { count: 0, range: [] };
      ownerCounts[owner].count++;
      if (a.scheduled_at) dates.push(new Date(a.scheduled_at));
    });

    console.table(
      Object.entries(ownerCounts).map(([id, data]) => ({
        id,
        sessions: data.count,
      })),
    );

    if (dates.length > 0) {
      const min = new Date(Math.min(...dates.map((d) => d.getTime())));
      const max = new Date(Math.max(...dates.map((d) => d.getTime())));
      console.log(
        `\n📅 Session Date Range: ${min.toISOString()} -> ${max.toISOString()}`,
      );
    }

    // 3. Resolve these Owner IDs to Users
    const ownerIds = Object.keys(ownerCounts).filter(
      (id) => id !== "NULL_OWNER",
    );
    if (ownerIds.length > 0) {
      console.log("\n🧬 3. Resolving Owner IDs to Names...");
      const { data: resolvedUsers } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, raw_user_meta_data")
        .in("id", ownerIds);

      if (resolvedUsers) {
        console.table(
          resolvedUsers.map((u) => ({
            id: u.id,
            email: u.email,
            name: `${u.first_name} ${u.last_name}`,
            meta:
              JSON.stringify(u.raw_user_meta_data || {}).substring(0, 50) +
              "...",
          })),
        );
      } else {
        console.log("⚠️ Could not resolve IDs in public.users table.");
      }
    }
  }

  // 4. Metadata Search for Zouhair (JSON scan)
  console.log("\n🔬 4. Metadata Scan for 'Zouhair'...");
  // Use try/catch as usual
  try {
    // Note: We can't easily ILIKE a json column in supabase-js without specific syntax or rpc
    // So we fetch specific users or just recent users and scan in JS
    const { data: userScan } = await supabase
      .from("users")
      .select("id, email, raw_user_meta_data")
      .limit(100);

    const match = userScan?.find((u) =>
      JSON.stringify(u).toLowerCase().includes("zouhair"),
    );
    if (match) {
      console.log("✅ FOUND ZOUHAIR in metadata!", match);
    } else {
      console.log("❌ Still no 'Zouhair' in top 100 users metadata.");
    }
  } catch (e) {
    console.error(e);
  }
}

run();
