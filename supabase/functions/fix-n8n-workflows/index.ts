import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const N8N_API_URL = "https://personaltrainersdubai.app.n8n.cloud/api/v1";
const N8N_API_KEY = Deno.env.get("N8N_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY");
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const workflows = [
  { id: "BdVKbuQH6f5nYkvV", name: "Daily Calculator" },
  { id: "2VMbW3pS7pEHkcH1", name: "AI Daily Risk Analysis" },
  { id: "G3nWtHVguXSfo81e", name: "Daily Summary Email" },
  { id: "QTpWugAwBcW3kMtU", name: "AI Weekly Pattern Detection" },
  { id: "WdzfJ2s0B55XO7Ks", name: "AI Monthly Coach Review" },
];

// HubSpot property name mappings (HubSpot uses underscores differently)
const hubspotPropertyMappings: Record<string, string> = {
  "outstanding_sessions": "outstanding_sessions__live_",
  "sessions_per_month": "sessions__per_month",
  "package_sessions_monthly": "package__sessions__monthly_",
  "sessions_last_7d": "sessions__last_7d",
  "sessions_last_30d": "sessions__last_30d", 
  "sessions_last_90d": "sessions__last_90d",
  "days_since_last_session": "days_since_last_session",
  "days_until_renewal": "days_until_renewal",
  "health_score": "health_score",
  "health_zone": "health_zone",
  "churn_risk_score": "churn_risk_score",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Starting n8n workflow fixes ===");
    
    if (!N8N_API_KEY) {
      return new Response(JSON.stringify({ 
        error: "N8N_API_KEY not configured",
        success: false 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const results = [];

    for (const workflow of workflows) {
      console.log(`Processing workflow: ${workflow.name} (${workflow.id})`);
      
      // Fetch the workflow
      const getResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
        headers: {
          "X-N8N-API-KEY": N8N_API_KEY!,
          "Accept": "application/json",
        },
      });

      if (!getResponse.ok) {
        results.push({
          workflow: workflow.name,
          status: "error",
          message: `Failed to fetch: ${getResponse.statusText}`,
        });
        continue;
      }

      const workflowData = await getResponse.json();
      let fixesApplied: string[] = [];
      
      console.log(`Original workflow structure for ${workflow.name}:`, {
        nodeCount: workflowData.nodes?.length,
        connectionCount: Object.keys(workflowData.connections || {}).length
      });

      // Fix 1: Update SQL queries - COMPREHENSIVE
      if (workflowData.nodes) {
        workflowData.nodes.forEach((node: any) => {
          if (node.parameters?.query) {
            let query = node.parameters.query;
            const originalQuery = query;
            
            // Replace client_id with id (case insensitive)
            query = query.replace(/\bclient_id\b/gi, "id");
            
            // Replace client_name with proper COALESCE - handle all variations
            query = query.replace(
              /\bclient_name\b/gi,
              "COALESCE(firstname || ' ' || lastname, email)"
            );
            
            // Ensure proper column names in SELECT statements
            query = query.replace(/SELECT\s+client_name/gi, 
              "SELECT COALESCE(firstname || ' ' || lastname, email) as client_name");
            
            // Fix any remaining standalone client_name references
            if (query.includes("client_name") && !query.includes("COALESCE")) {
              query = query.replace(/client_name/g, "COALESCE(firstname || ' ' || lastname, email) as client_name");
            }
            
            if (query !== originalQuery) {
              node.parameters.query = query;
              fixesApplied.push(`Updated SQL in node: ${node.name} - fixed client_id and client_name`);
            }
          }
        });

        // Fix 2: Fix all HTTP Request nodes to use correct Supabase URLs and settings - COMPREHENSIVE
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.httpRequest" && node.parameters?.url) {
            let url = node.parameters.url;
            const originalUrl = url;
            
            // Fix Supabase base URL
            url = url.replace(/https:\/\/[^\/]+\.supabase\.co/g, SUPABASE_URL);
            
            // Fix ALL RPC endpoints to use POST with proper date parameters
            if (url.includes("/rpc/")) {
              node.parameters.method = "POST";
              node.parameters.sendBody = true;
              node.parameters.contentType = "application/json";
              node.parameters.jsonParameters = true;
              
              // Set body based on the RPC function
              if (url.includes("get_zone_distribution") || 
                  url.includes("get_overall_avg") || 
                  url.includes("get_at_risk_clients")) {
                node.parameters.bodyParametersJson = '={"target_date": "{{$now.toFormat(\'yyyy-MM-dd\')}}"}';
              } else {
                // Default to providing target_date for any RPC call
                node.parameters.bodyParametersJson = '={"target_date": "{{$now.toFormat(\'yyyy-MM-dd\')}}"}';
              }
              
              // Ensure proper headers for all RPC calls
              node.parameters.sendHeaders = true;
              node.parameters.headerParametersJson = JSON.stringify({
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation"
              });
              fixesApplied.push(`Fixed RPC call to POST with date parameters in node: ${node.name}`);
            }
            
            // Fix REST API endpoints for INSERT/UPSERT operations
            if (url.includes("/rest/v1/")) {
              // Ensure proper headers for Supabase REST API with merge-duplicates
              node.parameters.sendHeaders = true;
              node.parameters.headerParametersJson = JSON.stringify({
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation,resolution=merge-duplicates"
              });
              
              // If it's an insert operation, ensure POST method and proper body
              if (url.includes("client_health_scores") || url.includes("daily_summary") || 
                  url.includes("coach_performance") || url.includes("weekly_patterns") || 
                  url.includes("intervention_log")) {
                node.parameters.method = "POST";
                node.parameters.sendBody = true;
                node.parameters.contentType = "application/json";
                node.parameters.jsonParameters = true;
                
                // Ensure the body contains the data from previous node
                if (!node.parameters.bodyParametersJson) {
                  node.parameters.bodyParametersJson = "={{ JSON.stringify($input.all()) }}";
                }
                
                fixesApplied.push(`Fixed REST API insert in node: ${node.name}`);
              }
              
              fixesApplied.push(`Fixed REST API headers in node: ${node.name}`);
            }
            
            if (url !== originalUrl) {
              node.parameters.url = url;
              fixesApplied.push(`Updated URL in node: ${node.name}`);
            }
          }
        });

        // Fix 3: Add query parameters to intervention_log requests
        workflowData.nodes.forEach((node: any) => {
          if (node.parameters?.url?.includes("/intervention_log")) {
            const currentUrl = node.parameters.url;
            if (!currentUrl.includes("?")) {
              node.parameters.url = `${currentUrl}?created_at=gte.{{$now.startOf('day').toISO()}}&select=*`;
              fixesApplied.push(`Added query params to intervention_log in node: ${node.name}`);
            }
          }
        });

        // Fix 4: Ensure PostgreSQL nodes use correct credentials and always output data
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.postgres") {
            // Fix credentials
            if (node.credentials?.postgres?.name !== "Supabase PostgreSQL") {
              if (!node.credentials) node.credentials = {};
              node.credentials.postgres = { name: "Supabase PostgreSQL" };
              fixesApplied.push(`Updated PostgreSQL credentials in node: ${node.name}`);
            }
            
            // Ensure the node always outputs data even if query returns nothing
            if (!node.alwaysOutputData) {
              node.alwaysOutputData = true;
              fixesApplied.push(`Enabled alwaysOutputData for node: ${node.name}`);
            }
            
            // Fix query syntax for proper data passing
            if (node.parameters?.query) {
              let query = node.parameters.query;
              
              // Ensure UPSERT queries use proper ON CONFLICT syntax
              if (query.includes("ON CONFLICT") && query.includes("DO UPDATE SET")) {
                // Make sure EXCLUDED is used correctly
                if (!query.includes("EXCLUDED.")) {
                  fixesApplied.push(`Query in ${node.name} may need EXCLUDED prefix check`);
                }
              }
            }
          }
        });

        // Fix 5: Ensure HTTP Request nodes always output data
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.httpRequest") {
            if (!node.alwaysOutputData) {
              node.alwaysOutputData = true;
              fixesApplied.push(`Enabled alwaysOutputData for HTTP node: ${node.name}`);
            }
            
            // Ensure response is properly configured
            if (!node.parameters.options) {
              node.parameters.options = {};
            }
            if (!node.parameters.options.response) {
              node.parameters.options.response = {};
            }
            if (!node.parameters.options.response.response) {
              node.parameters.options.response.response = {};
            }
            node.parameters.options.response.response.neverError = false;
          }
        });

        // Fix 6: Ensure proper node connections and execution order
        if (workflowData.connections) {
          let hasConnectionIssues = false;
          
          workflowData.nodes.forEach((node: any) => {
            // Check if this node is supposed to receive data but has no input connections
            const hasInputConnection = Object.values(workflowData.connections).some(
              (conn: any) => {
                return Object.values(conn).some((connArray: any) => {
                  return connArray.some((c: any) => c.some((connection: any) => 
                    connection.node === node.name
                  ));
                });
              }
            );
            
            // Nodes that transform or use data should have input connections
            if (node.type === "n8n-nodes-base.set" || 
                node.type === "n8n-nodes-base.code" ||
                (node.type === "n8n-nodes-base.postgres" && node.parameters?.query?.includes("$json"))) {
              if (!hasInputConnection && node.type !== "n8n-nodes-base.set" && !node.name.toLowerCase().includes("trigger")) {
                hasConnectionIssues = true;
                console.log(`Warning: Node ${node.name} may be missing input connection`);
              }
            }
          });
          
          if (hasConnectionIssues) {
            fixesApplied.push("Detected potential connection issues - please verify workflow connections manually");
          }
        }

        // Fix 7: Fix Code/Function nodes to properly pass data
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.code" || node.type === "n8n-nodes-base.function") {
            if (!node.alwaysOutputData) {
              node.alwaysOutputData = true;
              fixesApplied.push(`Enabled alwaysOutputData for Code node: ${node.name}`);
            }
          }
        });

        // Fix 8: Ensure Set nodes properly pass all data
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.set") {
            if (!node.parameters.options) {
              node.parameters.options = {};
            }
            // Ensure it includes all input data
            if (node.parameters.options.includeOtherFields === undefined) {
              node.parameters.options.includeOtherFields = true;
              fixesApplied.push(`Enabled includeOtherFields for Set node: ${node.name}`);
            }
          }
        });

        // Fix 9: Fix HubSpot property mappings in HTTP Request nodes
        workflowData.nodes.forEach((node: any) => {
          if ((node.type === "n8n-nodes-base.httpRequest" || node.type === "n8n-nodes-base.set") && 
              (node.name?.toLowerCase().includes("hubspot") || node.parameters?.url?.includes("hubspot"))) {
            
            // Check if this node is setting properties for HubSpot
            if (node.parameters?.options?.bodyParametersJson || node.parameters?.bodyParametersJson) {
              let bodyJson = node.parameters?.options?.bodyParametersJson || node.parameters?.bodyParametersJson || "";
              let originalBody = bodyJson;
              
              // Replace our database field names with HubSpot's expected property names
              Object.entries(hubspotPropertyMappings).forEach(([dbField, hubspotField]) => {
                // Match the field name in JSON (accounting for quotes and various formats)
                const regex = new RegExp(`"${dbField}"\\s*:`, 'gi');
                bodyJson = bodyJson.replace(regex, `"${hubspotField}":`);
              });
              
              if (bodyJson !== originalBody) {
                if (node.parameters?.options?.bodyParametersJson) {
                  node.parameters.options.bodyParametersJson = bodyJson;
                } else {
                  node.parameters.bodyParametersJson = bodyJson;
                }
                fixesApplied.push(`Fixed HubSpot property mappings in node: ${node.name}`);
              }
            }
            
            // Also check Set node values
            if (node.parameters?.values?.values) {
              let madeChanges = false;
              node.parameters.values.values.forEach((value: any) => {
                if (value.name && hubspotPropertyMappings[value.name]) {
                  value.name = hubspotPropertyMappings[value.name];
                  madeChanges = true;
                }
              });
              if (madeChanges) {
                fixesApplied.push(`Fixed HubSpot property names in Set node: ${node.name}`);
              }
            }
          }
        });

        // Fix 10: Ensure Daily Summary Email workflow uses proper RPC calls
        if (workflow.name === "Daily Summary Email") {
          workflowData.nodes.forEach((node: any) => {
            if (node.type === "n8n-nodes-base.httpRequest" && node.parameters?.url?.includes("/rpc/")) {
              // Make sure it's using POST
              node.parameters.method = "POST";
              node.parameters.sendBody = true;
              node.parameters.contentType = "application/json";
              node.parameters.jsonParameters = true;
              
              // Ensure date parameter is passed correctly
              if (!node.parameters.bodyParametersJson || 
                  !node.parameters.bodyParametersJson.includes("target_date")) {
                node.parameters.bodyParametersJson = '={"target_date": "{{$now.toFormat(\'yyyy-MM-dd\')}}"}';
                fixesApplied.push(`Added date parameter to Daily Summary Email RPC call in node: ${node.name}`);
              }
              
              // Ensure headers are correct
              node.parameters.sendHeaders = true;
              node.parameters.headerParametersJson = JSON.stringify({
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation"
              });
              fixesApplied.push(`Fixed Daily Summary Email RPC configuration in node: ${node.name}`);
            }
          });
        }
      }

      // Update the workflow if fixes were applied
      if (fixesApplied.length > 0) {
        const updateResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
          method: "PUT",
          headers: {
            "X-N8N-API-KEY": N8N_API_KEY!,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(workflowData),
        });

        if (updateResponse.ok) {
          results.push({
            workflow: workflow.name,
            status: "success",
            fixes: fixesApplied,
          });
        } else {
          results.push({
            workflow: workflow.name,
            status: "error",
            message: `Failed to update: ${updateResponse.statusText}`,
            fixes: fixesApplied,
          });
        }
      } else {
        results.push({
          workflow: workflow.name,
          status: "no_changes",
          message: "No fixes needed",
        });
      }
    }

    console.log("=== Fix complete ===");
    return new Response(JSON.stringify({ 
      results,
      success: true,
      summary: {
        total: workflows.length,
        fixed: results.filter(r => r.status === "success").length,
        errors: results.filter(r => r.status === "error").length,
        noChanges: results.filter(r => r.status === "no_changes").length
      }
    }, null, 2), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("=== Error fixing workflows ===", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
