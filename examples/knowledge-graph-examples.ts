/**
 * PTD Knowledge Graph - Integration Examples
 *
 * These examples show how to integrate the Knowledge Graph system
 * into your application code.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// ============================================
// Example 1: Build Initial Knowledge Graph
// ============================================
async function buildKnowledgeGraph() {
  console.log('Building knowledge graph from existing data...');

  const { data, error } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: { action: 'build_graph' }
  });

  if (error) {
    console.error('Error building graph:', error);
    return;
  }

  console.log(`✅ Graph built: ${data.data.nodes} nodes, ${data.data.edges} edges`);
}

// ============================================
// Example 2: Add Client-Coach Relationship
// ============================================
async function addClientCoachRelationship(
  clientEmail: string,
  coachName: string
) {
  // Step 1: Create/update client node
  const { data: clientNode } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'create_node',
      entity_type: 'client',
      entity_id: clientEmail,
      name: clientEmail,
      properties: {
        email: clientEmail
      }
    }
  });

  // Step 2: Create/update coach node
  const { data: coachNode } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'create_node',
      entity_type: 'coach',
      entity_id: coachName,
      name: coachName,
      properties: {}
    }
  });

  // Step 3: Create relationship edge
  const { data: edge } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'create_edge',
      from_node: clientNode.data.node_id,
      to_node: coachNode.data.node_id,
      relationship: 'trained_by',
      weight: 2.0,
      properties: {
        since: new Date().toISOString()
      }
    }
  });

  console.log('✅ Client-Coach relationship created');
}

// ============================================
// Example 3: Find Coach's At-Risk Clients
// ============================================
async function findCoachAtRiskClients(coachName: string) {
  const { data, error } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'coach_at_risk_clients',
      coach_name: coachName
    }
  });

  if (error) {
    console.error('Error:', error);
    return [];
  }

  const atRiskClients = data.data || [];

  console.log(`\n🚨 Coach ${coachName}'s At-Risk Clients:\n`);
  atRiskClients.forEach((client: any) => {
    console.log(`  - ${client.name}`);
    console.log(`    Health: ${client.properties.health_zone} (score: ${client.properties.health_score})`);
  });

  return atRiskClients;
}

// ============================================
// Example 4: Track Campaign Performance
// ============================================
async function analyzeCampaignROI(campaignName: string) {
  // Get all deals from this campaign
  const { data } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'campaign_deals',
      campaign_name: campaignName
    }
  });

  const deals = data.data || [];

  const totalRevenue = deals.reduce((sum: number, deal: any) =>
    sum + (deal.properties.value || 0), 0
  );

  const conversionRate = deals.length; // Simplified

  console.log(`\n📊 Campaign: ${campaignName}`);
  console.log(`   Deals: ${deals.length}`);
  console.log(`   Revenue: ${totalRevenue} AED`);
  console.log(`   Avg Deal Size: ${totalRevenue / deals.length} AED`);

  return { deals: deals.length, revenue: totalRevenue };
}

// ============================================
// Example 5: Discover Hidden Patterns
// ============================================
async function discoverPatterns() {
  console.log('🔍 Discovering patterns in knowledge graph...\n');

  const { data } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: { action: 'discover_patterns' }
  });

  const patterns = data.data || [];

  patterns.forEach((pattern: any) => {
    switch (pattern.type) {
      case 'high_risk_coach':
        console.log(`⚠️  ${pattern.message}`);
        console.log(`   Action: Schedule intervention training for coach\n`);
        break;

      case 'high_performing_campaign':
        console.log(`✅ ${pattern.message}`);
        console.log(`   Action: Replicate campaign strategy\n`);
        break;
    }
  });

  return patterns;
}

// ============================================
// Example 6: Graph-Enhanced AI Chat
// ============================================
async function enhancedAIChat(userMessage: string) {
  // Get graph context for the user's query
  const { data: contextData } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'graph_context',
      query: userMessage,
      entity_type: null // Search all entity types
    }
  });

  const graphContext = contextData.data || '';

  // Construct enhanced prompt
  const enhancedPrompt = `
KNOWLEDGE GRAPH CONTEXT:
${graphContext}

USER QUESTION:
${userMessage}

Based on the graph relationships above, provide a comprehensive answer that:
1. References specific entity connections
2. Identifies patterns in the relationships
3. Suggests actionable insights
`;

  console.log('Enhanced Prompt:', enhancedPrompt);

  // Send to your AI service (Claude, GPT, etc.)
  // const aiResponse = await callAI(enhancedPrompt);

  return enhancedPrompt;
}

// ============================================
// Example 7: Track Client Journey
// ============================================
async function trackClientJourney(clientEmail: string) {
  console.log(`\n📍 Tracking journey for: ${clientEmail}\n`);

  // Get client node
  const { data: clientData } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'get_node',
      entity_type: 'client',
      entity_id: clientEmail
    }
  });

  const clientNode = clientData.data;
  if (!clientNode) {
    console.log('Client not found in graph');
    return;
  }

  // Find all connected entities
  const { data: neighborsData } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'find_neighbors',
      node_id: clientNode.id,
      direction: 'both'
    }
  });

  const neighbors = neighborsData.data || [];

  console.log('Client Journey Map:');
  console.log(`├─ Client: ${clientEmail}`);
  console.log(`│  Health: ${clientNode.properties.health_zone} (${clientNode.properties.health_score})`);
  console.log(`│`);

  const coaches = neighbors.filter((n: any) => n.entity_type === 'coach');
  const deals = neighbors.filter((n: any) => n.entity_type === 'deal');
  const campaigns = neighbors.filter((n: any) => n.entity_type === 'campaign');

  if (coaches.length > 0) {
    console.log(`├─ Coaches (${coaches.length}):`);
    coaches.forEach((coach: any) => console.log(`│  └─ ${coach.name}`));
  }

  if (deals.length > 0) {
    console.log(`├─ Deals (${deals.length}):`);
    deals.forEach((deal: any) => {
      console.log(`│  └─ ${deal.name} - ${deal.properties.value} AED (${deal.properties.stage})`);
    });
  }

  if (campaigns.length > 0) {
    console.log(`└─ Campaigns (${campaigns.length}):`);
    campaigns.forEach((campaign: any) => console.log(`   └─ ${campaign.name}`));
  }
}

// ============================================
// Example 8: Find Connection Between Entities
// ============================================
async function findConnection(
  entity1Type: string,
  entity1Id: string,
  entity2Type: string,
  entity2Id: string
) {
  // Get both nodes
  const [node1Response, node2Response] = await Promise.all([
    supabase.functions.invoke('ptd-knowledge-graph', {
      body: { action: 'get_node', entity_type: entity1Type, entity_id: entity1Id }
    }),
    supabase.functions.invoke('ptd-knowledge-graph', {
      body: { action: 'get_node', entity_type: entity2Type, entity_id: entity2Id }
    })
  ]);

  const node1 = node1Response.data?.data;
  const node2 = node2Response.data?.data;

  if (!node1 || !node2) {
    console.log('One or both entities not found');
    return null;
  }

  // Find path between them
  const { data: pathData } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'find_path',
      start_node_id: node1.id,
      end_node_id: node2.id,
      max_depth: 5
    }
  });

  const path = pathData.data;

  if (!path) {
    console.log(`No connection found between ${entity1Id} and ${entity2Id}`);
    return null;
  }

  console.log(`\n🔗 Connection Path (${path.path_length} hops):\n`);

  path.path.forEach((node: any, i: number) => {
    console.log(`${i + 1}. ${node.entity_type}: ${node.name}`);
    if (i < path.relationships.length) {
      console.log(`   └─ [${path.relationships[i]}] →`);
    }
  });

  console.log(`\nTotal Relationship Strength: ${path.total_weight.toFixed(2)}`);

  return path;
}

// ============================================
// Example 9: Automated Insights Dashboard
// ============================================
async function generateInsightsDashboard() {
  const { data: insightsData } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: {
      action: 'get_insights',
      limit: 20
    }
  });

  const insights = insightsData.data || [];

  console.log('\n📊 KNOWLEDGE GRAPH INSIGHTS DASHBOARD\n');
  console.log('=' .repeat(60));

  const groupedInsights = insights.reduce((acc: any, insight: any) => {
    if (!acc[insight.insight_type]) acc[insight.insight_type] = [];
    acc[insight.insight_type].push(insight);
    return acc;
  }, {});

  Object.entries(groupedInsights).forEach(([type, items]: [string, any]) => {
    console.log(`\n${type.toUpperCase()}S (${items.length}):`);
    items.forEach((insight: any, i: number) => {
      console.log(`  ${i + 1}. ${insight.title}`);
      console.log(`     ${insight.description}`);
      console.log(`     Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
    });
  });

  console.log('\n' + '='.repeat(60));
}

// ============================================
// Example 10: Monitor Graph Health
// ============================================
async function monitorGraphHealth() {
  const { data } = await supabase.functions.invoke('ptd-knowledge-graph', {
    body: { action: 'graph_stats' }
  });

  const stats = data.data;

  console.log('\n🏥 KNOWLEDGE GRAPH HEALTH CHECK\n');
  console.log('=' .repeat(60));
  console.log(`Total Nodes:    ${stats.total_nodes}`);
  console.log(`Total Edges:    ${stats.total_edges}`);
  console.log(`Total Insights: ${stats.total_insights}`);
  console.log('\nNodes by Type:');

  Object.entries(stats.nodes_by_type).forEach(([type, count]) => {
    const percentage = ((count as number / stats.total_nodes) * 100).toFixed(1);
    console.log(`  ${type.padEnd(15)} ${count} (${percentage}%)`);
  });

  // Calculate graph density
  const maxEdges = stats.total_nodes * (stats.total_nodes - 1);
  const density = ((stats.total_edges / maxEdges) * 100).toFixed(4);
  console.log(`\nGraph Density:  ${density}%`);

  const avgConnectionsPerNode = (stats.total_edges / stats.total_nodes).toFixed(2);
  console.log(`Avg Connections: ${avgConnectionsPerNode} per node`);

  console.log('=' .repeat(60));
}

// ============================================
// RUN EXAMPLES
// ============================================
async function runExamples() {
  try {
    // Example 1: Build graph
    // await buildKnowledgeGraph();

    // Example 3: Find at-risk clients
    // await findCoachAtRiskClients('Sarah Johnson');

    // Example 5: Discover patterns
    // await discoverPatterns();

    // Example 7: Track client journey
    // await trackClientJourney('john@example.com');

    // Example 9: Generate insights dashboard
    // await generateInsightsDashboard();

    // Example 10: Monitor graph health
    await monitorGraphHealth();

  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Uncomment to run
// runExamples();

export {
  buildKnowledgeGraph,
  addClientCoachRelationship,
  findCoachAtRiskClients,
  analyzeCampaignROI,
  discoverPatterns,
  enhancedAIChat,
  trackClientJourney,
  findConnection,
  generateInsightsDashboard,
  monitorGraphHealth
};
