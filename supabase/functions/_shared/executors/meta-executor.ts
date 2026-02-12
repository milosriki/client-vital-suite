import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const PTD_MAIN_ACCOUNT = "act_349832333681399";

// Shared Pipeboard MCP caller — single source of truth
async function callPipeboard(tool: string, args: Record<string, unknown>): Promise<string> {
  const PB_TOKEN = Deno.env.get("PIPEBOARD_API_KEY") || "";
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

  if (!resp.ok) return `Pipeboard HTTP ${resp.status}: ${await resp.text()}`;
  const json = await resp.json();
  if (json.error) return `MCP Error: ${JSON.stringify(json.error)}`;
  return json.result?.content?.[0]?.text || JSON.stringify(json.result);
}

export async function executeMetaTools(
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  input: Record<string, unknown>,
): Promise<string> {

  switch (toolName) {
    // ─── ANALYTICS: Get insights from Pipeboard with ALL fields ───
    case "meta_ads_analytics": {
      const {
        level = "campaign",
        date_preset = "last_7d",
        limit = 50,
        ad_account_id,
        fields,
      } = input as Record<string, string | number>;

      const accountId = ad_account_id || Deno.env.get("META_AD_ACCOUNT_ID") || PTD_MAIN_ACCOUNT;

      // Default: request all key fields for agent intelligence
      const defaultFields = [
        "ad_id", "ad_name", "campaign_id", "campaign_name", "adset_id", "adset_name",
        "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "reach", "frequency",
        "actions", "action_values", "cost_per_action_type", "purchase_roas",
        "quality_ranking", "engagement_rate_ranking", "conversion_rate_ranking",
        "unique_clicks", "unique_ctr", "inline_link_clicks",
        "video_p25_watched_actions", "video_p100_watched_actions",
      ].join(",");

      return callPipeboard("get_insights", {
        object_id: accountId,
        level,
        time_range: date_preset,
        limit: Number(limit),
        fields: fields || defaultFields,
      });
    }

    // ─── DB ANALYTICS: Query persisted data (no Pipeboard tokens needed) ───
    case "meta_ads_db_query": {
      const {
        campaign_id,
        ad_id,
        date_from,
        date_to,
        order_by = "spend",
        limit = 20,
      } = input as Record<string, string | number>;

      let query = supabase
        .from("facebook_ads_insights")
        .select("*")
        .order(String(order_by), { ascending: false })
        .limit(Number(limit));

      if (campaign_id) query = query.eq("campaign_id", campaign_id);
      if (ad_id) query = query.eq("ad_id", ad_id);
      if (date_from) query = query.gte("date", date_from);
      if (date_to) query = query.lte("date", date_to);

      const { data, error } = await query;
      if (error) return `DB Error: ${JSON.stringify(error)}`;
      return JSON.stringify(data);
    }

    // ─── CREATIVE INTELLIGENCE: Get ad creatives + quality signals ───
    case "meta_creative_analysis": {
      const { limit = 20, campaign_id } = input as Record<string, string | number>;

      // Get creatives from Pipeboard
      const creatives = await callPipeboard("get_ad_creatives", {
        limit: Number(limit),
      });

      // Also pull quality rankings from DB for cross-reference
      let dbQuery = supabase
        .from("facebook_ads_insights")
        .select("ad_id, ad_name, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, spend, roas, actions, video_p100_watched")
        .not("quality_ranking", "is", null)
        .order("spend", { ascending: false })
        .limit(Number(limit));

      if (campaign_id) dbQuery = dbQuery.eq("campaign_id", campaign_id);

      const { data: qualityData } = await dbQuery;

      return JSON.stringify({
        creatives: creatives,
        quality_signals: qualityData || [],
      });
    }

    // ─── MANAGER: Campaign/ad operations ───
    case "meta_ads_manager": {
      const { action, target_id, limit = 20 } = input as Record<string, string | number>;

      const actionMap: Record<string, { tool: string; args: Record<string, unknown> }> = {
        list_campaigns: { tool: "get_campaigns", args: { limit: Number(limit), status: "ACTIVE" } },
        list_ads: { tool: "get_ads", args: { limit: Number(limit), status: "ACTIVE" } },
        get_creatives: { tool: "get_ad_creatives", args: { limit: Number(limit) } },
        audit_campaign: { tool: "get_campaign_details", args: { campaign_id: target_id } },
      };

      const mapping = actionMap[String(action)];
      if (!mapping) {
        return `Unknown action: ${action}. Supported: ${Object.keys(actionMap).join(", ")}`;
      }

      return callPipeboard(mapping.tool, mapping.args);
    }

    default:
      return `Tool ${toolName} not handled by Meta executor. Available: meta_ads_analytics, meta_ads_db_query, meta_creative_analysis, meta_ads_manager`;
  }
}
