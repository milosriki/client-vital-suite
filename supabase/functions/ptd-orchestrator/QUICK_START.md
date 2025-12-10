# PTD Orchestrator - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Deploy the Function

```bash
# Deploy to Supabase
supabase functions deploy ptd-orchestrator
```

### 2. Set Environment Variables

Required in Supabase Dashboard > Settings > Edge Functions:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LOVABLE_API_KEY=your-lovable-api-key  # For AI synthesis
STRIPE_SECRET_KEY=your-stripe-key     # For fraud detection
```

### 3. Test It

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all new leads from the past week"}'
```

## 🎯 Common Queries

### Sales

```json
{
  "query": "Show me pipeline deals and conversion rates"
}
```

→ Routes to: **Sales Agent**

### Client Health

```json
{
  "query": "Which clients are at risk of churning?"
}
```

→ Routes to: **Health Agent + Churn Predictor**

### Fraud Detection

```json
{
  "query": "Scan for suspicious payment activity"
}
```

→ Routes to: **Fraud Agent**

### Business Analytics

```json
{
  "query": "Give me today's business metrics and KPIs"
}
```

→ Routes to: **Business Intelligence Agent**

### Comprehensive Report

```json
{
  "query": "Full analysis: health, sales, and coach performance",
  "maxAgents": 3
}
```

→ Routes to: **Multiple Agents in Parallel**

## 📊 Understanding the Response

```typescript
{
  "intent": "sales",              // What the query is about
  "confidence": 0.95,             // How confident (0-1)
  "agentsInvoked": [              // Which agents ran
    "Sales Agent"
  ],
  "synthesizedResponse": "...",   // The answer
  "totalExecutionTime": 2500,     // Time in milliseconds
  "metadata": {
    "parallel": false,            // Were agents run in parallel?
    "cached": false               // Was this cached?
  }
}
```

## 🎛️ Request Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `query` | string | **required** | Your question |
| `maxAgents` | number | 3 | Limit agents to invoke |
| `forceRefresh` | boolean | false | Bypass cache |
| `threadId` | string | auto | Conversation thread |

## 🔀 Intent Classification

| Query Keywords | Intent | Agent(s) |
|----------------|--------|----------|
| lead, deal, pipeline, sale | **sales** | Sales Agent |
| health, score, wellness, session | **health** | Health Agent |
| fraud, suspicious, payment | **fraud** | Fraud Agent |
| report, dashboard, analytics, metrics | **analytics** | BI Agent |
| coach, trainer, staff | **coach_performance** | Coach Analyzer |
| churn, at risk, retention | **churn_risk** | Churn Predictor |
| help, issue, question | **support** | General Agent |

## 💡 Pro Tips

### 1. Be Specific
✅ Good: "Show me red zone clients with health scores below 50"
❌ Bad: "Show me data"

### 2. Use Multi-Agent for Complex Queries
```json
{
  "query": "Comprehensive client health and retention analysis",
  "maxAgents": 3
}
```

### 3. Cache Repetitive Queries
Identical queries within 5 minutes are cached automatically. First call: 2s, cached call: 10ms!

### 4. Force Refresh for Real-Time Data
```json
{
  "query": "Current sales pipeline status",
  "forceRefresh": true
}
```

### 5. Use Thread IDs for Conversations
```json
// First message
{ "query": "Show coach performance", "threadId": "conv_123" }

// Follow-up (will have context)
{ "query": "Tell me more about the top performer", "threadId": "conv_123" }
```

## 🐛 Troubleshooting

### "Missing required configuration"
→ Check that env vars are set for the target agent

### Low confidence score
→ Add more specific keywords to your query

### Wrong agent selected
→ Use keywords from the intent table above

### Slow response
→ Reduce `maxAgents` or use caching

## 📈 Performance

| Scenario | Typical Time |
|----------|-------------|
| Single agent (cached) | 10-50ms |
| Single agent (fresh) | 500ms-3s |
| Multi-agent (2 agents) | 1-4s |
| Multi-agent (3 agents) | 2-5s |

## 🔗 Integration Examples

### React

```typescript
import { useSupabaseClient } from '@supabase/auth-helpers-react';

function QueryOrchestrator() {
  const supabase = useSupabaseClient();

  const handleQuery = async (query: string) => {
    const { data } = await supabase.functions.invoke('ptd-orchestrator', {
      body: { query }
    });
    return data.synthesizedResponse;
  };
}
```

### Python

```python
import requests

def ask_orchestrator(query):
    response = requests.post(
        "https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator",
        headers={"Authorization": "Bearer YOUR_KEY"},
        json={"query": query}
    )
    return response.json()["synthesizedResponse"]
```

### cURL

```bash
#!/bin/bash
QUERY="$1"
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\"}" | jq -r '.synthesizedResponse'
```

## 📚 Next Steps

1. **Read the full README** → Detailed architecture and examples
2. **Check examples.ts** → Code samples and test cases
3. **Extend the agent registry** → Add your custom agents
4. **Monitor performance** → Check `sync_logs` table

## 🆘 Need Help?

- Check logs: `supabase functions logs ptd-orchestrator`
- View orchestration history: `SELECT * FROM sync_logs WHERE platform = 'ptd-orchestrator'`
- Test individual agents separately to isolate issues
- Review agent registry for capabilities

---

**Version:** 1.0
**Last Updated:** 2025-12-10
