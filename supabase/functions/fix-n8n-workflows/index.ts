import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const N8N_API_URL = "https://personaltrainersdubai.app.n8n.cloud/api/v1";
const N8N_API_KEY = Deno.env.get("N8N_API_KEY");
const SUPABASE_URL = "https://boowptjtwadxpjkpctna.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3dwdGp0d2FkeHBqa3BjdG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzg4NTQsImV4cCI6MjA3Mjc1NDg1NH0.ka1coMBcGClLN9nrnuuLZq3S48tVuzb9qbe5aQLhDpU";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const workflows = [
  { id: "eSzjByOJHo3Si03y", name: "Daily Calculator" },
  { id: "BdVKbuQH6f5nYkvV", name: "AI Risk Analysis" },
  { id: "oWCnjPfErKrjUXG", name: "Weekly Pattern Detection" },
  { id: "S2BCDEjVrUGRzQM0", name: "Monthly Coach Review" },
  { id: "DSj6s8POqhl40SOo", name: "Intervention Logger" },
];

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

      // Fix 1: Update SQL queries
      if (workflowData.nodes) {
        workflowData.nodes.forEach((node: any) => {
          if (node.parameters?.query) {
            let query = node.parameters.query;
            const originalQuery = query;
            
            // Replace client_id with id
            query = query.replace(/client_id/gi, "id");
            
            // Replace client_name with proper COALESCE
            query = query.replace(
              /client_name/gi,
              "COALESCE(firstname || ' ' || lastname, email) as client_name"
            );
            
            if (query !== originalQuery) {
              node.parameters.query = query;
              fixesApplied.push(`Updated SQL in node: ${node.name}`);
            }
          }
        });

        // Fix 2: Fix all HTTP Request nodes to use correct Supabase URLs and settings
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.httpRequest" && node.parameters?.url) {
            let url = node.parameters.url;
            const originalUrl = url;
            
            // Fix Supabase base URL
            url = url.replace(/https:\/\/[^\/]+\.supabase\.co/g, SUPABASE_URL);
            
            // Fix RPC endpoints to use POST
            if (url.includes("/rpc/get_zone_distribution") || url.includes("/rpc/get_overall_avg") || url.includes("/rpc/get_at_risk_clients")) {
              node.parameters.method = "POST";
              node.parameters.sendBody = true;
              node.parameters.contentType = "application/json";
              node.parameters.jsonParameters = true;
              node.parameters.bodyParametersJson = JSON.stringify({
                target_date: "={{$now.toFormat('yyyy-MM-dd')}}"
              });
              
              // Ensure proper headers
              node.parameters.sendHeaders = true;
              node.parameters.headerParametersJson = JSON.stringify({
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
              });
              fixesApplied.push(`Fixed RPC call in node: ${node.name}`);
            }
            
            // Fix REST API endpoints for INSERT/UPSERT operations
            if (url.includes("/rest/v1/")) {
              // Ensure proper headers for Supabase REST API
              node.parameters.sendHeaders = true;
              node.parameters.headerParametersJson = JSON.stringify({
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation"
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
      }

      // Update the workflow if fixes were applied
      if (fixesApplied.length > 0) {
        const updateResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
          method: "PATCH",
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
