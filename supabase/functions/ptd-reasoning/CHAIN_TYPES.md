# Chain Types - Visual Guide

## Overview

The PTD Reasoning System supports three execution patterns (chain types), each optimized for different types of questions.

---

## 1. Sequential Chain (A → B → C → D)

**Best for:** Questions where each step depends on the previous step's result

**Characteristics:**
- Steps run one after another
- Later steps reference earlier results
- Context builds progressively
- Slower but allows complex dependencies

### Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     SEQUENTIAL CHAIN                        │
└─────────────────────────────────────────────────────────────┘

Query: "Why is revenue down this month?"

┌──────────────────┐
│   Step 1         │
│ Get Current      │  Result: $45,000
│ Revenue          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Step 2         │
│ Get Last Month   │  Result: $58,500
│ Revenue          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Step 3         │
│ Compare          │  Uses: step_1 + step_2
│ Periods          │  Result: -23% decline
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Step 4         │
│ Identify Root    │  Uses: step_3
│ Cause            │  Result: Fewer deals closed
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Step 5         │
│ Generate         │  Uses: all previous steps
│ Recommendations  │  Result: Action plan
└────────┬─────────┘
         │
         ▼
     [Answer]

Total Time: ~6-8 seconds (sum of all steps)
```

### Example Queries

```
✅ Sequential Chain Examples:

1. "Why is revenue down this month?"
   Step 1 → Get current revenue
   Step 2 → Get last month revenue
   Step 3 → Compare them
   Step 4 → Identify causes
   Step 5 → Recommend actions

2. "Analyze the full customer journey for john@example.com"
   Step 1 → Get lead info
   Step 2 → Get all activities (uses step 1)
   Step 3 → Get call records (uses step 1)
   Step 4 → Get deal status (uses step 1)
   Step 5 → Build timeline (uses all)
   Step 6 → Identify key moments (uses step 5)

3. "What's the ROI of our marketing campaigns?"
   Step 1 → Get campaign spend
   Step 2 → Get leads generated (uses step 1)
   Step 3 → Get conversions (uses step 2)
   Step 4 → Get revenue (uses step 3)
   Step 5 → Calculate ROI (uses all)
```

### Dependency Example

```typescript
{
  dependencies: {
    1: [],        // Step 1 has no dependencies
    2: [],        // Step 2 has no dependencies
    3: [1, 2],    // Step 3 needs results from 1 and 2
    4: [3],       // Step 4 needs result from 3
    5: [1,2,3,4]  // Step 5 needs everything
  }
}
```

---

## 2. Parallel Chain (A, B, C → Merge)

**Best for:** Independent questions that can be answered simultaneously

**Characteristics:**
- Steps run at the same time
- No dependencies between parallel steps
- Much faster execution
- Final step combines results

### Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      PARALLEL CHAIN                         │
└─────────────────────────────────────────────────────────────┘

Query: "Compare Coach A vs Coach B performance"

        ┌──────────────────┐
        │   Step 1         │
        │ Get Coach A      │  Result: {clients: 18, health: 67}
        │ Performance      │
        └────────┬─────────┘
                 │
                 │          ┌──────────────────┐
                 │          │   Step 2         │
                 │          │ Get Coach B      │  Result: {clients: 22, health: 88}
                 │          │ Performance      │
                 │          └────────┬─────────┘
                 │                   │
                 ▼                   ▼
        ┌────────────────────────────────────┐
        │          Step 3                    │
        │     Compare Metrics                │  Uses: step_1 + step_2
        │  (Both A and B results)            │  Result: B +31% better
        └─────────────────┬──────────────────┘
                          │
                          ▼
        ┌────────────────────────────────┐
        │          Step 4                │
        │    Explain Differences         │  Uses: step_3
        │                                │  Result: Analysis
        └─────────────────┬──────────────┘
                          │
                          ▼
                      [Answer]

Total Time: ~3-4 seconds (max of parallel steps + merge)
```

### Time Comparison

```
Sequential Execution:
┌────┐  ┌────┐  ┌────┐  ┌────┐
│ A  │→ │ B  │→ │Cmp │→ │Exp │  = 8 seconds
└────┘  └────┘  └────┘  └────┘
 2s      2s      2s      2s

Parallel Execution:
┌────┐
│ A  │─┐              ┌────┐
└────┘ │  ┌────┐      │Exp │  = 4 seconds
 2s    ├─→│Cmp │─────→└────┘
┌────┐ │  └────┘       2s
│ B  │─┘   2s
└────┘
 2s

Speedup: 2x faster! 🚀
```

### Example Queries

```
✅ Parallel Chain Examples:

1. "Compare Coach A vs Coach B performance"
   [A] Get Coach A data
   [B] Get Coach B data  } Run simultaneously
   [3] Compare metrics (uses A + B)
   [4] Explain differences (uses 3)

2. "Give me a complete business health check"
   [A] Get operational metrics
   [B] Get revenue data
   [C] Get client health       } All parallel
   [D] Get coach performance
   [E] Get lead metrics
   [F] Aggregate all (uses A-E)
   [G] Generate assessment (uses F)

3. "Analyze all health zones"
   [A] Get purple zone clients
   [B] Get green zone clients   } Parallel
   [C] Get yellow zone clients
   [D] Get red zone clients
   [E] Compare zones (uses A-D)
```

---

## 3. Conditional Chain (If/Then/Else Branching)

**Best for:** Questions that branch based on conditions

**Characteristics:**
- Steps branch based on results
- Not all steps may execute
- More flexible but complex
- Handles edge cases

### Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CONDITIONAL CHAIN                        │
└─────────────────────────────────────────────────────────────┘

Query: "What's causing the increase in red zone clients?"

┌──────────────────┐
│   Step 1         │
│ Get Current      │  Result: 15 red zone clients
│ Red Zone Count   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Step 2         │
│ Get Historical   │  Result: 9 red zone clients
│ Red Zone Count   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│   Step 3: Decision Point             │
│   IF current > historical?           │
│                                      │
│   15 > 9 = TRUE                      │
└────────┬─────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   TRUE      FALSE
    │         │
    ▼         ▼
┌──────────────────┐      ┌──────────────────┐
│   Step 4a        │      │   Step 4b        │
│ Analyze Red      │      │ Report No        │
│ Zone Clients     │      │ Increase         │
│                  │      │                  │
│ Result: Patterns │      │ (End here)       │
└────────┬─────────┘      └──────────────────┘
         │
         ▼
┌──────────────────┐
│   Step 5         │
│ Find Common      │  Uses: step_4a
│ Patterns         │  Result: 73% missed sessions
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Step 6         │
│ Generate         │  Uses: all previous
│ Intervention     │  Result: Action plan
│ Plan             │
└────────┬─────────┘
         │
         ▼
     [Answer]

Total Time: Variable (depends on branch taken)
```

### Branching Logic

```typescript
// Example conditional structure

Step 3: {
  condition: "current_count > historical_count",
  evaluator: (result) => result.current > result.previous,
  true_branch: [4, 5, 6],   // Deep analysis path
  false_branch: [7]          // Simple status report
}

// Another example
Step 5: {
  condition: "churn_risk > 0.7",
  evaluator: (result) => result.risk_score > 0.7,
  true_branch: [6, 7, 8],   // High risk intervention
  false_branch: [9, 10]      // Monitor and track
}
```

### Example Queries

```
✅ Conditional Chain Examples:

1. "What's causing the increase in red zone clients?"
   Step 1: Get current count → 15
   Step 2: Get historical → 9
   Step 3: IF increase detected (15 > 9)?
     ✓ TRUE → Analyze red zone clients
              → Find patterns
              → Generate interventions
     ✗ FALSE → Report normal status

2. "Should we hire another coach?"
   Step 1: Get current utilization → 92%
   Step 2: Get capacity threshold → 85%
   Step 3: IF utilization > threshold?
     ✓ TRUE → Calculate revenue impact
              → Analyze pipeline
              → Recommend hiring
     ✗ FALSE → Report current capacity OK

3. "Is this deal at risk?"
   Step 1: Get deal age → 45 days
   Step 2: Get avg close time → 30 days
   Step 3: IF deal_age > avg_close_time?
     ✓ TRUE → Analyze blockers
              → Review communications
              → Generate rescue plan
     ✗ FALSE → Report deal on track
```

---

## Chain Type Selection

The system automatically chooses the best chain type based on query analysis:

### Decision Matrix

```
┌───────────────────────────────────────────────────────────────┐
│                    CHAIN TYPE SELECTOR                        │
└───────────────────────────────────────────────────────────────┘

Question Type               → Recommended Chain
─────────────────────────────────────────────────────────────────
"Why is X happening?"       → Sequential
                               (need to build up context)

"Compare A vs B"            → Parallel
                               (independent analyses)

"What's causing increase?"  → Conditional
                               (check if increase exists first)

"Analyze journey of..."     → Sequential
                               (chronological dependencies)

"Complete health check"     → Parallel
                               (independent dimensions)

"Should we do X?"           → Conditional
                               (decision tree logic)

"How are all coaches?"      → Parallel
                               (analyze each independently)

"Root cause of decline"     → Sequential
                               (investigative reasoning)
```

### Auto-Detection Examples

```typescript
// The decomposer analyzes the query

Query: "Compare Coach A vs Coach B"
Analysis: {
  has_comparison: true,
  entities_independent: true,
  → chain_type: "parallel"
}

Query: "Why is revenue down?"
Analysis: {
  investigative: true,
  builds_context: true,
  → chain_type: "sequential"
}

Query: "What's causing the increase in X?"
Analysis: {
  has_conditional: true,
  checks_premise: true,
  → chain_type: "conditional"
}
```

---

## Performance Characteristics

### Sequential Chain
```
Pros:
✅ Handles complex dependencies
✅ Builds rich context
✅ Good for investigations

Cons:
❌ Slower (sequential execution)
❌ One failure can block chain

Best Time: 6-10 seconds
Worst Time: 15+ seconds
```

### Parallel Chain
```
Pros:
✅ Much faster execution
✅ Scales with parallelism
✅ Fault tolerant

Cons:
❌ Can't handle dependencies
❌ May need merge step

Best Time: 3-5 seconds
Worst Time: 8 seconds
```

### Conditional Chain
```
Pros:
✅ Handles edge cases
✅ Efficient (skips unneeded steps)
✅ Flexible branching

Cons:
❌ More complex to debug
❌ Variable execution time

Best Time: 4-6 seconds
Worst Time: 12 seconds
```

---

## Hybrid Patterns

### Pattern 1: Parallel + Sequential

```
Query: "Compare all coaches and identify the best practices"

┌────────┐
│Coach A │─┐
└────────┘ │
┌────────┐ │
│Coach B │─┤
└────────┘ │  ┌──────────┐    ┌──────────┐    ┌──────────┐
┌────────┐ ├─→│ Compare  │───→│ Find Top │───→│ Extract  │
│Coach C │─┤  │   All    │    │ Performer│    │ Practices│
└────────┘ │  └──────────┘    └──────────┘    └──────────┘
┌────────┐ │
│Coach D │─┘
└────────┘

Parallel: Get all coaches (2s)
Sequential: Compare → Find best → Extract (3s)
Total: 5s instead of 12s if fully sequential
```

### Pattern 2: Conditional + Parallel

```
Query: "If revenue is down, analyze all potential causes"

┌──────────┐
│  Check   │
│ Revenue  │
└────┬─────┘
     │
     ▼
  [IF Down?]
     │
     ├─→ TRUE ─→ ┌─────────┐
     │           │Pipeline │─┐
     │           └─────────┘ │
     │           ┌─────────┐ │
     │           │ Leads   │─┤
     │           └─────────┘ │  ┌────────┐
     │           ┌─────────┐ ├─→│Combine │
     │           │Marketing│─┤  └────────┘
     │           └─────────┘ │
     │           ┌─────────┐ │
     │           │ Churn   │─┘
     │           └─────────┘
     │
     └─→ FALSE → [Report OK]

Conditional check (1s) → If true, parallel analysis (3s)
Total: 4s only if condition is true
```

---

## Choosing the Right Chain

### Quick Reference

```
Your Question                      → Use This Chain
───────────────────────────────────────────────────────────
"Why..."                           → Sequential
"Compare..."                       → Parallel
"What's causing increase in..."    → Conditional
"How is..."                        → Parallel
"Should we..."                     → Conditional
"Analyze journey..."               → Sequential
"Complete check..."                → Parallel
"Root cause..."                    → Sequential
"If X then..."                     → Conditional
"All [entities]..."                → Parallel
```

### When in Doubt

The system will choose for you! The query decomposer analyzes:
- Keywords (why, compare, if, all)
- Dependencies between sub-questions
- Conditional logic
- Parallel opportunities

Trust the auto-detection, but you can override if needed.

---

## Advanced: Custom Chain Design

While the system auto-detects, you can design custom chains:

```typescript
// Custom chain specification
{
  chain_type: "hybrid",
  steps: [
    {
      step_number: 1,
      execute: "parallel",
      substeps: [1, 2, 3]
    },
    {
      step_number: 2,
      execute: "sequential",
      substeps: [4, 5],
      depends_on: [1]
    },
    {
      step_number: 3,
      execute: "conditional",
      condition: "step_2.result > threshold",
      true_branch: [6, 7],
      false_branch: [8]
    }
  ]
}
```

This creates a sophisticated multi-pattern reasoning chain for maximum efficiency.
