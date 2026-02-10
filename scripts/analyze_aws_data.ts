import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";
import Stripe from "stripe";

async function run() {
  // Load env
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
  const stripeKey = content.match(/STRIPE_SECRET_KEY="([^"]+)"/)![1];

  const supabase = createClient(url, key);
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  console.log("🔍 analyzing 'AWS' (Supabase) Schema...");

  // 1. List all tables
  const { data: tables, error } = await supabase.rpc("get_tables");
  // If rpc doesn't exist, we try information_schema via raw query if possible,
  // but supabase-js doesn't support raw SQL easily without rpc.
  // We'll try listing likely tables by just selecting from them and handling errors.

  const likelyTables = [
    "coaches",
    "sessions",
    "appointments",
    "meetings",
    "payments",
    "transactions",
    "clients",
    "leads",
    "users",
    "profiles",
    "aymets",
  ];

  const foundTables = [];

  for (const table of likelyTables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (!error) {
      console.log(`✅ Table Found: ${table} (Count: ${count})`);
      foundTables.push(table);
    } else {
      // console.log(`❌ ${table}: ${error.message}`);
    }
  }

  // 2. Deep Dive into Found Tables
  if (foundTables.includes("coaches")) {
    const { data } = await supabase.from("coaches").select("*").limit(5);
    console.log("\n--- Coaches Sample ---");
    console.table(data);
  }

  if (
    foundTables.includes("sessions") ||
    foundTables.includes("appointments")
  ) {
    const t = foundTables.includes("sessions") ? "sessions" : "appointments";
    const { data } = await supabase
      .from(t)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    console.log(`\n--- ${t} Sample ---`);
    console.table(data);
  }

  // 3. Search for "Ayments" or Similar in Clients
  console.log("\n🔍 Searching for 'Ayments' or similar in clients/users...");
  // Try to find a user/client named Aymets or similar
  const { data: searchResults } = await supabase
    .from("contacts") // Assuming contacts is the main table based on previous turns
    .select("id, first_name, last_name, email")
    .or("first_name.ilike.%aym%,last_name.ilike.%aym%,email.ilike.%aym%")
    .limit(10);

  if (searchResults && searchResults.length > 0) {
    console.log("Found matches in Contacts:");
    console.table(searchResults);
  } else {
    console.log("No matches for 'aym' in Contacts.");
  }

  // 4. Fetch Stripe Data
  console.log("\n💳 Fetching Stripe Data (Last 5 Charges)...");
  try {
    const charges = await stripe.charges.list({ limit: 5 });
    const simplified = charges.data.map((c) => ({
      id: c.id,
      amount: c.amount / 100,
      currency: c.currency,
      status: c.status,
      created: new Date(c.created * 1000).toISOString(),
      customer: c.customer,
      receipt_email: c.receipt_email,
    }));
    console.table(simplified);
  } catch (err) {
    console.error("Stripe Error:", err.message);
  }
}

run();
