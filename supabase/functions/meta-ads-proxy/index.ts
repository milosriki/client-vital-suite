// ═══════════════════════════════════════════════════════════
// SUPABASE EDGE FUNCTION: meta-ads-proxy
// AI: Anthropic (MCP tools via Pipeboard) — ONLY
// ═══════════════════════════════════════════════════════════

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const PIPEBOARD_MCP = "https://mcp.pipeboard.co/meta-ads-mcp";
const ANTHROPIC_VERSION = "2023-06-01";
const MCP_BETA = "mcp-client-2025-11-20";

// ─── Tool Profiles ────────────────────────────────────────
const TOOL_PROFILES: Record<string, object> = {
  dashboard: {
    type: "mcp_toolset",
    mcp_server_name: "meta-ads",
    default_config: { enabled: false },
    configs: {
      get_insights: { enabled: true },
      get_campaigns: { enabled: true },
      get_ad_accounts: { enabled: true },
      bulk_get_insights: { enabled: true },
      get_adsets: { enabled: true },
      get_ads: { enabled: true },
    },
  },
  management: {
    type: "mcp_toolset",
    mcp_server_name: "meta-ads",
    default_config: { enabled: false },
    configs: {
      get_campaigns: { enabled: true },
      get_adsets: { enabled: true },
      get_ads: { enabled: true },
      update_campaign: { enabled: true },
      update_adset: { enabled: true },
      update_ad: { enabled: true },
      bulk_update_campaigns: { enabled: true },
      bulk_update_adsets: { enabled: true },
      bulk_update_ads: { enabled: true },
    },
  },
  creative: {
    type: "mcp_toolset",
    mcp_server_name: "meta-ads",
    default_config: { enabled: false },
    configs: {
      get_ad_creatives: { enabled: true },
      get_ad_image: { enabled: true },
      get_creative_details: { enabled: true },
      get_ads: { enabled: true },
      get_insights: { enabled: true },
    },
  },
  targeting: {
    type: "mcp_toolset",
    mcp_server_name: "meta-ads",
    default_config: { enabled: false },
    configs: {
      search_interests: { enabled: true },
      get_interest_suggestions: { enabled: true },
      estimate_audience_size: { enabled: true },
      search_behaviors: { enabled: true },
      search_demographics: { enabled: true },
      search_geo_locations: { enabled: true },
    },
  },
  full: {
    type: "mcp_toolset",
    mcp_server_name: "meta-ads",
  },
};

// ─── Model map ────────────────────────────────────────────
const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  data_fetch: "claude-haiku-4-5-20251001",
  campaign_list: "claude-haiku-4-5-20251001",
  performance_alerts: "claude-haiku-4-5-20251001",
  budget_optimization: "claude-sonnet-4-20250514",
  creative_analysis: "claude-sonnet-4-20250514",
  audience_insights: "claude-sonnet-4-20250514",
  chat: "claude-sonnet-4-20250514",
  strategic_planning: "claude-sonnet-4-20250514",
};

// ─── PTD system prompt ────────────────────────────────────
const PTD_SYSTEM_PROMPT = `You are PTD Fitness's Meta Ads intelligence analyst.
Company: PTD Fitness — premium mobile personal training, Dubai & Abu Dhabi.
Target: Executives & professionals 40+.
Packages: 3,520–41,616 AED. Currency: AED.

RULES:
- Return ONLY valid JSON when the user requests data/metrics. No markdown, no explanation wrapping.
- Flag any campaign with CPA > 500 AED as "high_risk"
- Flag any campaign with ROAS < 2.0 as "underperforming"
- Always include: spend, conversions, CPA, ROAS in every analysis
- PTD benchmarks: target CPA < 350 AED, target ROAS > 3.0
- For conversational queries, provide analysis with specific numbers + actionable recommendations
- When analyzing creatives, focus on what converts for the 40+ executive demographic`;

// ─── Cross-validation helper ──────────────────────────────
async function crossValidate(supabaseClient: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().split("T")[0];

  const [metaResult, contactsResult, stripeResult] = await Promise.allSettled([
    supabaseClient
      .from("facebook_ads_insights")
      .select("spend, conversions, purchase_value")
      .gte("date", since),
    supabaseClient
      .from("contacts")
      .select("id, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabaseClient
      .from("stripe_events")
      .select("id, amount, created_at")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .eq("type", "payment_intent.succeeded"),
  ]);

  const metaData = metaResult.status === "fulfilled" ? (metaResult.value.data || []) : [];
  const contacts = contactsResult.status === "fulfilled" ? (contactsResult.value.data || []) : [];
  const stripeEvents = stripeResult.status === "fulfilled" ? (stripeResult.value.data || []) : [];

  const totalSpend = metaData.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.spend) || 0), 0);
  const metaConversions = metaData.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.conversions) || 0), 0);
  const metaPurchaseValue = metaData.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.purchase_value) || 0), 0);
  const hubspotNewContacts = contacts.length;
  const stripeRevenue = stripeEvents.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.amount) || 0), 0) / 100;

  const metaCPA = metaConversions > 0 ? totalSpend / metaConversions : 0;
  const metaROAS = totalSpend > 0 ? metaPurchaseValue / totalSpend : 0;
  const realCPL = hubspotNewContacts > 0 ? totalSpend / hubspotNewContacts : 0;
  const realROAS = totalSpend > 0 ? stripeRevenue / totalSpend : 0;

  return {
    meta_reported: { spend: totalSpend, conversions: metaConversions, cpa: metaCPA, roas: metaROAS },
    real: { hubspot_new_contacts: hubspotNewContacts, stripe_revenue: stripeRevenue, real_cpl: realCPL, real_roas: realROAS },
    discrepancy: {
      cpa_diff_percent: metaCPA > 0 ? ((realCPL - metaCPA) / metaCPA) * 100 : 0,
      roas_diff_percent: metaROAS > 0 ? ((realROAS - metaROAS) / metaROAS) * 100 : 0,
    },
  };
}

// ─── Anthropic MCP request ────────────────────────────────
async function callAnthropic(
  apiKey: string,
  pipeboardToken: string,
  body: Record<string, unknown>
): Promise<Response> {
  const {
    messages,
    system,
    stream = false,
    taskType = "chat",
    toolProfile = "dashboard",
    maxTokens = 4096,
    model: modelOverride,
  } = body;

  const model = (modelOverride as string) || ANTHROPIC_MODEL_MAP[taskType as string] || "claude-sonnet-4-20250514";
  const tools = [TOOL_PROFILES[(toolProfile as string)] || TOOL_PROFILES.dashboard];
  const mcpUrl = `${PIPEBOARD_MCP}?token=${pipeboardToken}`;

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    stream,
    messages,
    mcp_servers: [{ type: "url", url: mcpUrl, name: "meta-ads" }],
    tools,
    system: [{ type: "text", text: (system as string) || PTD_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  };

  return fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": MCP_BETA,
    },
    body: JSON.stringify(requestBody),
  });
}

// ─── Main handler ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    verifyAuth(req);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const pipeboardToken = Deno.env.get("PIPEBOARD_TOKEN") || "";

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!pipeboardToken) {
    return new Response(JSON.stringify({ error: "PIPEBOARD_TOKEN not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // ─── Cross-validation endpoint ────────────────────
    if (body.action === "cross_validate") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://ztjndilxurtsfqdsvfds.supabase.co";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const sbClient = createClient(supabaseUrl, serviceKey);
      const result = await crossValidate(sbClient);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      prompt,
      messages: inputMessages,
      stream = false,
      taskType = "chat",
    } = body;

    const messages = inputMessages || [{ role: "user", content: prompt }];
    const fullBody = { ...body, messages };

    // Enrich with cached data for analysis tasks
    let enrichedMessages = messages;
    if (["performance_alerts", "budget_optimization", "audience_insights", "creative_analysis"].includes(taskType)) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://ztjndilxurtsfqdsvfds.supabase.co";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const sbClient = createClient(supabaseUrl, serviceKey);

        const { data: cachedInsights } = await sbClient
          .from("facebook_ads_insights")
          .select("*")
          .order("date", { ascending: false })
          .limit(30);

        if (cachedInsights && cachedInsights.length > 0) {
          const dataContext = `\n\n[CACHED META ADS DATA - Last ${cachedInsights.length} records]\n${JSON.stringify(cachedInsights, null, 0)}`;
          const lastMsg = enrichedMessages[enrichedMessages.length - 1];
          enrichedMessages = [
            ...enrichedMessages.slice(0, -1),
            { ...lastMsg, content: lastMsg.content + dataContext },
          ];
        }
      } catch {
        // Continue without enrichment
      }
    }

    // All requests → Anthropic + Pipeboard MCP
    const response = await callAnthropic(anthropicKey, pipeboardToken, { ...fullBody, messages: enrichedMessages });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (stream) {
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await response.json();
    const textContent = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const toolResults = (data.content || [])
      .filter((b: { type: string }) => b.type === "mcp_tool_result")
      .map((b: { tool_use_id: string; is_error: boolean; content: unknown }) => ({
        toolUseId: b.tool_use_id,
        isError: b.is_error,
        content: b.content,
      }));

    return new Response(
      JSON.stringify({
        text: textContent,
        toolResults,
        usage: data.usage,
        model: data.model,
        stopReason: data.stop_reason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
