import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const N8N_API_URL = "https://personaltrainersdubai.app.n8n.cloud/api/v1";
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YTdjOWE4Ny0yNzYyLTQ1NjAtYjc1OS00MWNmZjUwMGM4YTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYwNzEyMDI1LCJleHAiOjE3NjMyMzY4MDB9.D3_VU6WuoFDuy-_znwq7OZ2HSBEM_uJbLcXlt7id1fI";

const workflows = [
  { id: "eSzjByOJHo3Si03y", name: "Daily Calculator" },
  { id: "BdVKbuQH6f5nYkvV", name: "AI Risk Analysis" },
  { id: "oWCnjPfErKrjUXG", name: "Weekly Pattern Detection" },
  { id: "S2BCDEjVrUGRzQM0", name: "Monthly Coach Review" },
  { id: "DSj6s8POqhl40SOo", name: "Intervention Logger" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  try {
    const results = [];

    for (const workflow of workflows) {
      console.log(`Processing workflow: ${workflow.name} (${workflow.id})`);
      
      // Fetch the workflow
      const getResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
        headers: {
          "X-N8N-API-KEY": N8N_API_KEY,
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

        // Fix 2: Fix RPC function calls
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.httpRequest" && node.parameters?.url) {
            const url = node.parameters.url;
            
            if (url.includes("/rpc/get_zone_distribution") || url.includes("/rpc/get_overall_avg")) {
              node.parameters.method = "POST";
              node.parameters.body = {
                bodyParameters: {
                  parameters: [
                    {
                      name: "target_date",
                      value: "={{$now.toFormat('yyyy-MM-dd')}}",
                    },
                  ],
                },
              };
              node.parameters.sendBody = true;
              node.parameters.contentType = "application/json";
              fixesApplied.push(`Fixed RPC call to POST in node: ${node.name}`);
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

        // Fix 4: Ensure PostgreSQL nodes use correct credentials
        workflowData.nodes.forEach((node: any) => {
          if (node.type === "n8n-nodes-base.postgres") {
            if (node.credentials?.postgres?.name !== "Supabase PostgreSQL") {
              if (!node.credentials) node.credentials = {};
              node.credentials.postgres = { name: "Supabase PostgreSQL" };
              fixesApplied.push(`Updated PostgreSQL credentials in node: ${node.name}`);
            }
          }
        });
      }

      // Update the workflow if fixes were applied
      if (fixesApplied.length > 0) {
        const updateResponse = await fetch(`${N8N_API_URL}/workflows/${workflow.id}`, {
          method: "PATCH",
          headers: {
            "X-N8N-API-KEY": N8N_API_KEY,
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

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
