import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================
interface GraphNode {
  id: string;
  entity_type: string;
  entity_id: string;
  name: string;
  properties: Record<string, any>;
  embedding?: number[];
}

interface GraphEdge {
  id: string;
  from_node: string;
  to_node: string;
  relationship: string;
  weight: number;
  properties: Record<string, any>;
}

interface PathResult {
  path: GraphNode[];
  relationships: string[];
  total_weight: number;
  path_length: number;
}

// ============================================
// EMBEDDING SERVICE
// ============================================
async function getEmbeddings(text: string): Promise<number[] | null> {
  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.log('OpenAI API key not configured - skipping embeddings');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      console.error('Embeddings API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (e) {
    console.error('Embeddings error:', e);
    return null;
  }
}

// ============================================
// ENTITY EXTRACTION
// ============================================
async function extractEntitiesFromText(supabase: any, text: string): Promise<GraphNode[]> {
  const entities: GraphNode[] = [];
  const textLower = text.toLowerCase();

  // Extract client entities (emails)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailRegex) || [];

  for (const email of emails) {
    const { data: clientHealth } = await supabase
      .from('client_health_scores')
      .select('email, health_zone, health_score')
      .eq('email', email)
      .maybeSingle();

    if (clientHealth) {
      entities.push({
        id: '',
        entity_type: 'client',
        entity_id: email,
        name: email,
        properties: {
          health_zone: clientHealth.health_zone,
          health_score: clientHealth.health_score
        }
      });
    }
  }

  // Extract coach names (from coach_performance table)
  const { data: coaches } = await supabase
    .from('coach_performance')
    .select('coach_name')
    .limit(100);

  const coachNames = coaches?.map((c: any) => c.coach_name) || [];
  for (const coachName of coachNames) {
    if (coachName && textLower.includes(coachName.toLowerCase())) {
      entities.push({
        id: '',
        entity_type: 'coach',
        entity_id: coachName,
        name: coachName,
        properties: {}
      });
    }
  }

  // Extract campaign names
  const { data: campaigns } = await supabase
    .from('campaign_performance')
    .select('campaign_name')
    .limit(100);

  const campaignNames = campaigns?.map((c: any) => c.campaign_name) || [];
  for (const campaignName of campaignNames) {
    if (campaignName && textLower.includes(campaignName.toLowerCase())) {
      entities.push({
        id: '',
        entity_type: 'campaign',
        entity_id: campaignName,
        name: campaignName,
        properties: {}
      });
    }
  }

  // Extract deal references
  const dealPattern = /deal[:\s]+([^\s,\.]+)/gi;
  const dealMatches = text.matchAll(dealPattern);
  for (const match of dealMatches) {
    entities.push({
      id: '',
      entity_type: 'deal',
      entity_id: match[1],
      name: match[1],
      properties: {}
    });
  }

  return entities;
}

// ============================================
// NODE MANAGEMENT
// ============================================
async function createOrUpdateNode(supabase: any, node: Partial<GraphNode>): Promise<string> {
  const { entity_type, entity_id, name, properties } = node;

  if (!entity_type || !entity_id) {
    throw new Error('entity_type and entity_id are required');
  }

  // Generate embedding for the node
  const embeddingText = `${entity_type} ${entity_id} ${name || ''} ${JSON.stringify(properties || {})}`;
  const embedding = await getEmbeddings(embeddingText);

  // Check if node exists
  const { data: existing } = await supabase
    .from('knowledge_nodes')
    .select('id')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .maybeSingle();

  if (existing) {
    // Update existing node
    const { error } = await supabase
      .from('knowledge_nodes')
      .update({
        name,
        properties,
        embedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) throw error;
    return existing.id;
  } else {
    // Create new node
    const { data, error } = await supabase
      .from('knowledge_nodes')
      .insert({
        entity_type,
        entity_id,
        name,
        properties,
        embedding
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }
}

// ============================================
// EDGE MANAGEMENT
// ============================================
async function createOrUpdateEdge(
  supabase: any,
  fromNodeId: string,
  toNodeId: string,
  relationship: string,
  weight: number = 1.0,
  properties: Record<string, any> = {}
): Promise<string> {
  // Check if edge exists
  const { data: existing } = await supabase
    .from('knowledge_edges')
    .select('id, weight')
    .eq('from_node', fromNodeId)
    .eq('to_node', toNodeId)
    .eq('relationship', relationship)
    .maybeSingle();

  if (existing) {
    // Update existing edge (strengthen the relationship)
    const newWeight = Math.min(10.0, existing.weight + weight);
    const { error } = await supabase
      .from('knowledge_edges')
      .update({
        weight: newWeight,
        properties,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) throw error;
    return existing.id;
  } else {
    // Create new edge
    const { data, error } = await supabase
      .from('knowledge_edges')
      .insert({
        from_node: fromNodeId,
        to_node: toNodeId,
        relationship,
        weight,
        properties
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }
}

// ============================================
// GRAPH BUILDING FROM EXISTING DATA
// ============================================
async function buildGraphFromDatabase(supabase: any): Promise<{ nodes: number; edges: number }> {
  let nodeCount = 0;
  let edgeCount = 0;

  // 1. Create Client Nodes
  const { data: clients } = await supabase
    .from('client_health_scores')
    .select('email, health_zone, health_score, churn_risk_score')
    .limit(500);

  for (const client of clients || []) {
    await createOrUpdateNode(supabase, {
      entity_type: 'client',
      entity_id: client.email,
      name: client.email,
      properties: {
        health_zone: client.health_zone,
        health_score: client.health_score,
        churn_risk_score: client.churn_risk_score
      }
    });
    nodeCount++;
  }

  // 2. Create Coach Nodes
  const { data: coaches } = await supabase
    .from('coach_performance')
    .select('coach_name, avg_client_health, clients_at_risk, performance_score')
    .limit(100);

  const coachNodeIds: Record<string, string> = {};
  for (const coach of coaches || []) {
    if (coach.coach_name) {
      const nodeId = await createOrUpdateNode(supabase, {
        entity_type: 'coach',
        entity_id: coach.coach_name,
        name: coach.coach_name,
        properties: {
          avg_client_health: coach.avg_client_health,
          clients_at_risk: coach.clients_at_risk,
          performance_score: coach.performance_score
        }
      });
      coachNodeIds[coach.coach_name] = nodeId;
      nodeCount++;
    }
  }

  // 3. Create Campaign Nodes
  const { data: campaigns } = await supabase
    .from('campaign_performance')
    .select('campaign_name, platform, spend, leads, conversions, roas')
    .limit(100);

  const campaignNodeIds: Record<string, string> = {};
  for (const campaign of campaigns || []) {
    if (campaign.campaign_name) {
      const nodeId = await createOrUpdateNode(supabase, {
        entity_type: 'campaign',
        entity_id: campaign.campaign_name,
        name: campaign.campaign_name,
        properties: {
          platform: campaign.platform,
          spend: campaign.spend,
          leads: campaign.leads,
          conversions: campaign.conversions,
          roas: campaign.roas
        }
      });
      campaignNodeIds[campaign.campaign_name] = nodeId;
      nodeCount++;
    }
  }

  // 4. Create Deal Nodes and Link to Clients
  const { data: deals } = await supabase
    .from('deals')
    .select('deal_id, deal_name, deal_value, stage, status, contact_email')
    .limit(500);

  for (const deal of deals || []) {
    const dealNodeId = await createOrUpdateNode(supabase, {
      entity_type: 'deal',
      entity_id: deal.deal_id || deal.deal_name,
      name: deal.deal_name,
      properties: {
        value: deal.deal_value,
        stage: deal.stage,
        status: deal.status
      }
    });
    nodeCount++;

    // Link deal to client
    if (deal.contact_email) {
      const { data: clientNode } = await supabase
        .from('knowledge_nodes')
        .select('id')
        .eq('entity_type', 'client')
        .eq('entity_id', deal.contact_email)
        .maybeSingle();

      if (clientNode) {
        await createOrUpdateEdge(
          supabase,
          clientNode.id,
          dealNodeId,
          'purchased',
          deal.deal_value ? Math.log10(deal.deal_value + 1) : 1.0,
          { deal_stage: deal.stage, deal_status: deal.status }
        );
        edgeCount++;
      }
    }
  }

  // 5. Link Clients to Coaches (from contacts table)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('email, owner_name')
    .not('owner_name', 'is', null)
    .limit(500);

  for (const contact of contacts || []) {
    const { data: clientNode } = await supabase
      .from('knowledge_nodes')
      .select('id')
      .eq('entity_type', 'client')
      .eq('entity_id', contact.email)
      .maybeSingle();

    const coachNodeId = coachNodeIds[contact.owner_name];

    if (clientNode && coachNodeId) {
      await createOrUpdateEdge(
        supabase,
        clientNode.id,
        coachNodeId,
        'trained_by',
        2.0
      );
      edgeCount++;
    }
  }

  // 6. Link Leads to Campaigns
  const { data: leads } = await supabase
    .from('enhanced_leads')
    .select('email, campaign_name')
    .not('campaign_name', 'is', null)
    .limit(500);

  for (const lead of leads || []) {
    // Create lead node
    const leadNodeId = await createOrUpdateNode(supabase, {
      entity_type: 'lead',
      entity_id: lead.email,
      name: lead.email,
      properties: {}
    });

    const campaignNodeId = campaignNodeIds[lead.campaign_name];

    if (campaignNodeId) {
      await createOrUpdateEdge(
        supabase,
        leadNodeId,
        campaignNodeId,
        'came_from',
        1.5
      );
      edgeCount++;
    }
  }

  return { nodes: nodeCount, edges: edgeCount };
}

// ============================================
// GRAPH QUERIES
// ============================================

// Find neighbors of a node
async function findNeighbors(
  supabase: any,
  nodeId: string,
  direction: 'outgoing' | 'incoming' | 'both' = 'both',
  relationship?: string
): Promise<GraphNode[]> {
  let edges;

  if (direction === 'outgoing') {
    edges = await supabase
      .from('knowledge_edges')
      .select('to_node, relationship')
      .eq('from_node', nodeId);
  } else if (direction === 'incoming') {
    edges = await supabase
      .from('knowledge_edges')
      .select('from_node, relationship')
      .eq('to_node', nodeId);
  } else {
    const outgoing = await supabase
      .from('knowledge_edges')
      .select('to_node, relationship')
      .eq('from_node', nodeId);
    const incoming = await supabase
      .from('knowledge_edges')
      .select('from_node, relationship')
      .eq('to_node', nodeId);

    edges = {
      data: [
        ...(outgoing.data || []).map((e: any) => ({ node_id: e.to_node, relationship: e.relationship })),
        ...(incoming.data || []).map((e: any) => ({ node_id: e.from_node, relationship: e.relationship }))
      ]
    };
  }

  if (!edges.data || edges.data.length === 0) return [];

  const nodeIds = edges.data.map((e: any) => e.to_node || e.from_node || e.node_id);

  const { data: nodes } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .in('id', nodeIds);

  return nodes || [];
}

// Find shortest path between two nodes (BFS)
async function findPath(
  supabase: any,
  startNodeId: string,
  endNodeId: string,
  maxDepth: number = 5
): Promise<PathResult | null> {
  // Check cache first
  const { data: cachedPath } = await supabase
    .from('knowledge_paths')
    .select('*')
    .eq('start_node', startNodeId)
    .eq('end_node', endNodeId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (cachedPath) {
    const { data: pathNodes } = await supabase
      .from('knowledge_nodes')
      .select('*')
      .in('id', cachedPath.path_nodes);

    return {
      path: pathNodes || [],
      relationships: cachedPath.path_relationships,
      total_weight: cachedPath.total_weight,
      path_length: cachedPath.path_length
    };
  }

  // BFS implementation
  const queue: Array<{ nodeId: string; path: string[]; relationships: string[]; weight: number }> = [
    { nodeId: startNodeId, path: [startNodeId], relationships: [], weight: 0 }
  ];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.path.length > maxDepth) continue;

    if (current.nodeId === endNodeId) {
      // Found path! Cache it and return
      const { data: nodes } = await supabase
        .from('knowledge_nodes')
        .select('*')
        .in('id', current.path);

      const result: PathResult = {
        path: nodes || [],
        relationships: current.relationships,
        total_weight: current.weight,
        path_length: current.path.length - 1
      };

      // Cache the path
      await supabase.from('knowledge_paths').insert({
        start_node: startNodeId,
        end_node: endNodeId,
        path_nodes: current.path,
        path_relationships: current.relationships,
        total_weight: current.weight,
        path_length: current.path.length - 1
      });

      return result;
    }

    // Get outgoing edges
    const { data: edges } = await supabase
      .from('knowledge_edges')
      .select('to_node, relationship, weight')
      .eq('from_node', current.nodeId);

    for (const edge of edges || []) {
      if (!visited.has(edge.to_node)) {
        visited.add(edge.to_node);
        queue.push({
          nodeId: edge.to_node,
          path: [...current.path, edge.to_node],
          relationships: [...current.relationships, edge.relationship],
          weight: current.weight + edge.weight
        });
      }
    }
  }

  return null; // No path found
}

// Get coach's at-risk clients
async function getCoachAtRiskClients(supabase: any, coachName: string): Promise<GraphNode[]> {
  // Find coach node
  const { data: coachNode } = await supabase
    .from('knowledge_nodes')
    .select('id')
    .eq('entity_type', 'coach')
    .eq('entity_id', coachName)
    .maybeSingle();

  if (!coachNode) return [];

  // Find all clients trained by this coach
  const { data: edges } = await supabase
    .from('knowledge_edges')
    .select('from_node')
    .eq('to_node', coachNode.id)
    .eq('relationship', 'trained_by');

  if (!edges || edges.length === 0) return [];

  const clientNodeIds = edges.map((e: any) => e.from_node);

  // Get client nodes with at-risk health zones
  const { data: atRiskClients } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .in('id', clientNodeIds)
    .eq('entity_type', 'client')
    .or('properties->>health_zone.eq.red,properties->>health_zone.eq.yellow');

  return atRiskClients || [];
}

// Get deals from specific campaign
async function getCampaignDeals(supabase: any, campaignName: string): Promise<GraphNode[]> {
  // Find campaign node
  const { data: campaignNode } = await supabase
    .from('knowledge_nodes')
    .select('id')
    .eq('entity_type', 'campaign')
    .eq('entity_id', campaignName)
    .maybeSingle();

  if (!campaignNode) return [];

  // Find leads from this campaign
  const { data: leadEdges } = await supabase
    .from('knowledge_edges')
    .select('from_node')
    .eq('to_node', campaignNode.id)
    .eq('relationship', 'came_from');

  if (!leadEdges || leadEdges.length === 0) return [];

  const leadNodeIds = leadEdges.map((e: any) => e.from_node);

  // Find deals purchased by these leads
  const { data: dealEdges } = await supabase
    .from('knowledge_edges')
    .select('to_node')
    .in('from_node', leadNodeIds)
    .eq('relationship', 'purchased');

  if (!dealEdges || dealEdges.length === 0) return [];

  const dealNodeIds = dealEdges.map((e: any) => e.to_node);

  const { data: deals } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .in('id', dealNodeIds)
    .eq('entity_type', 'deal');

  return deals || [];
}

// Graph-Enhanced RAG: Get context for a query
async function getGraphContext(supabase: any, query: string, entityType?: string): Promise<string> {
  // Generate embedding for query
  const embedding = await getEmbeddings(query);
  if (!embedding) return '';

  // Find similar entities
  const { data: similarEntities } = await supabase.rpc('match_knowledge_entities', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5,
    filter_entity_type: entityType || null
  });

  if (!similarEntities || similarEntities.length === 0) return '';

  // Build context from graph
  const contextParts: string[] = [];

  for (const entity of similarEntities) {
    const neighbors = await findNeighbors(supabase, entity.id);

    const neighborDescriptions = neighbors.map((n: GraphNode) =>
      `${n.entity_type}: ${n.name}`
    ).join(', ');

    contextParts.push(
      `${entity.entity_type} "${entity.name}" is connected to: ${neighborDescriptions}`
    );

    // Add health zone context for clients
    if (entity.entity_type === 'client' && entity.properties.health_zone) {
      contextParts.push(
        `  → Health Zone: ${entity.properties.health_zone} (score: ${entity.properties.health_score})`
      );
    }
  }

  return contextParts.join('\n');
}

// Discover patterns in the graph
async function discoverPatterns(supabase: any): Promise<any[]> {
  const insights: any[] = [];

  // Pattern 1: Coaches with multiple at-risk clients
  const { data: coaches } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .eq('entity_type', 'coach')
    .limit(50);

  for (const coach of coaches || []) {
    const atRiskClients = await getCoachAtRiskClients(supabase, coach.entity_id);

    if (atRiskClients.length >= 3) {
      insights.push({
        type: 'high_risk_coach',
        coach: coach.name,
        at_risk_count: atRiskClients.length,
        message: `Coach ${coach.name} has ${atRiskClients.length} at-risk clients`
      });

      // Save to insights table
      await supabase.from('knowledge_insights').insert({
        insight_type: 'pattern',
        title: `High-risk coach: ${coach.name}`,
        description: `${atRiskClients.length} clients in yellow/red zones`,
        affected_nodes: [coach.id, ...atRiskClients.map(c => c.id)],
        confidence: 0.9,
        properties: { at_risk_count: atRiskClients.length }
      });
    }
  }

  // Pattern 2: High-performing campaigns
  const { data: campaigns } = await supabase
    .from('knowledge_nodes')
    .select('*')
    .eq('entity_type', 'campaign')
    .limit(50);

  for (const campaign of campaigns || []) {
    const deals = await getCampaignDeals(supabase, campaign.entity_id);
    const totalValue = deals.reduce((sum, d) => sum + (d.properties.value || 0), 0);

    if (deals.length >= 5 && totalValue > 50000) {
      insights.push({
        type: 'high_performing_campaign',
        campaign: campaign.name,
        deals_count: deals.length,
        total_value: totalValue,
        message: `Campaign ${campaign.name} generated ${deals.length} deals worth ${totalValue} AED`
      });

      await supabase.from('knowledge_insights').insert({
        insight_type: 'pattern',
        title: `High-performing campaign: ${campaign.name}`,
        description: `${deals.length} deals, ${totalValue} AED total value`,
        affected_nodes: [campaign.id, ...deals.map(d => d.id)],
        confidence: 0.95,
        properties: { deals_count: deals.length, total_value: totalValue }
      });
    }
  }

  // Pattern 3: Referral chains (clients who referred others)
  const { data: referralEdges } = await supabase
    .from('knowledge_edges')
    .select('from_node, COUNT(*) as referral_count')
    .eq('relationship', 'referred_by');

  return insights;
}

// ============================================
// HTTP HANDLER
// ============================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, ...params } = await req.json();

    let result: any;

    switch (action) {
      case 'build_graph':
        // Build knowledge graph from existing data
        result = await buildGraphFromDatabase(supabase);
        break;

      case 'create_node':
        // Create or update a node
        const nodeId = await createOrUpdateNode(supabase, params);
        result = { node_id: nodeId };
        break;

      case 'create_edge':
        // Create relationship between nodes
        const edgeId = await createOrUpdateEdge(
          supabase,
          params.from_node,
          params.to_node,
          params.relationship,
          params.weight || 1.0,
          params.properties || {}
        );
        result = { edge_id: edgeId };
        break;

      case 'find_neighbors':
        // Find connected nodes
        result = await findNeighbors(
          supabase,
          params.node_id,
          params.direction || 'both',
          params.relationship
        );
        break;

      case 'find_path':
        // Find path between two nodes
        result = await findPath(
          supabase,
          params.start_node_id,
          params.end_node_id,
          params.max_depth || 5
        );
        break;

      case 'coach_at_risk_clients':
        // Get coach's at-risk clients
        result = await getCoachAtRiskClients(supabase, params.coach_name);
        break;

      case 'campaign_deals':
        // Get deals from campaign
        result = await getCampaignDeals(supabase, params.campaign_name);
        break;

      case 'extract_entities':
        // Extract entities from text
        result = await extractEntitiesFromText(supabase, params.text);
        break;

      case 'graph_context':
        // Get graph-enhanced context for RAG
        result = await getGraphContext(
          supabase,
          params.query,
          params.entity_type
        );
        break;

      case 'discover_patterns':
        // Discover patterns in the graph
        result = await discoverPatterns(supabase);
        break;

      case 'get_node':
        // Get specific node
        const { data: node } = await supabase
          .from('knowledge_nodes')
          .select('*')
          .eq('entity_type', params.entity_type)
          .eq('entity_id', params.entity_id)
          .maybeSingle();
        result = node;
        break;

      case 'search_nodes':
        // Search nodes by name or properties
        const { data: nodes } = await supabase
          .from('knowledge_nodes')
          .select('*')
          .or(`name.ilike.%${params.query}%,entity_id.ilike.%${params.query}%`)
          .limit(params.limit || 20);
        result = nodes;
        break;

      case 'get_insights':
        // Get discovered insights
        const { data: insights } = await supabase
          .from('knowledge_insights')
          .select('*')
          .gt('expires_at', new Date().toISOString())
          .order('confidence', { ascending: false })
          .limit(params.limit || 20);
        result = insights;
        break;

      case 'clean_expired':
        // Clean up expired data
        await supabase.rpc('clean_expired_graph_data');
        result = { message: 'Expired data cleaned' };
        break;

      case 'graph_stats':
        // Get graph statistics
        const [nodeStats, edgeStats, insightStats] = await Promise.all([
          supabase.from('knowledge_nodes').select('entity_type', { count: 'exact', head: true }),
          supabase.from('knowledge_edges').select('relationship', { count: 'exact', head: true }),
          supabase.from('knowledge_insights').select('insight_type', { count: 'exact', head: true })
        ]);

        const { data: nodesByType } = await supabase
          .from('knowledge_nodes')
          .select('entity_type');

        const typeCounts: Record<string, number> = {};
        (nodesByType || []).forEach((n: any) => {
          typeCounts[n.entity_type] = (typeCounts[n.entity_type] || 0) + 1;
        });

        result = {
          total_nodes: nodeStats.count,
          total_edges: edgeStats.count,
          total_insights: insightStats.count,
          nodes_by_type: typeCounts
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Knowledge Graph Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
