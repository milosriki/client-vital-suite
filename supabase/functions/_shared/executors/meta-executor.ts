import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export async function executeMetaTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  const PB_TOKEN = "pk_5f94902b81e24b1bb5bdf85e51bd7226"; // TODO: Move to Env
  const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

  switch (toolName) {
    case "meta_ads_analytics": {
      const { level = "campaign", date_preset = "last_7d", limit = 10 } = input;

      console.log(`📊 Calling Pipeboard Insights (${level})...`);
      try {
        // JSON-RPC to Pipeboard
        const payload = {
          jsonrpc: "2.0",
          method: "tools/call",
          id: Date.now(),
          params: {
            name: "get_insights",
            arguments: {
              level,
              date_preset: date_preset,
              limit: Number(limit),
            },
          },
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
          return `Pipeboard API Error: ${resp.status} ${await resp.text()}`;
        const json = await resp.json();

        // Result is usually in result.content[0].text
        if (json.error) return `MCP Error: ${JSON.stringify(json.error)}`;
        const content = json.result?.content?.[0]?.text;
        return content || JSON.stringify(json.result);
      } catch (e) {
        return `Meta Ads Analytics Error: ${e}`;
      }
    }

    case "meta_ads_manager": {
      const { action, target_id, value, limit = 20 } = input;

      // Map high-level actions to MCP tools
      let mcpToolName = "";
      let toolArgs = {};

      if (action === "list_campaigns") {
        mcpToolName = "get_campaigns";
        toolArgs = { limit: Number(limit), status: "ACTIVE" };
      } else if (action === "list_ads") {
        mcpToolName = "get_ads";
        toolArgs = { limit: Number(limit), status: "ACTIVE" };
      } else if (action === "get_creatives") {
        mcpToolName = "get_ad_creatives";
        toolArgs = { limit: Number(limit) };
      } else if (action === "audit_campaign") {
        // Complex flow? Just get details for now
        mcpToolName = "get_campaign_details";
        toolArgs = { campaign_id: target_id };
      } else {
        return `Unknown Meta Ads Action: ${action}. Supported: list_campaigns, list_ads, get_creatives`;
      }

      try {
        const payload = {
          jsonrpc: "2.0",
          method: "tools/call",
          id: Date.now(),
          params: {
            name: mcpToolName,
            arguments: toolArgs,
          },
        };

        const resp = await fetch(PB_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PB_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) return `Pipeboard HTTP Error: ${resp.status}`;
        const json = await resp.json();
        if (json.error) return `MCP Error: ${JSON.stringify(json.error)}`;
        return json.result?.content?.[0]?.text || JSON.stringify(json.result);
      } catch (e) {
        return `Meta Ads Manager Error: ${e}`;
      }
    }

    default:
      return `Tool ${toolName} not handled by Meta executor.`;
  }
}
