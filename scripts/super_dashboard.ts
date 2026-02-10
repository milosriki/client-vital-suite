import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

// Types
interface CoachStats {
  name: string;
  clients: number;
  sessions_30d: number;
  revenue_30d: number;
  active_clients_list: string[];
}

async function run() {
  console.log("🚀 Starting 'AI CEO' Super Dashboard (Fuzzy Logic Engine)...");

  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const supabase = createClient(url, key);

  // 1. Load All Data (In Memory for Speed)
  console.log("📥 Loading Data...");

  // Contacts (The Source of Truth for Owners)
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, owner_name, first_name, last_name");

  // Appointments (The Source of Truth for Sessions)
  // We filter for updated_at > 2025 to avoid the 1970 junk
  const { data: appointments } = await supabase
    .from("appointments")
    .select("updated_at, notes")
    .gte("updated_at", "2025-01-01T00:00:00+00:00");

  // Deals (Revenue)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: deals } = await supabase
    .from("deals")
    .select("value_aed, owner_name, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (!contacts || !appointments || !deals) {
    console.error("❌ Failed to load dataset.");
    return;
  }

  console.log(
    `✅ Loaded: ${contacts.length} Contacts, ${appointments.length} Sessions, ${deals.length} Deals.`,
  );

  // 2. Build Coach Roster
  const coaches: Record<string, CoachStats> = {};

  // Helper to ensure coach exists
  const getCoach = (name: string) => {
    const key = name || "Unassigned";
    if (!coaches[key]) {
      coaches[key] = {
        name: key,
        clients: 0,
        sessions_30d: 0,
        revenue_30d: 0,
        active_clients_list: [],
      };
    }
    return coaches[key];
  };

  // 3. Process CONTACTS (Assign Clients to Coaches)
  const clientOwnerMap: Record<string, string> = {}; // "Desmond Tutu" -> "Nevena"
  const firstNameMap: Record<string, string> = {}; // "Desmond" -> "Nevena" (Fuzzy fallback)

  contacts.forEach((c) => {
    const owner = c.owner_name || "Unassigned";
    const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
    const first = (c.first_name || "").trim();

    // Stats
    getCoach(owner).clients++;

    // Maps for Session matching
    if (fullName) clientOwnerMap[fullName.toLowerCase()] = owner;
    if (first) firstNameMap[first.toLowerCase()] = owner;
  });

  // 4. Process SESSIONS (The "Fuzzy" Logic)
  // Logic: Parse Name from Note -> Find Owner from Map -> Credit Session to Coach
  let matchedSessions = 0;

  appointments.forEach((a) => {
    if (!a.notes || typeof a.notes !== "string") return;

    // Extract Name (Assumes "Name - Notes" or just "Name")
    // Simple heuristic: Take first 2 words
    const cleanNote = a.notes.split("-")[0].split("\n")[0].trim();
    const nameKey = cleanNote.toLowerCase();

    let owner = clientOwnerMap[nameKey]; // Precise Match
    if (!owner) {
      // Try First Name Match (Risky but necessary for "Fuzzy")
      const firstNameKey = nameKey.split(" ")[0];
      owner = firstNameMap[firstNameKey];
    }

    if (owner) {
      getCoach(owner).sessions_30d++;
      matchedSessions++;
      if (!getCoach(owner).active_clients_list.includes(cleanNote)) {
        getCoach(owner).active_clients_list.push(cleanNote);
      }
    }
  });

  // 5. Process REVENUE (Deals)
  deals.forEach((d) => {
    const owner = d.owner_name || "Unassigned";
    const val = Number(d.value_aed) || 0;
    getCoach(owner).revenue_30d += val;
  });

  // 6. OUTPUT REPORT
  console.log("\n🏆 COACH PERFORMANCE TABLE");
  console.log("=========================================");
  console.log("Name | Clients | Sessions (30d) | Revenue (30d) | Health Score");
  console.log("-----|---------|----------------|---------------|-------------");

  Object.values(coaches)
    .sort((a, b) => b.revenue_30d - a.revenue_30d)
    .filter((c) => c.clients > 0 || c.revenue_30d > 0) // Filter ghosts
    .forEach((c) => {
      // Health Score = (Sessions / Clients) * 4 (Weekly avg target) ... simplified
      // Just a raw metric for now
      const health =
        c.clients > 0 ? (c.sessions_30d / c.clients).toFixed(1) : "0.0";

      console.log(
        `${c.name.padEnd(20)} | ` +
          `${String(c.clients).padEnd(7)} | ` +
          `${String(c.sessions_30d).padEnd(14)} | ` +
          `AED ${String(c.revenue_30d.toLocaleString()).padEnd(9)} | ` +
          `${health}`,
      );
    });

  console.log(
    `\n✅ Session Match Rate: ${matchedSessions} / ${appointments.length} (${Math.round((matchedSessions / appointments.length) * 100)}%)`,
  );
  if (matchedSessions === 0) {
    console.log(
      "⚠️ WARNING: Fuzzy Logic matched 0 sessions. Check Note format!",
    );
  }
}

run();
