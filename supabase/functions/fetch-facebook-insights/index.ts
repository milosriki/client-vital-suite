import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

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
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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

    // 2. Get Insights (Campaign Level)
    console.log(`📊 Fetching Insights for ${date_preset}...`);
    // NOTE: time_range arg wants "last_3d" etc. Our input date_preset matches this usually.
    const insights = await callPipeboard("get_insights", {
      object_id: adAccountId,
      level: "campaign",
      time_range: date_preset,
      limit: 50,
    });

    // Pipeboard likely returns standard Graph API structure: { data: [...] }
    const campaignData = Array.isArray(insights)
      ? insights
      : insights.data || [];

    // 3. Format for Frontend
    const total_spend = campaignData.reduce(
      (sum: number, c: any) => sum + (parseFloat(c.spend) || 0),
      0,
    );

    // Calculate weighted ROAS (Total Value / Total Spend)
    // Value = Spend * ROAS
    const total_value = campaignData.reduce((sum: number, c: any) => {
      const spend = parseFloat(c.spend) || 0;
      const roas = parseFloat(c.purchase_roas?.[0]?.value) || 0;
      return sum + spend * roas;
    }, 0);

    const total_roas = total_spend > 0 ? total_value / total_spend : 0;

    const result = {
      success: true,
      adAccountId,
      currency,
      date_preset,
      total_spend,
      total_roas,
      breakdown: campaignData.map((c: any) => ({
        name: c.campaign_name || c.campaign_id, // Fallback
        spend: c.spend || 0,
        roas: c.purchase_roas?.[0]?.value || 0,
        clicks: c.clicks || 0,
      })),
      all_accounts: accountList,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Determine error code based on message
    let errorCode = ErrorCode.INTERNAL_ERROR;
    if (error.message.includes("Pipeboard") || error.message.includes("MCP")) {
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
