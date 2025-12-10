# PTD Multi-Step Reasoning System

A sophisticated query decomposition and reasoning engine that breaks complex business questions into logical steps, executes them intelligently, and synthesizes comprehensive answers.

## Overview

The PTD Reasoning System transforms complex, multi-faceted business queries into structured reasoning chains. Instead of trying to answer everything at once, it:

1. **Decomposes** complex queries into logical sub-questions
2. **Executes** each step using the appropriate tools/data sources
3. **Maintains** working memory across steps for context
4. **Synthesizes** all findings into a coherent final answer
5. **Shows its work** with a complete reasoning trace

## Key Features

### 1. Query Decomposition
Automatically breaks down complex questions using AI:
```
Query: "Why is revenue down this month?"

Decomposed into:
1. Get current month revenue
2. Get last month revenue
3. Compare the two periods
4. Identify root causes
5. Synthesize explanation
```

### 2. Three Chain Types

#### Sequential (A → B → C)
Each step depends on the previous step's results.
```typescript
Example: "Why is revenue down?"
Step 1: Get current revenue → $45,000
Step 2: Get last month revenue → $58,500
Step 3: Compare them → -23% decline (uses steps 1 & 2)
Step 4: Identify causes → fewer deals closed (uses step 3)
```

#### Parallel (A, B, C all at once)
Independent steps execute simultaneously for speed.
```typescript
Example: "Compare Coach A vs Coach B"
Step 1: Get Coach A data ────┐
Step 2: Get Coach B data ────┤→ Step 3: Compare metrics
```

#### Conditional (if/then branching)
Steps branch based on conditions.
```typescript
Example: "What's causing the increase in red zone clients?"
Step 1: Get current red zone count → 15
Step 2: Get historical count → 9
Step 3: IF increase detected (TRUE)
  → Step 4: Analyze red zone clients
  → Step 5: Find common patterns
  → Step 6: Generate intervention plan
ELSE
  → Report normal status
```

### 3. Working Memory
Tracks intermediate results across steps:
```typescript
interface WorkingMemory {
  original_query: string;
  decomposed_steps: ReasoningStep[];
  intermediate_results: {
    step_1: { revenue: 45000 },
    step_2: { revenue: 58500 },
    step_3: { change: -23% }
  };
  context_built: [
    "Step 1: Current revenue is $45,000",
    "Step 2: Last month was $58,500",
    "Step 3: Revenue declined 23%"
  ];
  final_synthesis: "Full answer...";
}
```

### 4. Available Tools

The reasoning system can use these tools:

#### Data Retrieval
- `get_health_scores` - Client health zones and scores
- `get_revenue_data` - Revenue, deals, financial metrics
- `get_coach_performance` - Coach/trainer analytics
- `get_lead_data` - Lead information and conversion
- `get_call_analytics` - Call records and transcripts
- `get_pipeline_data` - Sales pipeline and stages

#### Analysis
- `compare_metrics` - A vs B comparisons
- `calculate_trends` - Trend analysis over time
- `detect_anomalies` - Find unusual patterns
- `identify_root_cause` - Why did X change?

#### Intelligence Functions
- `run_churn_predictor` - Predict client churn
- `run_business_intelligence` - BI insights
- `run_coach_analyzer` - Deep coach analysis
- `run_anomaly_detector` - System anomaly detection

#### Synthesis
- `aggregate_results` - Combine data points
- `generate_insights` - Create actionable insights
- `explain_difference` - Why do A and B differ?

### 5. Step References
Steps can reference earlier results:
```typescript
{
  step_number: 3,
  question: "Compare current vs previous revenue",
  tool_to_use: "compare_metrics",
  tool_args: {
    metric_a: "$step_1",  // References step 1's result
    metric_b: "$step_2"   // References step 2's result
  }
}
```

## Usage

### Basic Query
```typescript
const response = await fetch('https://[project-ref].supabase.co/functions/v1/ptd-reasoning', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer [anon-key]',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Why is revenue down this month?"
  })
});

const data = await response.json();
```

### Response Format (Full Mode)
```typescript
{
  "success": true,
  "query": "Why is revenue down this month?",
  "chain_type": "sequential",
  "steps": [
    {
      "step_number": 1,
      "question": "What is the current month revenue?",
      "tool_to_use": "get_revenue_data",
      "tool_args": { "period": "current_month" },
      "result": {
        "current_month": {
          "revenue": 45000,
          "deals": 18,
          "avg_deal_size": 2500
        }
      },
      "conclusion": "Current revenue is $45,000 from 18 deals",
      "execution_time_ms": 234,
      "status": "completed"
    },
    // ... more steps
  ],
  "final_answer": "Revenue decreased by 23% this month ($45,000 vs $58,500 last month). Primary cause: 5 fewer deals closed (18 vs 23). Average deal size remained stable. This suggests a top-of-funnel issue with lead generation or qualification...",
  "execution_summary": {
    "total_steps": 5,
    "completed": 5,
    "failed": 0,
    "total_time_ms": 2847
  }
}
```

### Compact Mode (Just the Answer)
```typescript
body: JSON.stringify({
  query: "Why is revenue down?",
  mode: "compact"  // Returns only the final answer
})

// Response:
{
  "success": true,
  "answer": "Revenue decreased by 23%..."
}
```

### With Context
```typescript
body: JSON.stringify({
  query: "Compare Coach A vs Coach B",
  context: "Focus on client retention and health scores"
})
```

## Example Queries

### 1. Revenue Analysis (Sequential)
```
Query: "Why is revenue down this month?"

Chain Type: Sequential
Steps:
1. Get current revenue → $45,000
2. Get last month revenue → $58,500
3. Compare periods → -23% decline
4. Identify causes → 5 fewer deals
5. Synthesize answer

Final Answer: Revenue down 23% due to fewer deals closed.
Suggests top-of-funnel issue...
```

### 2. Coach Comparison (Parallel)
```
Query: "Compare Coach A vs Coach B performance"

Chain Type: Parallel
Steps:
1. Get Coach A data ────┐
2. Get Coach B data ────┤→ 3. Compare metrics → 4. Explain
                        │

Final Answer: Coach B outperforms with 31% higher health scores,
22% more clients, and 60% fewer at-risk clients...
```

### 3. Root Cause Analysis (Conditional)
```
Query: "What's causing the increase in red zone clients?"

Chain Type: Conditional
Steps:
1. Get current red zone count → 15
2. Get historical count → 9
3. Detect increase? → YES
   ↓ (TRUE branch)
4. Analyze red zone clients
5. Find common patterns → 73% missed sessions
6. Generate intervention plan

Final Answer: Red zone increased 67% (9→15). Primary cause:
6 clients missed 3+ sessions. 4 were yellow→red transitions...
```

### 4. Customer Journey (Sequential)
```
Query: "Analyze the full journey of lead john@example.com"

Steps:
1. Get lead info
2. Get all activities
3. Get call records
4. Get deal status
5. Build timeline
6. Identify key moments

Final Answer: John entered 45 days ago via Facebook ad. Had 3 calls,
converted to $3,500 deal, currently in Contract Sent (stuck 30 days).
Urgent: Follow up today...
```

### 5. Business Health Check (Parallel)
```
Query: "Complete business health check"

Steps:
1. Get operations data ──┐
2. Get revenue data ─────┤
3. Get client health ────┤→ 6. Aggregate → 7. Generate assessment
4. Get coach metrics ────┤
5. Get lead data ────────┘

Final Answer: Business at 73/100 overall. Strong revenue (+15%) but
weak retention (19% red zone) and 2 underperforming coaches...
```

## Response Structure

### ReasoningStep
```typescript
interface ReasoningStep {
  step_number: number;
  question: string;           // Sub-question this step answers
  tool_to_use: string;        // Which tool to execute
  tool_args: any;             // Arguments for the tool
  result: any;                // Result from execution
  conclusion: string;         // Human-readable summary
  execution_time_ms?: number; // How long it took
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;             // Error message if failed
}
```

### WorkingMemory
```typescript
interface WorkingMemory {
  original_query: string;
  decomposed_steps: ReasoningStep[];
  intermediate_results: Record<string, any>;
  context_built: string[];
  final_synthesis?: string;
  execution_plan?: {
    chain_type: 'sequential' | 'parallel' | 'conditional';
    total_steps: number;
    estimated_duration_ms: number;
    dependencies: Record<number, number[]>;
  };
}
```

## Advanced Features

### 1. Step Dependencies
The system automatically tracks which steps depend on others:
```typescript
dependencies: {
  1: [],        // Step 1 has no dependencies
  2: [],        // Step 2 has no dependencies
  3: [1, 2],    // Step 3 depends on steps 1 and 2
  4: [3],       // Step 4 depends on step 3
}
```

### 2. Automatic Parallelization
Independent steps run in parallel for speed:
```typescript
// These run simultaneously:
await Promise.all([
  executeStep(step1),
  executeStep(step2),
  executeStep(step3)
]);
```

### 3. Error Handling
Failed steps don't crash the entire chain:
```typescript
{
  step_number: 3,
  status: "failed",
  error: "Database connection timeout",
  // Rest of chain continues with available data
}
```

### 4. Reasoning Trace Storage
All reasoning traces are saved to the database:
```sql
CREATE TABLE reasoning_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  chain_type text,
  total_steps int,
  completed_steps int,
  failed_steps int,
  execution_time_ms int,
  steps_trace jsonb,
  final_answer text,
  created_at timestamptz DEFAULT now()
);
```

## Integration Examples

### Use in Chat Interface
```typescript
async function askComplexQuestion(query: string) {
  const response = await fetch('/functions/v1/ptd-reasoning', {
    method: 'POST',
    body: JSON.stringify({ query, mode: 'full' })
  });

  const data = await response.json();

  // Show the answer
  displayMessage(data.final_answer);

  // Optionally show reasoning trace
  if (showDetails) {
    displayReasoningTrace(data.steps);
  }
}
```

### Use in Dashboard
```typescript
async function analyzeBusinessHealth() {
  const result = await fetch('/functions/v1/ptd-reasoning', {
    method: 'POST',
    body: JSON.stringify({
      query: "Complete business health check",
      mode: 'full'
    })
  });

  const data = await result.json();

  // Display final insights
  showHealthScore(data.final_answer);

  // Show each dimension
  data.steps.forEach(step => {
    updateDashboardWidget(step.question, step.result);
  });
}
```

### Use in Automated Reports
```typescript
async function generateWeeklyReport() {
  const queries = [
    "Why is revenue up/down this week?",
    "Which clients are at risk of churning?",
    "How are coaches performing?",
    "Any anomalies or unusual patterns?"
  ];

  const analyses = await Promise.all(
    queries.map(q =>
      fetch('/functions/v1/ptd-reasoning', {
        method: 'POST',
        body: JSON.stringify({ query: q, mode: 'compact' })
      }).then(r => r.json())
    )
  );

  // Combine into report
  sendWeeklyEmail(analyses);
}
```

## Performance

- **Sequential chains**: ~2-3 seconds per step
- **Parallel chains**: All parallel steps run simultaneously
- **Typical complex query**: 5-10 seconds total
- **Maximum iterations**: 10 steps (configurable)

## Best Practices

### 1. Write Clear Queries
```
❌ Bad: "What's happening?"
✅ Good: "Why is revenue down this month compared to last month?"

❌ Bad: "Check coaches"
✅ Good: "Compare Coach A vs Coach B performance and explain differences"
```

### 2. Use Context When Needed
```typescript
{
  query: "Analyze this client",
  context: "Client email: john@example.com. Focus on engagement and retention."
}
```

### 3. Choose Appropriate Mode
- Use `full` mode when you need to see the reasoning process
- Use `compact` mode for quick answers in chat interfaces

### 4. Handle Long-Running Queries
For very complex queries, consider:
```typescript
// Start the analysis
const { id } = await startReasoning(query);

// Poll for results
const result = await pollReasoningResult(id);
```

## Limitations

1. **Max Steps**: Limited to 10 steps per chain
2. **Execution Time**: Complex chains may take 10-15 seconds
3. **Token Limits**: Very large datasets may need summarization
4. **AI Dependency**: Requires Anthropic API for decomposition

## Troubleshooting

### Query Not Decomposing Properly
- Make query more specific
- Add context to guide decomposition
- Check Anthropic API key is configured

### Steps Failing
- Check database connectivity
- Verify required tables exist
- Review tool permissions

### Slow Performance
- Use parallel chains when possible
- Reduce number of steps
- Optimize tool implementations

## Future Enhancements

- [ ] Streaming responses (step-by-step updates)
- [ ] Caching of common sub-queries
- [ ] Human-in-the-loop for critical decisions
- [ ] Self-healing (retry failed steps automatically)
- [ ] Learning from past reasoning chains
- [ ] Visual reasoning graph display

## Credits

Built with:
- **Anthropic Claude Sonnet 4** for query decomposition and synthesis
- **Supabase Edge Functions** for serverless execution
- **PostgreSQL** for data storage and reasoning trace persistence
