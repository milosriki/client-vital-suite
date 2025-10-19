import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_API_URL = "https://personaltrainersdubai.app.n8n.cloud/api/v1";
const WORKFLOW_ID = "BdVKbuQH6f5nYkvV";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const N8N_API_TOKEN = Deno.env.get('N8N_API_TOKEN');
    if (!N8N_API_TOKEN) {
      throw new Error('N8N_API_TOKEN not configured');
    }

    console.log('Fetching workflow structure...');
    
    // Get current workflow
    const workflowResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
      headers: {
        'Authorization': `Bearer ${N8N_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workflowResponse.ok) {
      throw new Error(`Failed to fetch workflow: ${workflowResponse.statusText}`);
    }

    const workflow = await workflowResponse.json();
    console.log('Current workflow fetched:', workflow.name);

    // Predictive Risk Intelligence Code
    const predictiveCode = `// PREDICTIVE RISK INTELLIGENCE ENGINE
const items = $input.all();
const results = [];

for (const item of items) {
  const client = item.json;
  
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const daysSince = client.days_since_last_session || 0;
  const healthZone = client.health_zone || 'YELLOW';
  
  let momentum = 'STABLE';
  let rateOfChange = 0;
  
  const avgWeekly7d = sessions7d;
  const avgWeekly30d = sessions30d / 4.3;
  
  if (avgWeekly30d > 0) {
    rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;
    if (rateOfChange > 20) momentum = 'ACCELERATING';
    else if (rateOfChange < -20) momentum = 'DECLINING';
  } else if (sessions7d === 0) {
    momentum = 'DECLINING';
  }
  
  let predictiveRisk = 50;
  
  if (momentum === 'DECLINING') predictiveRisk += 30;
  else if (momentum === 'ACCELERATING') predictiveRisk -= 15;
  
  if (sessions7d === 0) predictiveRisk += 25;
  else if (sessions7d < 1) predictiveRisk += 15;
  else if (sessions7d >= 2) predictiveRisk -= 10;
  
  if (daysSince > 30) predictiveRisk += 25;
  else if (daysSince > 14) predictiveRisk += 15;
  else if (daysSince <= 7) predictiveRisk -= 10;
  
  const remainingPercent = (outstanding / purchased) * 100;
  if (remainingPercent < 10 && sessions7d < 2) predictiveRisk += 20;
  else if (remainingPercent > 50) predictiveRisk -= 10;
  
  if (healthZone === 'GREEN' && momentum === 'DECLINING') predictiveRisk += 10;
  
  predictiveRisk = Math.max(0, Math.min(100, predictiveRisk));
  
  let riskCategory = 'LOW';
  if (predictiveRisk >= 75) riskCategory = 'CRITICAL';
  else if (predictiveRisk >= 60) riskCategory = 'HIGH';
  else if (predictiveRisk >= 40) riskCategory = 'MEDIUM';
  
  const earlyWarning = 
    (momentum === 'DECLINING' && (healthZone === 'GREEN' || healthZone === 'YELLOW')) ||
    (predictiveRisk > 60 && healthZone !== 'RED') ||
    (sessions7d === 0 && healthZone !== 'RED');
  
  const riskFactors = {
    declining_frequency: momentum === 'DECLINING',
    low_absolute_sessions: sessions7d < 1,
    long_gap: daysSince > 14,
    package_depletion: remainingPercent < 20,
    zero_recent_activity: sessions7d === 0,
    health_zone_mismatch: (healthZone === 'GREEN' || healthZone === 'YELLOW') && predictiveRisk > 60
  };
  
  results.push({
    json: {
      ...client,
      predictive_risk_score: Math.round(predictiveRisk),
      risk_category: riskCategory,
      momentum_indicator: momentum,
      rate_of_change_percent: Math.round(rateOfChange),
      early_warning_flag: earlyWarning,
      risk_factors: riskFactors,
      calculation_version: 'MVP_v2_PREDICTIVE'
    }
  });
}

return results;`;

    // Updated Supabase Insert Code
    const supabaseCode = `const items = $input.all();

const records = items.map(item => ({
  email: item.json.email,
  firstname: item.json.firstname || '',
  lastname: item.json.lastname || '',
  hubspot_contact_id: String(item.json.hubspot_contact_id || ''),
  health_score: Number(item.json.health_score) || 0,
  health_zone: item.json.health_zone || 'YELLOW',
  health_trend: item.json.health_trend || 'STABLE',
  churn_risk_score: Number(item.json.churn_risk_score) || 0,
  engagement_score: Number(item.json.engagement_score) || 0,
  momentum_score: Number(item.json.momentum_score) || 0,
  package_health_score: Number(item.json.package_health_score) || 0,
  relationship_score: Number(item.json.relationship_score) || 0,
  financial_score: Number(item.json.financial_score) || 0,
  sessions_last_7d: Number(item.json.sessions_last_7d) || 0,
  sessions_last_30d: Number(item.json.sessions_last_30d) || 0,
  sessions_last_90d: Number(item.json.sessions_last_90d) || 0,
  outstanding_sessions: Number(item.json.outstanding_sessions) || 0,
  sessions_purchased: Number(item.json.sessions_purchased) || 0,
  days_since_last_session: Number(item.json.days_since_last_session) || 999,
  days_until_renewal: item.json.days_until_renewal !== null ? Number(item.json.days_until_renewal) : null,
  assigned_coach: item.json.assigned_coach || '',
  package_type: item.json.package_type || '',
  package_value_aed: Number(item.json.package_value_aed) || 0,
  client_segment: item.json.client_segment || 'UNKNOWN',
  intervention_priority: item.json.intervention_priority || 'NONE',
  predictive_risk_score: Number(item.json.predictive_risk_score) || 50,
  risk_category: item.json.risk_category || 'LOW',
  momentum_indicator: item.json.momentum_indicator || 'STABLE',
  rate_of_change_percent: Number(item.json.rate_of_change_percent) || 0,
  early_warning_flag: item.json.early_warning_flag || false,
  risk_factors: item.json.risk_factors || {},
  calculated_at: new Date().toISOString(),
  calculated_on: new Date().toISOString().split('T')[0],
  calculation_version: 'MVP_v2_PREDICTIVE'
}));

const response = await fetch('https://boowptjtwadxpjkpctna.supabase.co/rest/v1/client_health_scores', {
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3dwdGp0d2FkeHBqa3BjdG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzg4NTQsImV4cCI6MjA3Mjc1NDg1NH0.ka1coMBcGClLN9nrnuuLZq3S48tVuzb9qbe5aQLhDpU',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb3dwdGp0d2FkeHBqa3BjdG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzg4NTQsImV4cCI6MjA3Mjc1NDg1NH0.ka1coMBcGClLN9nrnuuLZq3S48tVuzb9qbe5aQLhDpU',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  },
  body: JSON.stringify(records)
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(\`Supabase insert failed: \${response.status} - \${errorText}\`);
}

return [{ 
  json: { 
    success: true, 
    records_inserted: records.length,
    timestamp: new Date().toISOString()
  } 
}];`;

    // Find the Calculate Health Scores node
    const calculateNode = workflow.nodes.find((n: any) => 
      n.name === "Calculate Health Scores" || n.id === "c4ce7f24-2df7-4e32-8e48-93e305023fee"
    );
    
    if (!calculateNode) {
      throw new Error('Calculate Health Scores node not found');
    }

    // Check if predictive node already exists
    let predictiveNode = workflow.nodes.find((n: any) => 
      n.name === "Add Predictive Risk Intelligence"
    );

    if (!predictiveNode) {
      console.log('Adding new predictive intelligence node...');
      // Add new node
      predictiveNode = {
        id: "predictive-risk-intelligence",
        name: "Add Predictive Risk Intelligence",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [calculateNode.position[0] + 250, calculateNode.position[1]],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: predictiveCode
        }
      };
      workflow.nodes.push(predictiveNode);
    } else {
      console.log('Updating existing predictive intelligence node...');
      predictiveNode.parameters.jsCode = predictiveCode;
    }

    // Find Supabase insert node
    const supabaseNode = workflow.nodes.find((n: any) => 
      n.name.includes("Supabase") && n.type === "n8n-nodes-base.code"
    );

    if (supabaseNode) {
      console.log('Updating Supabase insert node...');
      supabaseNode.parameters.jsCode = supabaseCode;
    }

    // Update connections
    const filterNode = workflow.nodes.find((n: any) => 
      n.name.includes("Filter") && n.name.includes("Valid Email")
    );

    if (filterNode) {
      console.log('Updating connections...');
      // Remove old connection from Calculate to Filter
      workflow.connections = workflow.connections || {};
      
      if (workflow.connections[calculateNode.name]?.main?.[0]) {
        workflow.connections[calculateNode.name].main[0] = workflow.connections[calculateNode.name].main[0].filter((c: any) => 
          c.node !== filterNode.name
        );
      }

      // Add Calculate -> Predictive connection
      workflow.connections[calculateNode.name] = workflow.connections[calculateNode.name] || { main: [[]] };
      if (!workflow.connections[calculateNode.name].main[0].some((c: any) => c.node === predictiveNode.name)) {
        workflow.connections[calculateNode.name].main[0].push({
          node: predictiveNode.name,
          type: "main",
          index: 0
        });
      }

      // Add Predictive -> Filter connection
      workflow.connections[predictiveNode.name] = { main: [[{
        node: filterNode.name,
        type: "main",
        index: 0
      }]] };
    }

    // Update the workflow
    console.log('Saving workflow changes...');
    const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${N8N_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update workflow: ${updateResponse.statusText} - ${errorText}`);
    }

    const updatedWorkflow = await updateResponse.json();
    console.log('Workflow updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Workflow updated with predictive intelligence',
        workflow: {
          id: updatedWorkflow.id,
          name: updatedWorkflow.name,
          nodes: updatedWorkflow.nodes.length,
          predictive_node_added: true
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error updating workflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
