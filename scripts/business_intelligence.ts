import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";
import Stripe from "stripe";

async function run() {
  console.log("🚀 Starting Business Intelligence Analysis...");

  // 1. Setup
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const stripeKey = content.match(/STRIPE_SECRET_KEY="([^"]+)"/)![1];

  const supabase = createClient(url, key);
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  // 2. Locate Coaches (Zouhair, Filip, Nevena)
  console.log("\n🕵️‍♂️ Locating Coaches...");
  const targetNames = ["Zouhair", "Filip", "Nevena"];
  const coaches = [];

  // Search in 'users' (metadata) and 'contacts' (crm)
  for (const name of targetNames) {
    // Try users first (auth/metadata) - usually reliable for staff
    // Note: 'users' table in public schema might be a proxy for auth.users
    // We'll also try 'contacts' where owner_name might be stored

    // Search Contacts (often used for lead ownership)
    const { data: contactMatches } = await supabase
      .from("contacts")
      .select("owner_name")
      .ilike("owner_name", `%${name}%`)
      .limit(1);

    // Search Appointments (using explicit column 'owner_name')
    let appointmentMatches = { data: [] };
    try {
      const result = await supabase
        .from("appointments")
        .select("owner_name")
        .ilike("owner_name", `%${name}%`)
        .limit(1);

      if (result.data) appointmentMatches = result;
    } catch (e) {
      // console.log("Column search failed for appointments");
    }

    if (contactMatches?.length > 0) {
      coaches.push({
        name,
        source: "contacts.owner_name",
        exact: contactMatches[0].owner_name,
      });
    } else if (appointmentMatches?.data?.length > 0) {
      coaches.push({
        name,
        source: "appointments.owner_name",
        exact: appointmentMatches.data[0].owner_name,
      });
    } else {
      console.warn(
        `⚠️ Could not find explicit record for '${name}' in standard fields.`,
      );
    }
  }

  console.log("✅ Authenticated Coaches:", coaches);

  // 3. Map Relationships (Appointments -> Clients)
  console.log("\n🔗 Mapping Clients to Coaches (via Appointments)...");

  // We'll process all appointments to build a map
  // Fetching last 2000 appointments
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, scheduled_at, lead_id, status, owner_name")
    .order("scheduled_at", { ascending: false })
    .limit(2000);

  if (!appointments) {
    console.log("❌ No appointments found.");
    return;
  }

  const coachStats: Record<
    string,
    { clients: Set<string>; sessions: number; lastSession: string }
  > = {};

  appointments.forEach((appt) => {
    // Determine coach for this appt
    const coach = appt.owner_name || "Unassigned";

    if (!coachStats[coach]) {
      coachStats[coach] = { clients: new Set(), sessions: 0, lastSession: "" };
    }

    if (appt.lead_id) coachStats[coach].clients.add(appt.lead_id);
    coachStats[coach].sessions++;
    if (!coachStats[coach].lastSession)
      coachStats[coach].lastSession = appt.scheduled_at;
  });

  // 3a. Map Clients via Contacts (Fallback since Appointments are unassigned)
  console.log("\n🔗 Mapping Clients to Coaches (via Contacts Ownership)...");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, owner_name, lead_status")
    .not("owner_name", "is", null);

  if (contacts && contacts.length > 0) {
    const contactStats: Record<string, number> = {};
    contacts.forEach((c) => {
      const owner = c.owner_name || "Unknown";
      contactStats[owner] = (contactStats[owner] || 0) + 1;
    });

    console.log("\n Coach Client Roster (Active Contacts):");
    console.table(contactStats);
  } else {
    console.log("❌ No ownership data found in Contacts either.");
  }

  // Display Stats for Target Coaches
  console.log("\n📊 Coach Performance (Last 2000 Appointments):");

  // Debug: List ALL owners found
  const allOwners = Object.keys(coachStats);
  console.log("   👉 All Active Coaches Found:", allOwners);

  Object.entries(coachStats).forEach(([coach, stats]) => {
    // Show stats for everyone with > 0 sessions to find Zouhair
    if (stats.sessions > 0) {
      console.log(`\n👨‍🏫 COACH: ${coach}`);
      console.log(`   - Active Clients: ${stats.clients.size}`);
      console.log(`   - Total Sessions: ${stats.sessions}`);
      console.log(`   - Last Session:   ${stats.lastSession}`);
    }
  });

  // 4. Revenue Reconciliation ("AWS" vs Stripe)
  console.log("\n💰 Revenue Analysis...");

  // Fetch Stripe Balance/Trans
  const balance = await stripe.balance.retrieve();
  console.log(
    `   - Stripe Available: ${balance.available[0].amount / 100} ${balance.available[0].currency.toUpperCase()}`,
  );

  // Fetch "AWS" Payments (Cash/Tabby?)
  // We suspect there might be a 'deals' table with 'value' if 'payments' is empty
  const { data: deals } = await supabase
    .from("deals") // HubSpot deals synced to Supabase?
    .select("deal_name, amount, deal_stage, close_date, pipeline") // Adjust columns based on verified schema
    .eq("deal_stage", "closedwon") // Assuming 'closedwon' or similar
    .order("close_date", { ascending: false })
    .limit(20);

  if (deals && deals.length > 0) {
    console.log("\n   - Recent Closed Deals (Supabase):");
    console.table(
      deals.map((d) => ({
        name: d.deal_name,
        amount: d.amount,
        date: new Date(d.close_date).toISOString().split("T")[0],
      })),
    );
  } else {
    console.log("   - No 'deals' found in Supabase (or schema differs).");
  }
}

run();
