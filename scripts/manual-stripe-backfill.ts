
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables from multiple sources
const env = await load({ envPath: ".env", examplePath: null });
const envLocal = await load({ envPath: ".env.local", examplePath: null }); // Override with local

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || envLocal["SUPABASE_URL"] || env["SUPABASE_URL"];
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || envLocal["SUPABASE_SERVICE_ROLE_KEY"] || env["SUPABASE_SERVICE_ROLE_KEY"];
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || envLocal["STRIPE_SECRET_KEY"] || env["STRIPE_SECRET_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
  console.error("❌ Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY)");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

async function runBackfill() {
  console.log("🚀 Starting Stripe Backfill...");

  // 1. Fetch ALL Payments (limit 100 for test, loop for full)
  let hasMore = true;
  let startingAfter: string | undefined;
  let totalPayments = 0;
  let batch: any[] = [];

  while (hasMore) {
    const params: any = { limit: 100, expand: ['data.latest_charge'] };
    if (startingAfter) params.starting_after = startingAfter;

    const payments = await stripe.paymentIntents.list(params);
    
    for (const pi of payments.data) {
      const charge = pi.latest_charge as any;
      const email = (charge?.receipt_email || charge?.billing_details?.email || pi.metadata?.email)?.toLowerCase();

      batch.push({
        stripe_id: pi.id,
        charge_id: charge?.id || null,
        customer_id: pi.customer || null,
        amount: pi.amount / 100,
        currency: pi.currency,
        status: pi.status === 'succeeded' ? 'succeeded' : pi.status,
        customer_email: email || null,
        metadata: pi.metadata,
        created_at: new Date(pi.created * 1000).toISOString(),
      });
      totalPayments++;
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("stripe_transactions").upsert(batch, { onConflict: "stripe_id" });
      if (error) console.error("❌ Error upserting batch:", error);
      else console.log(`✅ Upserted ${batch.length} payments (Total: ${totalPayments})`);
      batch = [];
    }

    hasMore = payments.has_more;
    if (payments.data.length > 0) {
      startingAfter = payments.data[payments.data.length - 1].id;
    }
  }

  console.log("🏁 Stripe Backfill Complete!");
}

runBackfill();
