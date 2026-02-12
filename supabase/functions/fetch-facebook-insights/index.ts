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
    const { date_preset = "today", ad_account_id } = await req
      .json()
      .catch(() => ({}));

    if (!PB_TOKEN) {
      throw new Error("Missing PIPEBOARD_API_KEY");
    }

    // 1. Resolve Ad Account — default to PTD Main Account (AED, Dubai)
    // Previously used get_ad_accounts limit:1 which returned the wrong personal USD account.
    // PTD Main Account = act_349832333681399 (AED 638K+ lifetime, 17K+ leads)
    // PTD 2025 Account = act_1512094040229431 (AED 22K, newer campaigns)
    const PTD_MAIN_ACCOUNT = "act_349832333681399";
    const adAccountId =
      ad_account_id || Deno.env.get("META_AD_ACCOUNT_ID") || PTD_MAIN_ACCOUNT;
    const currency = "AED"; // PTD Main is AED

    console.log(`✅ Using Account: ${adAccountId} (${currency})`);

    // 2. Get Insights (Ad Level for Granularity & Persistence)
    // Request ALL available fields for maximum agent intelligence
    console.log(`📊 Fetching Insights (Ad Level, ALL fields) for ${date_preset}...`);
    const insights = await callPipeboard("get_insights", {
      object_id: adAccountId,
      level: "ad",
      time_range: date_preset,
      limit: 500,
      fields: [
        "ad_id", "ad_name", "campaign_id", "campaign_name", "adset_id", "adset_name",
        "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "reach", "frequency",
        "unique_clicks", "unique_ctr", "cost_per_unique_click",
        "inline_link_clicks", "cost_per_inline_link_click", "outbound_clicks",
        "actions", "action_values", "cost_per_action_type",
        "conversions", "cost_per_conversion", "purchase_roas",
        "video_p25_watched_actions", "video_p50_watched_actions",
        "video_p75_watched_actions", "video_p100_watched_actions",
        "video_avg_time_watched_actions",
        "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
        "social_spend", "website_ctr", "objective",
      ].join(","),
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

    // Helper: extract action count by type from Meta's actions array
    type MetaAction = { action_type: string; value: string };
    const getAction = (actions: MetaAction[], type: string): number =>
      parseInt(actions?.find((a: MetaAction) => a.action_type === type)?.value ?? "0") || 0;
    const getActionValue = (actionValues: MetaAction[], type: string): number =>
      parseFloat(actionValues?.find((a: MetaAction) => a.action_type === type)?.value ?? "0") || 0;
    const getVideoWatched = (actions: MetaAction[]): number =>
      parseInt(actions?.[0]?.value ?? "0") || 0;

    const dbRecords = adData.map((ad: any) => {
      const spend = parseFloat(ad.spend) || 0;
      const roasVal = parseFloat(ad.purchase_roas?.[0]?.value) || 0;
      const purchaseVal = getActionValue(ad.action_values, "omni_purchase")
        || getActionValue(ad.action_values, "purchase")
        || roasVal * spend;

      return {
        // Core identity
        date: ad.date_start || recordDate,
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        campaign_id: ad.campaign_id || null,
        campaign_name: ad.campaign_name,
        adset_id: ad.adset_id || null,
        adset_name: ad.adset_name || null,
        // Core metrics
        spend,
        impressions: parseInt(ad.impressions) || 0,
        clicks: parseInt(ad.clicks) || 0,
        ctr: parseFloat(ad.ctr) || 0,
        cpc: parseFloat(ad.cpc) || 0,
        cpm: parseFloat(ad.cpm) || null,
        reach: parseInt(ad.reach) || null,
        leads: getAction(ad.actions, "lead") || parseInt(ad.leads) || 0,
        roas: roasVal,
        purchase_value: purchaseVal,
        // New: engagement & click quality
        frequency: parseFloat(ad.frequency) || null,
        unique_clicks: parseInt(ad.unique_clicks) || null,
        unique_ctr: parseFloat(ad.unique_ctr) || null,
        cost_per_unique_click: parseFloat(ad.cost_per_unique_click) || null,
        inline_link_clicks: parseInt(ad.inline_link_clicks) || null,
        cost_per_inline_link_click: parseFloat(ad.cost_per_inline_link_click) || null,
        outbound_clicks: parseInt(ad.outbound_clicks?.[0]?.value) || null,
        // New: full action data (JSONB) — agents query this for deep analysis
        actions: ad.actions || [],
        action_values: ad.action_values || [],
        cost_per_action_type: ad.cost_per_action_type || [],
        conversions: getAction(ad.actions, "offsite_conversion.fb_pixel_purchase")
          + getAction(ad.actions, "omni_purchase"),
        cost_per_conversion: parseFloat(ad.cost_per_conversion) || null,
        // New: video metrics (creative analysis)
        video_p25_watched: getVideoWatched(ad.video_p25_watched_actions),
        video_p50_watched: getVideoWatched(ad.video_p50_watched_actions),
        video_p75_watched: getVideoWatched(ad.video_p75_watched_actions),
        video_p100_watched: getVideoWatched(ad.video_p100_watched_actions),
        video_avg_time_watched: parseFloat(ad.video_avg_time_watched_actions?.[0]?.value) || null,
        // New: Meta quality signals (agent intelligence)
        quality_ranking: ad.quality_ranking || null,
        engagement_rate_ranking: ad.engagement_rate_ranking || null,
        conversion_rate_ranking: ad.conversion_rate_ranking || null,
        // New: additional
        social_spend: parseFloat(ad.social_spend) || null,
        website_ctr: parseFloat(ad.website_ctr?.[0]?.value) || null,
        objective: ad.objective || null,
        // Timestamp
        updated_at: new Date().toISOString(),
      };
    });

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
    const campaignMap = new Map<string, {
      name: string; id: string; spend: number; value: number;
      clicks: number; impressions: number; reach: number; leads: number; conversions: number;
    }>();

    for (const ad of adData) {
      const id = ad.campaign_id || ad.campaign_name;
      if (!campaignMap.has(id)) {
        campaignMap.set(id, {
          name: ad.campaign_name, id,
          spend: 0, value: 0, clicks: 0, impressions: 0, reach: 0, leads: 0, conversions: 0,
        });
      }

      const camp = campaignMap.get(id)!;
      const spend = parseFloat(ad.spend) || 0;
      const roas = parseFloat(ad.purchase_roas?.[0]?.value) || 0;

      camp.spend += spend;
      camp.value += spend * roas;
      camp.clicks += parseInt(ad.clicks) || 0;
      camp.impressions += parseInt(ad.impressions) || 0;
      camp.reach += parseInt(ad.reach) || 0;
      camp.leads += getAction(ad.actions, "lead") || parseInt(ad.leads) || 0;
      camp.conversions += getAction(ad.actions, "omni_purchase") || 0;
    }

    const campaignBreakdown = Array.from(campaignMap.values()).map((c) => ({
      name: c.name,
      campaign_id: c.id,
      spend: c.spend,
      roas: c.spend > 0 ? c.value / c.spend : 0,
      clicks: c.clicks,
      impressions: c.impressions,
      reach: c.reach,
      leads: c.leads,
      conversions: c.conversions,
      cpl: c.leads > 0 ? c.spend / c.leads : 0,
    }));

    const total_spend = campaignBreakdown.reduce((sum, c) => sum + c.spend, 0);
    const total_leads = campaignBreakdown.reduce((sum, c) => sum + c.leads, 0);
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
      total_leads,
      total_cpl: total_leads > 0 ? total_spend / total_leads : 0,
      breakdown: campaignBreakdown,
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
