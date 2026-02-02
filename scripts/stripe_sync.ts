import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing credentials");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2025-01-27.acacia" as any,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncStripeCustomer() {
  try {
    /* List recent customers (commented out to focus on Phil)
    console.log('🔎 Listing recent customers...');
    const listResult = await stripe.customers.list({ limit: 10 });

    if (listResult.data.length === 0) {
      console.log("⚠️ No customers found in this Stripe account.");
      return;
    }

    console.log(`✅ Found ${listResult.data.length} customers.`);
    for (const c of listResult.data) {
      console.log(`   - ${c.name} (${c.email}) [${c.id}]`);
    }
    */

    // Search by name (Stripe search API is powerful)
    console.log("🔎 Searching Stripe for Phil Dunn...");
    const searchResult = await stripe.customers.search({
      query: 'name~"Phil Dunn"',
    });

    if (searchResult.data.length === 0) {
      console.log("⚠️ Phil Dunn not found in Stripe.");
      return;
    }

    const customer = searchResult.data[0];
    console.log(
      `✅ Found in Stripe: ${customer.name} (${customer.email}, ID: ${customer.id})`,
    );

    // Upsert to Supabase
    console.log(`🔄 Syncing to Supabase...`);
    const { error } = await supabase.from("clients").upsert(
      {
        stripe_customer_id: customer.id,
        name: customer.name,
        email: customer.email,
        status: "customer",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (error) {
      console.error(`❌ Failed to sync: ${error.message}`);
    } else {
      console.log(`✅ Successfully synced Phil Dunn from Stripe to Supabase.`);
    }
  } catch (err: any) {
    console.error("❌ Stripe API Error:", err.message);
  }
}

syncStripeCustomer();
