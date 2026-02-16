import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const PTD_MAIN_ACCOUNT = "act_349832333681399";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function callPipeboard(tool: string, args: Record<string, unknown>): Promise<unknown> {
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

  if (!resp.ok) throw new Error(`Pipeboard HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  if (json.error) throw new Error(`MCP Error: ${JSON.stringify(json.error)}`);
  if (json.result?.isError) throw new Error(`Tool Error: ${JSON.stringify(json.result.content)}`);

  const content = json.result?.content?.[0]?.text;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

async function listPipeboardTools(): Promise<unknown> {
  const PB_TOKEN = Deno.env.get("PIPEBOARD_API_KEY") || "";
  const payload = {
    jsonrpc: "2.0",
    method: "tools/list",
    id: Date.now(),
    params: {},
  };

  const resp = await fetch(PB_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) throw new Error(`Pipeboard HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return json.result?.tools || json.result || json;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action = "fetch_leads", ad_account_id, limit = 100, form_id } = body as Record<string, unknown>;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Action: discover available Pipeboard tools
    if (action === "list_tools") {
      const tools = await listPipeboardTools();
      return new Response(JSON.stringify({ success: true, tools }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Action: fetch leads from Facebook Lead Ads API via Pipeboard
    if (action === "fetch_leads") {
      const accountId = ad_account_id || Deno.env.get("META_AD_ACCOUNT_ID") || PTD_MAIN_ACCOUNT;

      // Try get_leads tool first
      let leads: unknown;
      try {
        leads = await callPipeboard("get_leads", {
          ad_account_id: accountId,
          limit: Number(limit),
          ...(form_id ? { form_id: String(form_id) } : {}),
        });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        // If get_leads doesn't exist, try get_lead_forms first then leads per form
        if (errMsg.includes("not found") || errMsg.includes("unknown tool") || errMsg.includes("Tool Error")) {
          try {
            leads = await callPipeboard("get_lead_gen_forms", {
              ad_account_id: accountId,
              limit: Number(limit),
            });
          } catch (e2: unknown) {
            const errMsg2 = e2 instanceof Error ? e2.message : String(e2);
            return new Response(JSON.stringify({
              success: false,
              error: "Lead tools not available in Pipeboard",
              attempted: ["get_leads", "get_lead_gen_forms"],
              details: [errMsg, errMsg2],
              suggestion: "Use list_tools action to see available Pipeboard tools",
            }), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        } else {
          throw e;
        }
      }

      // If we got leads, persist to facebook_leads table
      if (leads && Array.isArray(leads)) {
        let inserted = 0;
        let errors = 0;

        for (const lead of leads) {
          const row = {
            id: String(lead.id),
            form_id: String(lead.form_id || lead.leadgen_form_id || "unknown"),
            page_id: String(lead.page_id || "unknown"),
            ad_id: lead.ad_id ? String(lead.ad_id) : null,
            adset_id: lead.adset_id ? String(lead.adset_id) : null,
            campaign_id: lead.campaign_id ? String(lead.campaign_id) : null,
            created_time: lead.created_time || new Date().toISOString(),
            field_data: lead.field_data || lead.fields || {},
            processed: false,
          };

          const { error } = await supabase
            .from("facebook_leads")
            .upsert(row, { onConflict: "id" });

          if (error) {
            console.error(`Failed to upsert lead ${lead.id}:`, error);
            errors++;
          } else {
            inserted++;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          total_leads: leads.length,
          inserted,
          errors,
          source: "pipeboard_get_leads",
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: leads,
        note: "Raw response from Pipeboard — may need parsing",
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({
      error: `Unknown action: ${action}`,
      supported: ["fetch_leads", "list_tools"],
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("fetch-facebook-leads error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
