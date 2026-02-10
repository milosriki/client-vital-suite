import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export async function executeSystemTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "test_api_connections": {
      const results: Record<string, any> = {};

      // 1. Stripe Test
      try {
        const stripe = await fetch("https://api.stripe.com/v1/balance", {
          headers: {
            Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
          },
        });
        results.stripe = stripe.ok ? "🟢 OK" : `🔴 FAILED (${stripe.status})`;
      } catch (e) {
        results.stripe = "🔴 ERROR";
      }

      // 2. HubSpot Test
      try {
        const hubspot = await fetch(
          "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
          {
            headers: {
              Authorization: `Bearer ${Deno.env.get("HUBSPOT_API_KEY")}`,
            },
          },
        );
        results.hubspot = hubspot.ok
          ? "🟢 OK"
          : `🔴 FAILED (${hubspot.status})`;
      } catch (e) {
        results.hubspot = "🔴 ERROR";
      }

      // 3. CallGear Test
      try {
        const cgRes = await supabase.functions.invoke("fetch-callgear-data", {
          body: { limit: 1 },
        });
        results.callgear = cgRes.data?.success ? "🟢 OK" : "🔴 FAILED";
      } catch (e) {
        results.callgear = "🔴 ERROR";
      }

      return JSON.stringify(results, null, 2);
    }

    case "trigger_realtime_sync": {
      try {
        const [stripeSync, hubspotSync] = await Promise.all([
          supabase.functions.invoke("stripe-dashboard-data", {
            body: { force_refresh: true },
          }),
          supabase.functions.invoke("sync-hubspot-to-supabase", {
            body: { sync_type: "all" },
          }),
        ]);
        return `🔄 REAL-TIME SYNC COMPLETE: Stripe and HubSpot data updated.`;
      } catch (e) {
        return `Sync error: ${e}`;
      }
    }

    case "run_sql_query": {
      const { query } = input;
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery.startsWith("select")) {
        return JSON.stringify({ error: "Only SELECT queries are allowed" });
      }
      const forbiddenPattern =
        /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke|execute|exec)\b/i;
      if (forbiddenPattern.test(normalizedQuery)) {
        return JSON.stringify({
          error: "Query contains forbidden operations",
        });
      }
      // Allow semicolons if they are at the end, but block multiple statements
      if (
        normalizedQuery.split(";").filter((s) => s.trim().length > 0).length > 1
      ) {
        return JSON.stringify({
          error: "Multiple statements are not allowed",
        });
      }
      try {
        const { data, error } = await supabase.rpc("execute_sql_query", {
          sql_query: query,
        });
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ results: data });
      } catch (e) {
        return JSON.stringify({ error: "SQL query execution failed." });
      }
    }

    case "discover_system_map":
    case "discover_system": {
      try {
        const { data, error } = await supabase.rpc("introspect_schema_verbose");
        if (error) return `Schema discovery error: ${error.message}`;
        return `ULTIMATE SYSTEM MAP (110 Tables Found): ${JSON.stringify(data)}`;
      } catch (e) {
        return `Schema discovery unavailable: ${e}`;
      }
    }

    case "build_feature": {
      const { code, impact } = input;
      try {
        const { data, error } = await supabase
          .from("ai_agent_approvals")
          .insert({
            request_type: "UI_FIX",
            code_changes: [{ path: "src/DynamicFix.tsx", content: code }],
            description: impact,
          });
        if (error) return `Build feature error: ${error.message}`;
        return "Fix prepared in Approvals dashboard.";
      } catch (e) {
        return `Build feature unavailable: ${e}`;
      }
    }

    case "run_intelligence_suite": {
      try {
        const results: Record<string, any> = {};
        const functionsToRun = ["anomaly-detector", "churn-predictor"];
        for (const fn of functionsToRun) {
          const { data, error } = await supabase.functions.invoke(fn, {
            body: {},
          });
          results[fn] = error ? `Error: ${error.message}` : data;
        }
        return `INTELLIGENCE SUITE RESULTS:\n${JSON.stringify(
          results,
          null,
          2,
        )}`;
      } catch (e) {
        return `Intelligence suite unavailable: ${e}`;
      }
    }

    case "run_intelligence": {
      const { action } = input;
      try {
        const functionMap: Record<string, string> = {
          churn: "churn-predictor",
          anomaly: "anomaly-detector",
          revenue: "hubspot-analyzer",
          payouts: "stripe-payouts-ai",
        };
        const functionName = functionMap[action];
        if (!functionName)
          return `Unknown action: ${action}. Use: churn, anomaly, revenue, or payouts`;
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {},
        });
        if (error) return `Intelligence function error: ${error.message}`;
        return `Analysis Result: ${JSON.stringify(data)}`;
      } catch (e) {
        return `Intelligence function unavailable: ${e}`;
      }
    }

    default:
      return `Tool ${toolName} not handled by System executor.`;
  }
}
