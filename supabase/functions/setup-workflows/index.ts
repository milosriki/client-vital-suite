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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const workflows = [
  { id: "BdVKbuQH6f5nYkvV", name: "Daily Calculator" },
  { id: "2VMbW3pS7pEHkcH1", name: "AI Daily Risk Analysis" },
  { id: "G3nWtHVguXSfo81e", name: "Daily Summary Email" },
  { id: "QTpWugAwBcW3kMtU", name: "AI Weekly Pattern Detection" },
  { id: "WdzfJ2s0B55XO7Ks", name: "AI Monthly Coach Review" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Starting workflow setup ===");
    console.log("N8N API URL:", N8N_API_URL);
    console.log("N8N API Key present:", !!N8N_API_KEY);
    
    if (!N8N_API_KEY) {
      const error = "N8N_API_KEY is not configured in Supabase secrets";
      console.error("ERROR:", error);
      return new Response(JSON.stringify({ 
        error,
        success: false,
        details: "Please configure the N8N_API_KEY secret in Supabase"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    const results = [];

    // Step 1: Fix workflows
    console.log("=== Step 1: Fixing workflow configurations ===");
    for (const workflow of workflows) {
      console.log(`\nProcessing workflow: ${workflow.name} (${workflow.id})`);
      
      try {
        const getResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
          headers: {
            "X-N8N-API-KEY": N8N_API_KEY!,
            "Accept": "application/json",
          },
        });

        console.log(`Fetch response status: ${getResponse.status} ${getResponse.statusText}`);

        if (!getResponse.ok) {
          const errorText = await getResponse.text();
          console.error(`Failed to fetch workflow ${workflow.name}:`, errorText);
          results.push({
            workflow: workflow.name,
            status: "error",
            message: `Failed to fetch: ${getResponse.status} ${getResponse.statusText}`,
            details: errorText,
          });
          continue;
        }

        const workflowData = await getResponse.json();
        console.log(`Workflow data fetched successfully for ${workflow.name}`);
        let fixesApplied: string[] = [];

        // Fix 1: Update SQL queries
        if (workflowData.nodes) {
          workflowData.nodes.forEach((node: any) => {
            if (node.parameters?.query) {
              let query = node.parameters.query;
              const originalQuery = query;
              
              query = query.replace(/client_id/gi, "id");
              query = query.replace(
                /client_name/gi,
                "COALESCE(firstname || ' ' || lastname, email) as client_name"
              );
              
              if (query !== originalQuery) {
                node.parameters.query = query;
                fixesApplied.push(`Updated SQL in node: ${node.name}`);
                console.log(`  - Fixed SQL in node: ${node.name}`);
              }
            }
          });

          // Fix 2: Fix all HTTP Request nodes URLs and headers
          workflowData.nodes.forEach((node: any) => {
            if (node.type === "n8n-nodes-base.httpRequest" && node.parameters?.url) {
              let url = node.parameters.url;
              const originalUrl = url;
              
              // Fix Supabase base URL to use correct project
              url = url.replace(/https:\/\/[^\/]+\.supabase\.co/g, SUPABASE_URL);
              
              // Fix RPC endpoints to use POST with proper body
              if (url.includes("/rpc/get_zone_distribution") || url.includes("/rpc/get_overall_avg") || url.includes("/rpc/get_at_risk_clients")) {
                node.parameters.method = "POST";
                node.parameters.sendBody = true;
                node.parameters.contentType = "application/json";
                node.parameters.jsonParameters = true;
                node.parameters.bodyParametersJson = JSON.stringify({
                  target_date: "={{$now.toFormat('yyyy-MM-dd')}}"
                });
                
                // Set proper authentication headers
                node.parameters.headerParametersJson = JSON.stringify({
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  "Content-Type": "application/json"
                });
                fixesApplied.push(`Fixed RPC call in node: ${node.name}`);
                console.log(`  - Fixed RPC call in node: ${node.name}`);
              }
              
              // Fix REST API endpoints to have proper headers
              if (url.includes("/rest/v1/")) {
                node.parameters.headerParametersJson = JSON.stringify({
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  "Content-Type": "application/json",
                  Prefer: "return=representation"
                });
                fixesApplied.push(`Fixed REST API headers in node: ${node.name}`);
                console.log(`  - Fixed REST API headers in node: ${node.name}`);
              }
              
              if (url !== originalUrl) {
                node.parameters.url = url;
                fixesApplied.push(`Updated URL in node: ${node.name}`);
                console.log(`  - Updated URL in node: ${node.name}`);
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
                console.log(`  - Added query params in node: ${node.name}`);
              }
            }
          });

          // Fix 4: Ensure PostgreSQL nodes use correct credentials
          workflowData.nodes.forEach((node: any) => {
            if (node.type === "n8n-nodes-base.postgres") {
              if (node.credentials?.postgres?.name !== "Supabase PostgreSQL") {
                if (!node.credentials) node.credentials = {};
                node.credentials.postgres = { name: "Supabase PostgreSQL" };
                fixesApplied.push(`Updated PostgreSQL credentials in node: ${node.name}`);
                console.log(`  - Updated PostgreSQL credentials in node: ${node.name}`);
              }
            }
          });
        }

        // Update the workflow if fixes were applied
        if (fixesApplied.length > 0) {
          console.log(`Updating workflow ${workflow.name} with ${fixesApplied.length} fixes...`);
          const updateResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
            method: "PUT",
            headers: {
              "X-N8N-API-KEY": N8N_API_KEY!,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(workflowData),
          });

          console.log(`Update response status: ${updateResponse.status} ${updateResponse.statusText}`);

          if (updateResponse.ok) {
            console.log(`✓ Successfully updated ${workflow.name}`);
            results.push({
              workflow: workflow.name,
              status: "fixed",
              fixes: fixesApplied,
            });
          } else {
            const errorText = await updateResponse.text();
            console.error(`✗ Failed to update ${workflow.name}:`, errorText);
            results.push({
              workflow: workflow.name,
              status: "error",
              message: `Failed to update: ${updateResponse.status} ${updateResponse.statusText}`,
              details: errorText,
            });
          }
        } else {
          console.log(`✓ ${workflow.name} - No fixes needed`);
          results.push({
            workflow: workflow.name,
            status: "ok",
            message: "No fixes needed",
          });
        }
      } catch (workflowError) {
        const errorMsg = workflowError instanceof Error ? workflowError.message : "Unknown error";
        console.error(`✗ Error processing workflow ${workflow.name}:`, errorMsg);
        results.push({
          workflow: workflow.name,
          status: "error",
          message: `Error: ${errorMsg}`,
        });
      }
    }

    // Step 2: Trigger Daily Calculator workflow
    console.log("\n=== Step 2: Triggering Daily Calculator workflow ===");
    const executeResponse = await fetch(`${N8N_API_URL}/workflows/eSzjByOJHo3Si03y/execute`, {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": N8N_API_KEY!,
        "Content-Type": "application/json",
      },
    });

    console.log(`Execute response status: ${executeResponse.status} ${executeResponse.statusText}`);

    let executionResult;
    if (executeResponse.ok) {
      const execData = await executeResponse.json();
      console.log("✓ Daily Calculator executed successfully");
      console.log("Execution data:", JSON.stringify(execData, null, 2));
      executionResult = {
        status: "success",
        message: "Daily Calculator executed successfully",
        data: execData,
      };
    } else {
      const errorText = await executeResponse.text();
      console.error("✗ Failed to execute Daily Calculator:", errorText);
      executionResult = {
        status: "error",
        message: `Failed to execute: ${executeResponse.status} ${executeResponse.statusText}`,
        statusCode: executeResponse.status,
        details: errorText,
      };
    }

    const hasErrors = results.some(r => r.status === "error") || executionResult.status === "error";
    console.log(`\n=== Setup ${hasErrors ? "completed with errors" : "complete"} ===`);
    
    return new Response(JSON.stringify({ 
      workflowFixes: results,
      execution: executionResult,
      success: executionResult.status === "success" && !hasErrors,
      summary: {
        totalWorkflows: workflows.length,
        fixed: results.filter(r => r.status === "fixed").length,
        ok: results.filter(r => r.status === "ok").length,
        errors: results.filter(r => r.status === "error").length,
      }
    }, null, 2), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("=== CRITICAL ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "No stack trace");
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: errorStack,
      success: false,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
