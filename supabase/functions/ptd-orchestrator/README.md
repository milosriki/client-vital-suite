# PTD Orchestrator - Multi-Agent Coordination System

**Version:** 1.0
**Type:** Intelligent Agent Router & Coordinator
**Model:** Semantic Intent Classification + Multi-Agent Execution

---

## Overview

The PTD Orchestrator is a powerful coordination layer that intelligently routes queries to the most appropriate specialized agent(s). It features semantic intent classification, parallel agent execution, result aggregation, and AI-powered response synthesis.

## Architecture

```
User Query
    ↓
┌─────────────────────┐
│ Semantic Router     │ ← Classifies intent using keyword patterns
│ (Intent Detection)  │
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Agent Selection     │ ← Selects best agent(s) from registry
│ (Priority-based)    │
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Multi-Agent Execute │ ← Parallel execution when needed
│ (Parallel/Serial)   │
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Response Synthesis  │ ← AI-powered result aggregation
│ (Gemini 2.5 Flash)  │
└─────────────────────┘
    ↓
Final Response
```

## Key Features

### 1. **Semantic Router**

Automatically classifies queries into intents:

- **sales** - Lead management, pipeline, deals, revenue
- **health** - Client health scores, engagement, wellness
- **fraud** - Payment anomalies, Stripe fraud detection
- **support** - Help, troubleshooting, questions
- **analytics** - Reports, dashboards, KPIs, metrics
- **coach_performance** - Trainer stats, coach analytics
- **churn_risk** - At-risk clients, retention, cancellations
- **lead_management** - New leads, follow-ups, lead scoring
- **general** - Catch-all for general queries

### 2. **Agent Registry**

Maintains a catalog of specialized agents with capabilities:

| Agent | Function Name | Intents | Priority |
|-------|---------------|---------|----------|
| Sales Agent | `ptd-agent-gemini` | sales, lead_management, general | 9 |
| Health Agent | `health-calculator` | health, churn_risk | 10 |
| Fraud Agent | `stripe-forensics` | fraud | 10 |
| BI Agent | `business-intelligence` | analytics, general | 8 |
| Churn Predictor | `churn-predictor` | churn_risk, health | 9 |
| Coach Analyzer | `coach-analyzer` | coach_performance, analytics | 9 |
| Intervention Agent | `intervention-recommender` | health, churn_risk, support | 8 |
| General Agent | `ptd-agent-gemini` | general, support | 5 |

### 3. **Multi-Agent Execution**

- **Parallel Execution**: Runs multiple agents simultaneously for comprehensive analysis
- **Result Aggregation**: Combines outputs from all agents
- **Fallback Handling**: Gracefully handles agent failures

Triggers multi-agent mode when:
- Query mentions multiple domains (e.g., "health AND analytics")
- Keywords like "comprehensive", "full report", "complete analysis"
- High-confidence detection of multiple intents

### 4. **Response Synthesis**

Uses Gemini 2.5 Flash to:
- Combine results from multiple agents
- Remove duplicate information
- Prioritize most relevant data
- Format coherently
- Provide actionable insights

### 5. **Intelligent Caching**

- 5-minute TTL on responses
- Query normalization (case-insensitive, trimmed)
- Automatic cache invalidation
- Max 100 cached entries (LRU eviction)

## API Usage

### Endpoint

```
POST /functions/v1/ptd-orchestrator
```

### Request Body

```typescript
{
  "query": string,           // Required: User query
  "forceRefresh"?: boolean,  // Optional: Bypass cache (default: false)
  "maxAgents"?: number,      // Optional: Limit agents (default: 3)
  "threadId"?: string,       // Optional: Conversation thread ID
  "mode"?: string           // Optional: "auto" (default)
}
```

### Response

```typescript
{
  "success": true,
  "intent": QueryIntent,              // Detected intent
  "confidence": number,               // 0-1 confidence score
  "agentsInvoked": string[],          // Names of agents executed
  "results": AgentResult[],           // Individual agent results
  "synthesizedResponse": string,      // Final combined answer
  "totalExecutionTime": number,       // Total ms
  "metadata": {
    "parallel": boolean,              // Were agents run in parallel?
    "cached": boolean                 // Was response cached?
  }
}
```

### Example Requests

#### 1. Sales Query

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-orchestrator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me all leads from the last 7 days with conversion status"
  }'
```

**Expected routing:** `Sales Agent (ptd-agent-gemini)`

#### 2. Fraud Detection

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-orchestrator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Scan for suspicious payment patterns and fraud"
  }'
```

**Expected routing:** `Fraud Agent (stripe-forensics)`

#### 3. Multi-Agent Query

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-orchestrator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Comprehensive analysis of client health and churn risk with intervention recommendations",
    "maxAgents": 3
  }'
```

**Expected routing:**
- `Health Agent (health-calculator)`
- `Churn Predictor (churn-predictor)`
- `Intervention Agent (intervention-recommender)`

#### 4. Coach Performance

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-orchestrator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show coach performance metrics and client satisfaction"
  }'
```

**Expected routing:** `Coach Analyzer (coach-analyzer)`

## Intent Classification Examples

### Sales Intent

**Triggers:** lead, deal, pipeline, prospect, conversion, close, revenue, sale, opportunity, quote

```json
{
  "query": "How many deals are in the pipeline?",
  "intent": "sales",
  "confidence": 0.9
}
```

### Health Intent

**Triggers:** health, score, wellness, client status, engagement, active, session, workout

```json
{
  "query": "What's the average health score of clients?",
  "intent": "health",
  "confidence": 1.0
}
```

### Fraud Intent

**Triggers:** fraud, suspicious, payment, stripe, transaction, chargeback, dispute, anomaly

```json
{
  "query": "Detect suspicious payment activity",
  "intent": "fraud",
  "confidence": 1.0
}
```

### Churn Risk Intent

**Triggers:** churn, at risk, leaving, cancel, retention, inactive, red zone, yellow zone

```json
{
  "query": "Which clients are at risk of churning?",
  "intent": "churn_risk",
  "confidence": 1.0
}
```

## Configuration

### Required Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for agent invocation

### Optional Environment Variables

Per-agent requirements (orchestrator checks these):

- `LOVABLE_API_KEY` - Required for AI-powered agents (Sales, BI, General)
- `STRIPE_SECRET_KEY` - Required for Fraud Agent
- `OPENAI_API_KEY` - Optional, for enhanced synthesis

## Extending the Orchestrator

### Adding a New Agent

1. Create your specialized agent function
2. Add to the `AGENT_REGISTRY`:

```typescript
{
  name: "My Custom Agent",
  functionName: "my-custom-agent",
  intents: ["custom_intent"],
  description: "Handles custom business logic",
  priority: 8,
  requiredEnvVars: ["MY_API_KEY"],
}
```

3. Update `QueryIntent` type:

```typescript
type QueryIntent =
  | 'sales'
  | 'health'
  // ... existing intents
  | 'custom_intent'; // Add new intent
```

4. Add intent patterns in `classifyQuery()`:

```typescript
custom_intent: {
  keywords: ["custom", "special", "unique"],
  weight: 1.0,
}
```

### Adding New Intent Patterns

Modify the `intentPatterns` in `classifyQuery()`:

```typescript
my_new_intent: {
  keywords: ["keyword1", "keyword2", "phrase"],
  weight: 0.9, // 0.0-1.0
}
```

## Performance Considerations

### Execution Times

- **Single agent**: 500ms - 3s
- **Multi-agent (parallel)**: 1s - 5s (limited by slowest agent)
- **Cache hit**: < 10ms

### Optimization Tips

1. **Use caching**: Don't set `forceRefresh: true` unless necessary
2. **Limit agents**: Set `maxAgents: 2` for faster responses
3. **Specific queries**: More specific queries = better routing = faster execution
4. **Thread IDs**: Reuse thread IDs for conversation context

## Logging & Monitoring

The orchestrator logs to:

- **Console**: Real-time execution logs
- **sync_logs table**: Orchestration runs with metadata

Query orchestration logs:

```sql
SELECT * FROM sync_logs
WHERE platform = 'ptd-orchestrator'
ORDER BY started_at DESC
LIMIT 10;
```

## Error Handling

The orchestrator gracefully handles:

- **Missing environment variables**: Skips agent, continues with others
- **Agent failures**: Captures error, includes in synthesis
- **AI synthesis failures**: Falls back to simple text aggregation
- **Invalid queries**: Returns helpful error messages

## Best Practices

1. **Be Specific**: More specific queries get better routing
   - ✅ "Show me red zone clients with high churn risk"
   - ❌ "Give me some data"

2. **Use Natural Language**: The semantic router understands context
   - ✅ "Which coaches have the best client retention?"
   - ❌ "get_coach_performance()"

3. **Multi-Agent Queries**: Use keywords for comprehensive analysis
   - ✅ "Comprehensive health and churn analysis"
   - ✅ "Full report on business performance"

4. **Thread Continuity**: Reuse thread IDs for follow-up questions
   ```json
   {
     "query": "Tell me more about the top performer",
     "threadId": "thread_12345"
   }
   ```

## Example Use Cases

### 1. Executive Dashboard

```json
{
  "query": "Give me a comprehensive business intelligence report with health metrics and revenue analytics",
  "maxAgents": 3
}
```

Routes to: BI Agent, Health Agent, Sales Agent (parallel)

### 2. Risk Assessment

```json
{
  "query": "Identify at-risk clients and recommend interventions",
  "maxAgents": 2
}
```

Routes to: Churn Predictor, Intervention Agent (parallel)

### 3. Financial Security Audit

```json
{
  "query": "Run a fraud scan on recent Stripe transactions and show payment anomalies",
  "forceRefresh": true
}
```

Routes to: Fraud Agent (single)

### 4. Coach Performance Review

```json
{
  "query": "Show me coach performance metrics and client satisfaction scores",
  "maxAgents": 2
}
```

Routes to: Coach Analyzer, Health Agent (parallel)

## Troubleshooting

### Issue: Low confidence scores

**Solution:** Add more specific keywords to your query or update intent patterns

### Issue: Wrong agent selected

**Solution:** Check keyword patterns in `classifyQuery()` and adjust weights/priorities

### Issue: Agent timeout

**Solution:** Reduce `maxAgents` or check individual agent performance

### Issue: Missing data in response

**Solution:** Check that required env vars are set for the target agent

## Future Enhancements

Potential improvements:

- [ ] Machine learning-based intent classification
- [ ] Agent dependency chains (sequential workflows)
- [ ] Streaming responses
- [ ] User feedback loop for routing accuracy
- [ ] Automatic agent priority tuning
- [ ] Query preprocessing (spell check, entity extraction)
- [ ] Response quality scoring
- [ ] A/B testing different routing strategies

## Support

For issues or questions:
1. Check function logs: `supabase functions logs ptd-orchestrator`
2. Review agent registry configuration
3. Test individual agents separately
4. Validate environment variables

---

**Created:** 2025-12-10
**Last Updated:** 2025-12-10
**Maintainer:** PTD Fitness Development Team
