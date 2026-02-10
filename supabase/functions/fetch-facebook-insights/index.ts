import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiValidationError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const PB_TOKEN = Deno.env.get("PIPEBOARD_API_KEY")!;
const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

async function callPipeboard(tool: string, args: any) {
  console.log(`📡 Pipeboard Call: ${tool} with ${JSON.stringify(args)}`);
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: Date.now(),
    params: { name: tool, arguments: args },
  };

  const resp = await fetch(PB_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok)
    throw new Error(`Pipeboard HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  if (json.error) throw new Error(`MCP Error: ${JSON.stringify(json.error)}`);
  if (json.result?.isError)
    throw new Error(`Tool Error: ${JSON.stringify(json.result.content)}`);

  // Parse content if it's JSON text, otherwise return raw
  const content = json.result?.content?.[0]?.text;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const { date_preset = "today" } = await req.json().catch(() => ({}));

    if (!PB_TOKEN) {
      throw new Error("Missing PIPEBOARD_API_KEY");
    }

    // 1. Get Ad Account
    console.log("🔍 Fetching Ad Accounts...");
    const accounts = await callPipeboard("get_ad_accounts", { limit: 1 });

    const accountList = Array.isArray(accounts)
      ? accounts
      : accounts.data || [];

    if (accountList.length === 0) {
      throw new Error("No Ad Accounts found connected to Pipeboard.");
    }

    const adAccountId = accountList[0].id;
    const currency = accountList[0].currency || "USD";

    console.log(`✅ Using Account: ${adAccountId} (${currency})`);

    // 2. Get Insights (Ad Level for Granularity & Persistence)
    console.log(`📊 Fetching Insights (Ad Level) for ${date_preset}...`);
    // NOTE: time_range arg wants "last_3d" etc. Our input date_preset matches this usually.
    // If date_preset is "today", Pipeboard/Meta expects "today" or specific date range.
    const insights = await callPipeboard("get_insights", {
      object_id: adAccountId,
      level: "ad", // CHANGED from "campaign" to "ad" for granular tracking
      time_range: date_preset,
      limit: 500, // Increased limit to capture all ads
    });

    // Pipeboard likely returns standard Graph API structure: { data: [...] }
    const adData = Array.isArray(insights) ? insights : insights.data || [];

    // 3. Persist to Database (The Missing Link)
    console.log(
      `💾 Persisting ${adData.length} ad records to 'facebook_ads_insights'...`,
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Determine the date for the record (default to today if preset is relative)
    const recordDate =
      date_preset === "yesterday"
        ? new Date(Date.now() - 86400000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

    const dbRecords = adData.map((ad: any) => ({
      date: ad.date_start || recordDate, // Use API date if available
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      campaign_name: ad.campaign_name,
      spend: parseFloat(ad.spend) || 0,
      impressions: parseInt(ad.impressions) || 0,
      clicks: parseInt(ad.clicks) || 0,
      ctr: parseFloat(ad.ctr) || 0,
      cpc: parseFloat(ad.cpc) || 0,
    }));

    if (dbRecords.length > 0) {
      const { error: upsertError } = await supabase
        .from("facebook_ads_insights")
        .upsert(dbRecords, { onConflict: "date, ad_id" });

      if (upsertError) {
        console.error("❌ Failed to persist FB Insights:", upsertError);
        // We don't throw here to ensure the API still returns data to frontend
      } else {
        console.log("✅ Successfully persisted FB Insights.");
      }
    }

    // 4. Aggregate for Frontend (Campaign Level)
    // The frontend expects campaign-level breakdown, so we aggregate the ad data.
    const campaignMap = new Map<string, any>();

    for (const ad of adData) {
      const id = ad.campaign_id || ad.campaign_name; // Use ID or Name as key
      if (!campaignMap.has(id)) {
        campaignMap.set(id, {
          name: ad.campaign_name,
          spend: 0,
          value: 0, // needed for weighted ROAS
          clicks: 0,
          impressions: 0,
        });
      }

      const camp = campaignMap.get(id);
      const spend = parseFloat(ad.spend) || 0;
      const roas = parseFloat(ad.purchase_roas?.[0]?.value) || 0;

      camp.spend += spend;
      camp.value += spend * roas; // Weighted value
      camp.clicks += parseInt(ad.clicks) || 0;
      camp.impressions += parseInt(ad.impressions) || 0;
    }

    const campaignBreakdown = Array.from(campaignMap.values()).map((c) => ({
      name: c.name,
      spend: c.spend,
      roas: c.spend > 0 ? c.value / c.spend : 0,
      clicks: c.clicks,
      impressions: c.impressions,
    }));

    const total_spend = campaignBreakdown.reduce((sum, c) => sum + c.spend, 0);
    const total_value_global = campaignBreakdown.reduce(
      (sum, c) => sum + c.spend * c.roas,
      0,
    );
    const total_roas = total_spend > 0 ? total_value_global / total_spend : 0;

    const result = {
      success: true,
      adAccountId,
      currency,
      date_preset,
      total_spend,
      total_roas,
      breakdown: campaignBreakdown, // Frontend keeps working ✔️
      all_accounts: accountList,
      persisted_records: dbRecords.length,
    };

    return apiSuccess(result);
  } catch (error: unknown) {
    // Determine error code based on message
    let errorCode = ErrorCode.INTERNAL_ERROR;
    if (
      error instanceof Error &&
      (error.message.includes("Pipeboard") || error.message.includes("MCP"))
    ) {
      errorCode = ErrorCode.EXTERNAL_API_ERROR;
    }

    return handleError(error, "fetch-facebook-insights", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode,
      context: { function: "fetch-facebook-insights" },
    });
  }
});
