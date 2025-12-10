# PTD Reasoning System - Integration Guide

## Overview

The PTD Reasoning System can be integrated with existing agents, dashboards, and user interfaces to provide sophisticated multi-step analysis capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER QUERY                               │
│          "Why is revenue down this month?"                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PTD REASONING ENGINE                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. QUERY DECOMPOSER (Claude AI)                           │ │
│  │     - Analyzes query complexity                            │ │
│  │     - Breaks into logical sub-steps                        │ │
│  │     - Determines chain type (sequential/parallel/cond)     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                      │                                           │
│                      ▼                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  2. EXECUTION PLANNER                                      │ │
│  │     - Builds dependency graph                              │ │
│  │     - Identifies parallel opportunities                    │ │
│  │     - Creates execution plan                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                      │                                           │
│                      ▼                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3. STEP EXECUTOR                                          │ │
│  │     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │     │   Step 1    │  │   Step 2    │  │   Step 3    │    │ │
│  │     │   (Tool)    │  │   (Tool)    │  │   (Tool)    │    │ │
│  │     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │ │
│  │            │                 │                 │            │ │
│  │            ▼                 ▼                 ▼            │ │
│  │     ┌────────────────────────────────────────────────┐    │ │
│  │     │        WORKING MEMORY                          │    │ │
│  │     │  - Intermediate results                        │    │ │
│  │     │  - Context accumulation                        │    │ │
│  │     │  - Step conclusions                            │    │ │
│  │     └────────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                      │                                           │
│                      ▼                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  4. SYNTHESIZER (Claude AI)                                │ │
│  │     - Combines all step results                            │ │
│  │     - Generates coherent answer                            │ │
│  │     - Creates reasoning trace                              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FINAL ANSWER                                │
│  - Comprehensive answer                                         │
│  - Step-by-step reasoning trace                                │
│  - Execution metrics                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Integration Patterns

### Pattern 1: Direct API Integration

Use the reasoning endpoint directly from your application:

```typescript
// frontend/src/api/reasoning.ts

export async function analyzeComplexQuery(query: string, context?: string) {
  const response = await fetch('/functions/v1/ptd-reasoning', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      context,
      mode: 'full'
    })
  });

  return await response.json();
}

// Usage in component
const result = await analyzeComplexQuery(
  "Why is revenue down this month?",
  "Focus on deal pipeline and conversion rates"
);

console.log(result.final_answer);
console.log(result.steps); // Show reasoning trace
```

### Pattern 2: Integration with Existing Agents

Enhance existing agents with reasoning capabilities:

```typescript
// supabase/functions/ptd-agent-claude/index.ts

// Add reasoning as a tool
const tools: Anthropic.Tool[] = [
  // ... existing tools
  {
    name: "multi_step_reasoning",
    description: "Break down and solve complex multi-step questions",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Complex question to analyze" },
        context: { type: "string", description: "Additional context" }
      },
      required: ["query"]
    }
  }
];

// Tool execution
case "multi_step_reasoning": {
  const { data } = await supabase.functions.invoke('ptd-reasoning', {
    body: {
      query: input.query,
      context: input.context,
      mode: 'compact'
    }
  });
  return data.answer;
}
```

### Pattern 3: Dashboard Integration

Create an analytics dashboard for reasoning insights:

```typescript
// frontend/src/components/ReasoningDashboard.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function ReasoningDashboard() {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    async function loadAnalytics() {
      const { data } = await supabase
        .from('reasoning_analytics')
        .select('*');
      setAnalytics(data);
    }
    loadAnalytics();
  }, []);

  return (
    <div>
      <h2>Reasoning System Analytics</h2>
      {analytics?.map(stat => (
        <div key={stat.chain_type}>
          <h3>{stat.chain_type} chains</h3>
          <p>Total queries: {stat.total_queries}</p>
          <p>Success rate: {stat.successful_queries}/{stat.total_queries}</p>
          <p>Avg time: {stat.avg_execution_time_ms}ms</p>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 4: Webhook/Event Integration

Trigger reasoning analysis on events:

```typescript
// supabase/functions/on-revenue-change/index.ts

serve(async (req) => {
  const { revenue_change_pct } = await req.json();

  // If revenue changes significantly, trigger reasoning analysis
  if (Math.abs(revenue_change_pct) > 15) {
    const { data } = await supabase.functions.invoke('ptd-reasoning', {
      body: {
        query: revenue_change_pct > 0
          ? "Why did revenue increase significantly this month?"
          : "Why is revenue down this month?",
        mode: 'full'
      }
    });

    // Send to Slack/Email
    await notifyTeam({
      title: 'Revenue Analysis',
      analysis: data.final_answer,
      reasoning: data.steps
    });
  }
});
```

### Pattern 5: Scheduled Reports

Generate automated reasoning reports:

```typescript
// supabase/functions/weekly-reasoning-report/index.ts

serve(async (req) => {
  const queries = [
    "How did the business perform this week?",
    "Which clients are at highest risk of churning?",
    "What's the health of our sales pipeline?",
    "Are there any anomalies or unusual patterns?"
  ];

  const analyses = await Promise.all(
    queries.map(query =>
      supabase.functions.invoke('ptd-reasoning', {
        body: { query, mode: 'full' }
      }).then(r => r.data)
    )
  );

  // Compile into report
  const report = {
    week: getCurrentWeek(),
    analyses: analyses.map((a, i) => ({
      question: queries[i],
      answer: a.final_answer,
      chain_type: a.chain_type,
      steps: a.steps.length
    })),
    generated_at: new Date().toISOString()
  };

  // Save report
  await supabase.from('weekly_reports').insert(report);

  // Send to stakeholders
  await sendEmail({
    to: 'executives@company.com',
    subject: `Weekly Business Analysis - Week ${getCurrentWeek()}`,
    body: formatReport(report)
  });
});
```

## Chat Interface Integration

### Real-time Reasoning with Streaming

```typescript
// frontend/src/components/ReasoningChat.tsx

export function ReasoningChat() {
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [results, setResults] = useState([]);

  async function handleSubmit() {
    setIsAnalyzing(true);

    // Start reasoning
    const response = await fetch('/functions/v1/ptd-reasoning', {
      method: 'POST',
      body: JSON.stringify({ query, mode: 'full' })
    });

    const data = await response.json();

    // Show results
    setResults(data);
    setIsAnalyzing(false);
  }

  return (
    <div className="reasoning-chat">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask a complex question..."
      />
      <button onClick={handleSubmit}>Analyze</button>

      {isAnalyizing && (
        <div className="analyzing">
          <Spinner />
          <p>Breaking down your query...</p>
        </div>
      )}

      {results && (
        <div className="results">
          {/* Show reasoning trace */}
          <div className="trace">
            <h3>Reasoning Steps</h3>
            {results.steps?.map(step => (
              <div key={step.step_number} className="step">
                <div className="step-header">
                  <span className="step-number">{step.step_number}</span>
                  <span className="step-question">{step.question}</span>
                  <span className="step-time">{step.execution_time_ms}ms</span>
                </div>
                <div className="step-conclusion">{step.conclusion}</div>
              </div>
            ))}
          </div>

          {/* Show final answer */}
          <div className="final-answer">
            <h3>Answer</h3>
            <p>{results.final_answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Advanced Use Cases

### Use Case 1: Executive Dashboard

```typescript
// Auto-generate executive insights every morning

async function generateExecutiveBriefing() {
  const insights = await supabase.functions.invoke('ptd-reasoning', {
    body: {
      query: `Generate a comprehensive executive briefing covering:
        1. Overall business health
        2. Key wins and concerns
        3. At-risk revenue
        4. Team performance
        5. Top 3 action items`,
      mode: 'full'
    }
  });

  return insights.data.final_answer;
}

// Schedule daily at 7 AM
cron.schedule('0 7 * * *', generateExecutiveBriefing);
```

### Use Case 2: Customer Success Automation

```typescript
// Analyze customer journey and recommend interventions

async function analyzeCustomerRisk(email: string) {
  const analysis = await supabase.functions.invoke('ptd-reasoning', {
    body: {
      query: `Analyze customer ${email}:
        - Full journey from first touch
        - Current health status
        - Churn risk factors
        - Recommended interventions`,
      mode: 'full'
    }
  });

  // If high risk, create intervention
  if (analysis.data.final_answer.includes('high risk')) {
    await createIntervention(email, analysis.data);
  }
}
```

### Use Case 3: Sales Intelligence

```typescript
// Real-time deal coaching

async function analyzeDeal(dealId: string) {
  const deal = await getDeal(dealId);

  const coaching = await supabase.functions.invoke('ptd-reasoning', {
    body: {
      query: `Analyze deal "${deal.name}" (${deal.stage}):
        - Likelihood to close
        - Blockers and risks
        - Next best actions
        - Comparison to similar deals`,
      mode: 'full'
    }
  });

  return coaching.data.final_answer;
}
```

## Performance Optimization

### 1. Enable Caching

```typescript
// The system automatically caches frequent queries
// Cache TTL defaults to 24 hours

// To manually check cache:
const { data } = await supabase.rpc('check_reasoning_cache', {
  query_text: 'Why is revenue down?'
});

if (data.cached) {
  return data.answer; // Instant response
} else {
  // Run full reasoning chain
}
```

### 2. Use Compact Mode for Simple Queries

```typescript
// Full mode: Returns complete reasoning trace (~5-10s)
const full = await reason({ query, mode: 'full' });

// Compact mode: Returns just the answer (~3-5s)
const compact = await reason({ query, mode: 'compact' });
```

### 3. Parallel Execution

The system automatically detects parallel opportunities:

```
Query: "Compare Coach A vs Coach B"

Sequential execution: ~6s
┌────┐  ┌────┐  ┌────┐
│ A  │→ │ B  │→ │Cmp │
└────┘  └────┘  └────┘

Parallel execution: ~3s
┌────┐
│ A  │─┐
└────┘ │  ┌────┐
       ├→ │Cmp │
┌────┐ │  └────┘
│ B  │─┘
└────┘
```

## Monitoring & Analytics

### View Reasoning Analytics

```sql
-- Overall performance
SELECT * FROM reasoning_analytics;

-- Most popular queries
SELECT * FROM popular_reasoning_queries;

-- Slow queries needing optimization
SELECT * FROM slow_reasoning_queries;

-- Failed attempts for debugging
SELECT * FROM failed_reasoning_attempts;

-- Tool usage statistics
SELECT * FROM tool_usage_analytics;
```

### Set Up Alerts

```typescript
// Alert on slow queries
supabase
  .from('reasoning_traces')
  .on('INSERT', (payload) => {
    if (payload.new.execution_time_ms > 15000) {
      notifyDevTeam({
        alert: 'Slow reasoning query',
        query: payload.new.query,
        time: payload.new.execution_time_ms
      });
    }
  })
  .subscribe();
```

## Testing

### Run Test Suite

```bash
# Run all tests
deno run --allow-net --allow-env supabase/functions/ptd-reasoning/test.ts

# Run specific test
deno run --allow-net --allow-env supabase/functions/ptd-reasoning/test.ts revenue

# Available tests:
# - revenue: Revenue analysis
# - coach: Coach comparison
# - redzone: Red zone analysis
# - journey: Customer journey
# - health: Business health check
# - churn: Churn prediction
```

### Integration Tests

```typescript
// test/reasoning-integration.test.ts

describe('PTD Reasoning Integration', () => {
  it('should handle complex revenue analysis', async () => {
    const result = await supabase.functions.invoke('ptd-reasoning', {
      body: { query: 'Why is revenue down?', mode: 'full' }
    });

    expect(result.data.success).toBe(true);
    expect(result.data.chain_type).toBe('sequential');
    expect(result.data.steps.length).toBeGreaterThan(3);
  });

  it('should cache frequently asked questions', async () => {
    const query = 'How many clients in red zone?';

    // First call
    const first = await reason(query);
    const firstTime = first.execution_summary.total_time_ms;

    // Second call (should hit cache)
    const second = await reason(query);
    const secondTime = second.execution_summary.total_time_ms;

    expect(secondTime).toBeLessThan(firstTime * 0.5); // At least 50% faster
  });
});
```

## Troubleshooting

### Common Issues

1. **Query not decomposing properly**
   - Make query more specific
   - Add context parameter
   - Check Claude API key

2. **Steps taking too long**
   - Check database indexes
   - Review tool implementations
   - Consider caching

3. **High failure rate**
   - Check `failed_reasoning_attempts` view
   - Review error messages
   - Verify data availability

## Best Practices

1. **Write specific queries**
   ```
   ❌ "What's happening?"
   ✅ "Why is revenue down this month compared to last month?"
   ```

2. **Use context for clarity**
   ```typescript
   {
     query: "Analyze this client",
     context: "Client: john@example.com, Focus: retention risk"
   }
   ```

3. **Choose appropriate mode**
   - `full`: When reasoning trace is needed
   - `compact`: For chat interfaces

4. **Monitor performance**
   - Track slow queries
   - Review cache hit rates
   - Optimize frequent queries

## Future Roadmap

- [ ] Real-time streaming of reasoning steps
- [ ] Visual reasoning graph display
- [ ] Human-in-the-loop for critical decisions
- [ ] Self-healing failed steps
- [ ] Learning from past reasoning chains
- [ ] Multi-language support
- [ ] Voice interface integration

## Support

For issues or questions:
- Check the [README](./README.md)
- Review [examples](./examples.ts)
- Run the [test suite](./test.ts)
- Check database logs and analytics views
