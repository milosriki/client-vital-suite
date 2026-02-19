import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AD_ACCOUNT = "act_349832333681399";

// Helper: call meta-ads-proxy
async function callProxy(taskType: string, prompt: string, toolProfile = "dashboard"): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-ads-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-task-type": taskType,
      "x-tool-profile": toolProfile,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Extract text from Anthropic response format
  if (data.content) {
    const textBlock = data.content.find((b: Record<string, unknown>) => b.type === "text");
    return textBlock?.text || JSON.stringify(data.content);
  }
  return JSON.stringify(data);
}

// Extract JSON array from AI response text
function extractJson(text: string): unknown[] {
  // Try direct parse
  try { const p = JSON.parse(text); return Array.isArray(p) ? p : [p]; } catch { /* noop */ }
  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { const p = JSON.parse(match[1]); return Array.isArray(p) ? p : [p]; } catch { /* noop */ }
  }
  // Try finding array in text
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* noop */ }
  }
  return [];
}

// Extract action value from actions array
function extractAction(actions: Record<string, string>[] | null, actionType: string): number | null {
  if (!actions || !Array.isArray(actions)) return null;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? Number(action.value) || null : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const log: string[] = [];
  const now = new Date().toISOString();

  try {
    // --- 1. Sync Campaigns → facebook_ads_insights ---
    log.push("Fetching campaigns...");
    const campaignText = await callProxy(
      "data_fetch",
      `Get insights for ad account ${AD_ACCOUNT} for the last 30 days. Return JSON array with fields: campaign_id, campaign_name, status, spend, impressions, clicks, conversions, ctr, cpc, cpa, roas, reach, frequency, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, actions (full array), date_start, date_stop. Include ALL campaigns.`
    );
    const campaigns = extractJson(campaignText);
    log.push(`Parsed ${campaigns.length} campaigns`);

    for (const c of campaigns as Record<string, unknown>[]) {
      const actions = c.actions as Record<string, string>[] | null;
      const { error } = await supabase.from("facebook_ads_insights").upsert(
        {
          campaign_id: String(c.campaign_id || ""),
          campaign_name: c.campaign_name,
          status: c.status,
          spend: Number(c.spend) || 0,
          impressions: Number(c.impressions) || 0,
          clicks: Number(c.clicks) || 0,
          conversions: Number(c.conversions) || 0,
          ctr: Number(c.ctr) || 0,
          cpc: Number(c.cpc) || 0,
          cpa: Number(c.cpa) || 0,
          roas: Number(c.roas) || 0,
          reach: Number(c.reach) || null,
          frequency: Number(c.frequency) || null,
          quality_ranking: c.quality_ranking || null,
          engagement_rate_ranking: c.engagement_rate_ranking || null,
          conversion_rate_ranking: c.conversion_rate_ranking || null,
          raw_actions: actions || null,
          link_clicks: extractAction(actions, "link_click"),
          landing_page_views: extractAction(actions, "landing_page_view"),
          lead_form_submissions: extractAction(actions, "lead") || extractAction(actions, "onsite_conversion.lead_grouped"),
          messaging_conversations: extractAction(actions, "onsite_conversion.messaging_conversation_started_7d"),
          video_views: extractAction(actions, "video_view"),
          video_p25: extractAction(actions, "video_p25_watched_actions"),
          video_p50: extractAction(actions, "video_p50_watched_actions"),
          video_p75: extractAction(actions, "video_p75_watched_actions"),
          date: c.date_start || c.date,
          last_synced_at: now,
        },
        { onConflict: "campaign_id,date", ignoreDuplicates: false }
      );
      if (error) log.push(`Campaign upsert error: ${error.message}`);
    }
    log.push(`✅ Campaigns synced`);

    // --- 2. Sync Ad Sets → meta_ad_sets ---
    log.push("Fetching ad sets...");
    const adSetText = await callProxy(
      "data_fetch",
      `Get ad set level insights for ad account ${AD_ACCOUNT} for the last 30 days. Return JSON array with: ad_set_id, ad_set_name, campaign_id, campaign_name, status, daily_budget, lifetime_budget, targeting, optimization_goal, bid_strategy, spend, impressions, clicks, conversions, cpa, roas, reach, frequency, actions, date_start, date_stop.`
    );
    const adSets = extractJson(adSetText);
    log.push(`Parsed ${adSets.length} ad sets`);

    for (const a of adSets as Record<string, unknown>[]) {
      const { error } = await supabase.from("meta_ad_sets").upsert(
        {
          ad_set_id: String(a.ad_set_id || ""),
          ad_set_name: a.ad_set_name,
          campaign_id: a.campaign_id,
          campaign_name: a.campaign_name,
          status: a.status,
          daily_budget: Number(a.daily_budget) || null,
          lifetime_budget: Number(a.lifetime_budget) || null,
          targeting: a.targeting || null,
          optimization_goal: a.optimization_goal,
          bid_strategy: a.bid_strategy,
          spend: Number(a.spend) || 0,
          impressions: Number(a.impressions) || 0,
          clicks: Number(a.clicks) || 0,
          conversions: Number(a.conversions) || 0,
          cpa: Number(a.cpa) || null,
          roas: Number(a.roas) || null,
          reach: Number(a.reach) || null,
          frequency: Number(a.frequency) || null,
          date_start: a.date_start,
          date_stop: a.date_stop,
          raw_actions: a.actions || null,
          last_synced_at: now,
        },
        { onConflict: "ad_set_id,date_start", ignoreDuplicates: false }
      );
      if (error) log.push(`Ad set upsert error: ${error.message}`);
    }
    log.push(`✅ Ad sets synced`);

    // --- 3. Sync Ads → meta_ads ---
    log.push("Fetching ads...");
    const adsText = await callProxy(
      "data_fetch",
      `Get ad level insights for ad account ${AD_ACCOUNT} for the last 30 days. Return JSON array with: ad_id, ad_name, ad_set_id, ad_set_name, campaign_id, campaign_name, status, spend, impressions, clicks, conversions, ctr, cpc, cpa, roas, reach, frequency, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, actions, date_start, date_stop.`
    );
    const ads = extractJson(adsText);
    log.push(`Parsed ${ads.length} ads`);

    for (const ad of ads as Record<string, unknown>[]) {
      const { error } = await supabase.from("meta_ads").upsert(
        {
          ad_id: String(ad.ad_id || ""),
          ad_name: ad.ad_name,
          ad_set_id: ad.ad_set_id,
          ad_set_name: ad.ad_set_name,
          campaign_id: ad.campaign_id,
          campaign_name: ad.campaign_name,
          status: ad.status,
          spend: Number(ad.spend) || 0,
          impressions: Number(ad.impressions) || 0,
          clicks: Number(ad.clicks) || 0,
          conversions: Number(ad.conversions) || 0,
          ctr: Number(ad.ctr) || null,
          cpc: Number(ad.cpc) || null,
          cpa: Number(ad.cpa) || null,
          roas: Number(ad.roas) || null,
          reach: Number(ad.reach) || null,
          frequency: Number(ad.frequency) || null,
          quality_ranking: ad.quality_ranking || null,
          engagement_rate_ranking: ad.engagement_rate_ranking || null,
          conversion_rate_ranking: ad.conversion_rate_ranking || null,
          raw_actions: ad.actions || null,
          date_start: ad.date_start,
          date_stop: ad.date_stop,
          last_synced_at: now,
        },
        { onConflict: "ad_id,date_start", ignoreDuplicates: false }
      );
      if (error) log.push(`Ad upsert error: ${error.message}`);
    }
    log.push(`✅ Ads synced`);

    return new Response(
      JSON.stringify({ success: true, log, synced_at: now }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log.push(`❌ Fatal: ${String(error)}`);
    return new Response(
      JSON.stringify({ success: false, error: String(error), log }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
