# PTD Knowledge Graph System - Usage Guide

## Overview
The Knowledge Graph system connects entities (clients, coaches, deals, campaigns) and enables smarter reasoning through relationship mapping and pattern discovery.

## Files Created
1. **Migration**: `/home/user/client-vital-suite/supabase/migrations/20251210_knowledge_graph.sql`
2. **Edge Function**: `/home/user/client-vital-suite/supabase/functions/ptd-knowledge-graph/index.ts`

---

## Database Schema

### Tables

#### `knowledge_nodes`
Entity nodes in the graph (clients, coaches, deals, campaigns, leads)
- `id`: UUID primary key
- `entity_type`: 'client', 'coach', 'deal', 'campaign', 'lead', 'product'
- `entity_id`: Unique identifier for the entity
- `name`: Display name
- `properties`: JSONB metadata
- `embedding`: Vector(1536) for semantic search

#### `knowledge_edges`
Relationships between entities
- `from_node`: Source node UUID
- `to_node`: Target node UUID
- `relationship`: 'trained_by', 'purchased', 'referred_by', 'came_from', etc.
- `weight`: Relationship strength (0-10)
- `properties`: JSONB metadata

#### `knowledge_paths`
Cached paths for performance
- `start_node`, `end_node`: Path endpoints
- `path_nodes`: Array of node UUIDs in path
- `path_relationships`: Array of relationship types
- `total_weight`: Sum of edge weights
- `expires_at`: Cache expiration

#### `knowledge_insights`
AI-discovered patterns
- `insight_type`: 'pattern', 'anomaly', 'cluster', 'trend'
- `title`: Insight title
- `description`: Details
- `affected_nodes`: Related node UUIDs
- `confidence`: 0.0-1.0

---

## API Endpoints

### 1. Build Graph from Existing Data
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "build_graph"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": 1250,
    "edges": 3400
  }
}
```

---

### 2. Create Node
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_node",
    "entity_type": "client",
    "entity_id": "john@example.com",
    "name": "John Doe",
    "properties": {
      "health_zone": "green",
      "health_score": 82
    }
  }'
```

---

### 3. Create Edge (Relationship)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_edge",
    "from_node": "client-node-uuid",
    "to_node": "coach-node-uuid",
    "relationship": "trained_by",
    "weight": 2.0,
    "properties": {
      "since": "2024-01-15"
    }
  }'
```

---

### 4. Find Neighbors
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_neighbors",
    "node_id": "node-uuid",
    "direction": "both",
    "relationship": "trained_by"
  }'
```

**Directions:** `"outgoing"`, `"incoming"`, `"both"`

---

### 5. Find Path Between Entities
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "find_path",
    "start_node_id": "client-uuid",
    "end_node_id": "campaign-uuid",
    "max_depth": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "path": [
      {"id": "...", "entity_type": "client", "name": "John Doe"},
      {"id": "...", "entity_type": "lead", "name": "john@example.com"},
      {"id": "...", "entity_type": "campaign", "name": "Summer Promo 2024"}
    ],
    "relationships": ["converted_from", "came_from"],
    "total_weight": 3.5,
    "path_length": 2
  }
}
```

---

### 6. Coach's At-Risk Clients
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "coach_at_risk_clients",
    "coach_name": "Sarah Johnson"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "entity_type": "client",
      "name": "client@example.com",
      "properties": {
        "health_zone": "yellow",
        "health_score": 58
      }
    }
  ]
}
```

---

### 7. Campaign Deals
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "campaign_deals",
    "campaign_name": "Summer Promo 2024"
  }'
```

---

### 8. Extract Entities from Text
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "extract_entities",
    "text": "Client john@example.com trained by Coach Sarah has a deal in Summer Promo 2024"
  }'
```

---

### 9. Graph-Enhanced Context (for RAG)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "graph_context",
    "query": "Tell me about high-risk clients",
    "entity_type": "client"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": "client \"john@example.com\" is connected to: coach: Sarah Johnson, deal: Premium Package\n  → Health Zone: yellow (score: 58)"
}
```

**Use in AI Prompts:**
```javascript
const context = await fetch('...', { action: 'graph_context', query: userQuestion });
const prompt = `
Context from Knowledge Graph:
${context.data}

User Question: ${userQuestion}
Answer based on the graph context above.
`;
```

---

### 10. Discover Patterns
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "discover_patterns"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "high_risk_coach",
      "coach": "Sarah Johnson",
      "at_risk_count": 5,
      "message": "Coach Sarah Johnson has 5 at-risk clients"
    },
    {
      "type": "high_performing_campaign",
      "campaign": "Summer Promo 2024",
      "deals_count": 12,
      "total_value": 125000,
      "message": "Campaign Summer Promo 2024 generated 12 deals worth 125000 AED"
    }
  ]
}
```

---

### 11. Search Nodes
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "search_nodes",
    "query": "john",
    "limit": 20
  }'
```

---

### 12. Get Graph Statistics
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "graph_stats"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_nodes": 1250,
    "total_edges": 3400,
    "total_insights": 15,
    "nodes_by_type": {
      "client": 800,
      "coach": 25,
      "deal": 350,
      "campaign": 50,
      "lead": 25
    }
  }
}
```

---

### 13. Get Specific Node
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_node",
    "entity_type": "client",
    "entity_id": "john@example.com"
  }'
```

---

### 14. Get Insights
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_insights",
    "limit": 20
  }'
```

---

### 15. Clean Expired Data
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "clean_expired"
  }'
```

---

## Common Use Cases

### Use Case 1: "Who are Coach X's most at-risk clients?"
```javascript
const response = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${ANON_KEY}` },
  body: JSON.stringify({
    action: 'coach_at_risk_clients',
    coach_name: 'Sarah Johnson'
  })
});

const atRiskClients = await response.json();
// Returns clients in yellow/red zones trained by Sarah
```

### Use Case 2: "What deals came from Campaign Y?"
```javascript
const response = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${ANON_KEY}` },
  body: JSON.stringify({
    action: 'campaign_deals',
    campaign_name: 'Summer Promo 2024'
  })
});

const deals = await response.json();
// Returns all deals that originated from this campaign
```

### Use Case 3: "Which clients were referred by Z?"
```javascript
// First get the referrer node
const { data: referrerNode } = await supabase
  .from('knowledge_nodes')
  .select('id')
  .eq('entity_type', 'client')
  .eq('entity_id', 'referrer@example.com')
  .single();

// Then find all referred clients
const response = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'find_neighbors',
    node_id: referrerNode.id,
    direction: 'incoming',
    relationship: 'referred_by'
  })
});
```

### Use Case 4: Graph-Enhanced RAG
```javascript
// User asks: "Tell me about client john@example.com"
const graphContext = await fetch(EDGE_FUNCTION_URL, {
  method: 'POST',
  body: JSON.stringify({
    action: 'graph_context',
    query: 'john@example.com client details',
    entity_type: 'client'
  })
});

const aiPrompt = `
Context from Knowledge Graph:
${graphContext.data}

User Question: Tell me about client john@example.com
Provide insights using the graph relationships above.
`;

// Send to AI for enhanced response
```

---

## Deployment

### 1. Apply Migration
```bash
cd /home/user/client-vital-suite
supabase db push
```

### 2. Deploy Edge Function
```bash
supabase functions deploy ptd-knowledge-graph
```

### 3. Set Environment Variables
Ensure these are set in Supabase:
- `OPENAI_API_KEY` - For embeddings (optional but recommended)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Build Initial Graph
```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-knowledge-graph \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action": "build_graph"}'
```

This will populate the graph with existing data from:
- `client_health_scores` → Client nodes
- `coach_performance` → Coach nodes
- `campaign_performance` → Campaign nodes
- `deals` → Deal nodes + edges to clients
- `contacts` → Client→Coach edges
- `enhanced_leads` → Lead nodes + edges to campaigns

---

## Relationship Types

| Relationship | From → To | Description |
|-------------|-----------|-------------|
| `trained_by` | Client → Coach | Client is trained by coach |
| `purchased` | Client → Deal | Client purchased a deal |
| `came_from` | Lead → Campaign | Lead originated from campaign |
| `referred_by` | Client → Client | Client was referred by another |
| `belongs_to_campaign` | Deal → Campaign | Deal is part of campaign |
| `assigned_to` | Deal → Coach | Deal assigned to coach |
| `converted_from` | Client → Lead | Client converted from lead |

---

## Performance Optimization

### Caching
- Paths are automatically cached for 24 hours
- Insights expire after 7 days
- Run `clean_expired` action daily to clean up

### Indexes
All critical fields are indexed:
- Node lookups by `entity_type` + `entity_id`
- Edge traversal by `from_node` and `to_node`
- Vector similarity search on embeddings

### Best Practices
1. Use `find_neighbors` for 1-hop queries (faster)
2. Use `find_path` for multi-hop queries (cached)
3. Run `discover_patterns` periodically (not on every request)
4. Build graph incrementally, not all at once for large datasets

---

## Monitoring

### Check Graph Health
```sql
SELECT
  entity_type,
  COUNT(*) as count
FROM knowledge_nodes
GROUP BY entity_type;
```

### Check Relationship Distribution
```sql
SELECT
  relationship,
  COUNT(*) as count,
  AVG(weight) as avg_weight
FROM knowledge_edges
GROUP BY relationship
ORDER BY count DESC;
```

### Check Recent Insights
```sql
SELECT *
FROM knowledge_insights
WHERE expires_at > now()
ORDER BY confidence DESC, created_at DESC
LIMIT 10;
```

---

## Integration Examples

### With ptd-agent-claude
```typescript
// In ptd-agent-claude, enhance responses with graph context
const graphContext = await supabase.functions.invoke('ptd-knowledge-graph', {
  body: {
    action: 'graph_context',
    query: userMessage,
  }
});

const systemPrompt = `
${PTD_SYSTEM_KNOWLEDGE}

GRAPH RELATIONSHIPS:
${graphContext.data}

Use the graph context to provide relationship-aware answers.
`;
```

### With intervention-recommender
```typescript
// Find clients at risk and their connections
const coachClients = await supabase.functions.invoke('ptd-knowledge-graph', {
  body: {
    action: 'coach_at_risk_clients',
    coach_name: 'Sarah Johnson'
  }
});

// Recommend coach-specific interventions
```

### With business-intelligence
```typescript
// Discover patterns automatically
const patterns = await supabase.functions.invoke('ptd-knowledge-graph', {
  body: { action: 'discover_patterns' }
});

// Include in BI reports
```

---

## Troubleshooting

### No embeddings generated
**Solution:** Ensure `OPENAI_API_KEY` is set. Embeddings are optional but enable semantic search.

### Slow path finding
**Solution:** Reduce `max_depth` parameter or check if paths are being cached properly.

### Memory issues with large graphs
**Solution:** Process nodes in batches when calling `build_graph`. Modify the function to accept `offset` and `limit` parameters.

---

## Future Enhancements

1. **Weighted Path Finding**: Find paths with minimum/maximum weight
2. **Community Detection**: Identify clusters of related entities
3. **Temporal Graphs**: Track relationships over time
4. **Graph Visualization API**: Return graph data in D3.js/Cytoscape format
5. **Real-time Updates**: Trigger graph updates on database changes
6. **Multi-hop Recommendations**: "Clients similar to this one also bought..."

---

## Support

For issues or questions, check:
- Migration file: `supabase/migrations/20251210_knowledge_graph.sql`
- Edge function: `supabase/functions/ptd-knowledge-graph/index.ts`
- Supabase logs: `supabase functions logs ptd-knowledge-graph`
