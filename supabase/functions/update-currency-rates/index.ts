import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Inverts open.er-api.com rates (which are X-per-1-AED) to AED-per-1-X.
 * Exported for unit testing.
 */
export function invertRates(
  rawRates: Record<string, number>,
): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [currency, rateFromAED] of Object.entries(rawRates)) {
    const key = currency.toLowerCase();
    if (rateFromAED && typeof rateFromAED === "number" && rateFromAED > 0) {
      rates[key] = parseFloat((1 / rateFromAED).toFixed(6));
    }
  }
  rates["aed"] = 1;
  return rates;
}

/**
 * update-currency-rates
 * ─────────────────────
 * Fetches live AED exchange rates from open.er-api.com (free, no key required)
 * and stores them in org_memory_kv so stripe-dashboard-data can read live rates.
 *
 * Cron: daily at 06:00 Dubai time (02:00 UTC)
 * Scheduled via pg_cron — see migration 20260225000001_add_currency_rate_cron.sql
 */
export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Security: Verify authentication
  verifyAuth(req);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Fetch rates from open.er-api.com (base = AED, free tier, no key)
    const apiUrl = "https://open.er-api.com/v6/latest/AED";
    const res = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Exchange rate API returned ${res.status}: ${await res.text()}`);
    }

    const payload = await res.json();

    // open.er-api.com returns { "rates": { "USD": 0.272, "EUR": 0.251, ... } }
    // We store the INVERSE (currency → AED) for stripe-dashboard-data compatibility
    const rawRates: Record<string, number> = payload.rates || {};
    const rates = invertRates(rawRates);

    const storedValue = {
      rates,
      fetched_at: new Date().toISOString(),
      base: "AED",
      source: "open.er-api.com",
    };

    // 2. Upsert into org_memory_kv (namespace: config, key: currency_rates_aed)
    const { error: kvError } = await supabase
      .from("org_memory_kv")
      .upsert(
        {
          namespace: "config",
          key: "currency_rates_aed",
          value: storedValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "namespace,key" },
      );

    if (kvError) {
      throw new Error(`Failed to store rates in org_memory_kv: ${kvError.message}`);
    }

    console.log(
      `[update-currency-rates] ✅ Stored ${Object.keys(rates).length} currency rates. ` +
      `USD→AED: ${rates["usd"]}, EUR→AED: ${rates["eur"]}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        currencies_updated: Object.keys(rates).length,
        key_rates: {
          usd: rates["usd"],
          eur: rates["eur"],
          gbp: rates["gbp"],
          sar: rates["sar"],
        },
        fetched_at: storedValue.fetched_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[update-currency-rates] ❌ Error:", message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

serve(handler);
