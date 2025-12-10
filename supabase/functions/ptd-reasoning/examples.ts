/**
 * PTD REASONING SYSTEM - EXAMPLE QUERIES
 *
 * This file contains complex query examples that demonstrate
 * the multi-step reasoning capabilities.
 */

export const EXAMPLE_QUERIES = {
  // ===== SEQUENTIAL REASONING EXAMPLES =====
  revenue_analysis: {
    query: "Why is revenue down this month compared to last month?",
    expected_chain: "sequential",
    expected_steps: [
      "Get current month revenue",
      "Get last month revenue",
      "Compare the two periods",
      "Identify root causes",
      "Synthesize explanation"
    ],
    example_response: `
      ANSWER: Revenue decreased by 23% this month ($45,000 vs $58,500 last month).

      KEY FINDINGS:
      • Current month: $45,000 from 18 deals (avg: $2,500/deal)
      • Last month: $58,500 from 23 deals (avg: $2,543/deal)
      • Both deal count (-5) and avg deal size (-$43) declined
      • 5 fewer deals closed suggests pipeline issue

      REASONING TRACE:
      1. Retrieved current revenue data → $45,000
      2. Retrieved last month data → $58,500
      3. Calculated 23% decrease
      4. Analyzed root causes → fewer deals + slightly smaller deals
      5. Identified pipeline weakness as primary driver

      RECOMMENDED ACTIONS:
      • Review lead generation (fewer deals suggests top-of-funnel issue)
      • Check sales follow-up cadence
      • Analyze win/loss rates for this period
      • Review competitor activity
    `
  },

  coach_comparison: {
    query: "Compare Coach A vs Coach B performance and explain the differences",
    expected_chain: "parallel",
    expected_steps: [
      "Get Coach A performance data",
      "Get Coach B performance data",
      "Compare metrics between coaches",
      "Explain key differences"
    ],
    example_response: `
      ANSWER: Coach B outperforms Coach A across key metrics, with 31% higher client health scores and 60% fewer at-risk clients.

      KEY FINDINGS:
      Coach A:
      • 18 total clients
      • Avg health score: 67.2 (Yellow zone)
      • 5 clients at risk (28%)
      • Performance score: 72/100

      Coach B:
      • 22 total clients
      • Avg health score: 88.1 (Purple zone)
      • 2 clients at risk (9%)
      • Performance score: 91/100

      KEY DIFFERENCES:
      • Coach B maintains higher client engagement
      • Coach B has 22% more clients while maintaining quality
      • Coach A has higher churn risk percentage
      • Coach B's clients show better momentum scores

      REASONING TRACE:
      1. Fetched Coach A data (parallel)
      2. Fetched Coach B data (parallel)
      3. Compared all metrics
      4. Identified engagement as key differentiator

      RECOMMENDED ACTIONS:
      • Have Coach B mentor Coach A on engagement strategies
      • Review Coach A's at-risk clients for intervention
      • Analyze Coach B's best practices for documentation
    `
  },

  red_zone_investigation: {
    query: "What's causing the increase in red zone clients this month?",
    expected_chain: "conditional",
    expected_steps: [
      "Get current red zone count",
      "Get historical red zone count",
      "IF increase detected → Analyze red zone clients",
      "IF increase detected → Identify common patterns",
      "Synthesize root causes"
    ],
    example_response: `
      ANSWER: Red zone clients increased 67% (from 9 to 15 clients). Primary cause: 6 clients dropped from Yellow to Red due to missed sessions.

      KEY FINDINGS:
      • Current: 15 red zone clients (19% of total)
      • Last month: 9 red zone clients (11% of total)
      • +6 new red zone entries
      • 4 of 6 came from yellow zone (deterioration)
      • 2 of 6 are new clients (rapid decline)

      COMMON PATTERNS IN RED ZONE:
      • 73% have missed 3+ sessions in past 2 weeks
      • 60% have no contact from coach in 7+ days
      • 47% recently changed coaches (transition issues)
      • 33% have outstanding billing issues

      REASONING TRACE:
      1. Retrieved current red zone count → 15 clients
      2. Retrieved historical baseline → 9 clients
      3. Detected 67% increase (condition: TRUE)
      4. Deep-dived into 15 red zone clients
      5. Identified session attendance as #1 factor
      6. Found coach transition as #2 factor

      RECOMMENDED ACTIONS:
      • URGENT: Contact all 15 red zone clients within 24h
      • Focus on 4 yellow→red transitions (catch them early)
      • Review coach transition protocol
      • Implement automated attendance monitoring
      • Check billing system for payment blockers
    `
  },

  lead_journey_analysis: {
    query: "Analyze the full journey of lead john.doe@example.com from first touch to current status",
    expected_chain: "sequential",
    expected_steps: [
      "Get lead basic info",
      "Get all activities/touchpoints",
      "Get call records",
      "Get deal status (if exists)",
      "Build chronological journey",
      "Synthesize key moments"
    ],
    example_response: `
      ANSWER: John Doe entered pipeline 45 days ago via Facebook ad. Had 3 positive calls, converted to deal ($3,500), currently in "Contract Sent" stage.

      COMPLETE JOURNEY:

      Day 1 (Mar 1):
      • First touch: Facebook ad click
      • Form submission: "Weight loss 30 lbs"
      • Lead score: 72 (High quality)

      Day 2 (Mar 2):
      • Outbound call #1: 8 min conversation
      • Outcome: "Interested, scheduled consultation"
      • Sentiment: Positive

      Day 5 (Mar 5):
      • Consultation call: 23 min
      • Discussed 12-week program
      • Sent pricing: $3,500
      • Outcome: "Thinking about it"

      Day 12 (Mar 12):
      • Follow-up email opened
      • Replied with questions about schedule

      Day 14 (Mar 14):
      • Follow-up call #3: 12 min
      • Answered objections
      • Outcome: "Ready to start"

      Day 15 (Mar 15):
      • Deal created: $3,500
      • Stage: Contract Sent
      • Probability: 80%

      Day 16-45 (Current):
      • Contract sent but not signed
      • 2 reminder emails sent
      • No response for 30 days
      • ⚠️ DEAL AT RISK

      KEY MOMENTS:
      ✅ Strong initial engagement (replied within 1 day)
      ✅ Overcame price objection successfully
      ✅ Reached "Ready to start" stage
      ⚠️ STUCK: Contract unsigned for 30 days

      REASONING TRACE:
      1. Retrieved lead profile
      2. Fetched all activities (18 total)
      3. Retrieved call transcripts (3 calls)
      4. Found associated deal
      5. Built chronological timeline
      6. Identified current blocker

      RECOMMENDED ACTIONS:
      • URGENT: Personal call (not email) - contract been sitting 30 days
      • Ask if circumstances changed
      • Offer shorter commitment or payment plan
      • Set hard deadline or close deal as lost
    `
  },

  // ===== ADVANCED MULTI-DIMENSIONAL ANALYSIS =====
  business_health_deep_dive: {
    query: "Give me a complete health check of the business - operations, revenue, client satisfaction, and team performance",
    expected_chain: "parallel",
    expected_steps: [
      "Get operational metrics (utilization, capacity)",
      "Get revenue & pipeline data",
      "Get client health distribution",
      "Get coach performance metrics",
      "Get lead conversion rates",
      "Aggregate all dimensions",
      "Generate holistic assessment"
    ],
    example_response: `
      ANSWER: Business is performing at 73/100 overall. Strong on revenue (+15% MoM) but weak on client retention (19% in red zone) and team performance (2 underperforming coaches).

      === OPERATIONAL HEALTH: 68/100 ===
      • Utilization: 78% (82 clients / 105 capacity)
      • At capacity: 3 coaches
      • Below capacity: 4 coaches
      • Avg clients per coach: 13.7
      ⚠️ Imbalanced load distribution

      === REVENUE HEALTH: 85/100 ===
      • This month: $87,500 (+15% vs last month)
      • Pipeline: $142,000 potential
      • Avg deal size: $3,200 (+8%)
      • Close rate: 34% (improving)
      ✅ Strong growth trajectory

      === CLIENT SATISFACTION: 64/100 ===
      • Purple zone: 28 clients (35%)
      • Green zone: 37 clients (46%)
      • Yellow zone: 17 clients (21%)
      • Red zone: 15 clients (19%)
      ⚠️ High red zone percentage (target: <10%)

      === TEAM PERFORMANCE: 71/100 ===
      Top performers:
      • Coach B: 91/100 (22 clients, 88 avg health)
      • Coach D: 87/100 (20 clients, 85 avg health)

      Needs improvement:
      • Coach A: 72/100 (18 clients, 67 avg health, 28% at-risk)
      • Coach F: 68/100 (15 clients, 64 avg health, 33% at-risk)

      === LEAD GENERATION: 77/100 ===
      • New leads (30d): 45
      • Conversion rate: 31%
      • Avg lead score: 68/100
      • Response time: 4.2 hours (target: <5h)
      ✅ Meeting targets

      CRITICAL ISSUES:
      1. 🔴 Red zone clients too high (15 vs target of 8)
      2. 🟡 2 coaches underperforming
      3. 🟡 Uneven client load distribution

      STRENGTHS:
      1. ✅ Revenue growth strong
      2. ✅ Lead generation healthy
      3. ✅ 2 coaches performing excellently

      RECOMMENDED ACTIONS:
      1. URGENT: Red zone intervention blitz (target all 15 clients)
      2. Rebalance client loads (move 5 clients from maxed coaches)
      3. Coach A & F improvement plan with Coach B mentoring
      4. Maintain revenue momentum with current strategies
    `
  },

  anomaly_detection: {
    query: "Detect any unusual patterns or anomalies in the data from the past week",
    expected_chain: "sequential",
    expected_steps: [
      "Run anomaly detector on revenue",
      "Run anomaly detector on client health",
      "Run anomaly detector on calls/activities",
      "Aggregate anomalies",
      "Prioritize by severity",
      "Generate alerts"
    ],
    example_response: `
      ANSWER: 3 anomalies detected - 1 critical (Stripe fraud pattern), 2 warnings (unusual call volume drop, health score deterioration).

      🔴 CRITICAL ANOMALY #1: Suspicious Stripe Activity
      • Pattern: Unknown card used after 3 months of trusted card
      • Customer: premium_customer_XYZ
      • Amount: $8,500 (instant payout requested)
      • Risk: HIGH - Matches test-drain fraud pattern
      • Action: FREEZE payout, verify with customer

      🟡 WARNING ANOMALY #2: Call Volume Drop
      • Expected calls this week: 85-95
      • Actual calls: 42 (-51%)
      • Affected: All coaches
      • Likely cause: System issue or holiday
      • Action: Verify phone system, check coach schedules

      🟡 WARNING ANOMALY #3: Health Score Deterioration
      • 8 clients dropped 15+ points in 7 days
      • Pattern: All missed 2+ sessions this week
      • Common factor: All assigned to Coach C
      • Possible cause: Coach unavailable/on leave?
      • Action: Check Coach C status, reassign if needed

      ADDITIONAL INSIGHTS:
      • Lead response time spiked to 9.2 hours (usually 4h)
      • Website traffic down 30% (check marketing)
      • 3 customers changed cards this week (normal: 0-1)

      REASONING TRACE:
      1. Ran anomaly detection on Stripe → Found fraud pattern
      2. Ran detection on calls → Found volume drop
      3. Ran detection on health scores → Found Coach C issue
      4. Prioritized by business impact
      5. Generated actionable alerts
    `
  },

  predictive_churn_analysis: {
    query: "Which clients are most likely to churn in the next 30 days and why?",
    expected_chain: "sequential",
    expected_steps: [
      "Run churn predictor model",
      "Get top 10 highest risk clients",
      "Analyze common risk factors",
      "Calculate financial impact",
      "Generate intervention plan"
    ],
    example_response: `
      ANSWER: 12 clients at high churn risk (>70% probability) in next 30 days. Potential revenue loss: $38,400 if no action taken.

      === HIGHEST RISK CLIENTS ===

      1. Sarah Johnson (92% churn risk)
         • Last session: 18 days ago
         • Missed: 5 of last 6 scheduled sessions
         • Coach contact: None in 12 days
         • Health score: 34 (red zone)
         • Contract value: $4,200
         • Action: URGENT call today

      2. Mike Rodriguez (87% churn risk)
         • Last session: 14 days ago
         • Health score: 41 → 28 (dropped 13 points)
         • Billing issue: Card declined 3x
         • Contract value: $3,800
         • Action: Resolve billing + check-in call

      3. Emma Chen (84% churn risk)
         • Recently changed coaches (transition issue)
         • 3 missed sessions with new coach
         • Expressed dissatisfaction in last call
         • Contract value: $5,200
         • Action: Coach manager intervention

      [... 9 more clients ...]

      === COMMON RISK FACTORS ===
      • 75% have missed 3+ sessions in past 2 weeks
      • 58% have no coach contact in 7+ days
      • 42% have outstanding billing issues
      • 33% recently changed coaches
      • 25% showed declining health scores

      === FINANCIAL IMPACT ===
      • Total at-risk revenue: $38,400
      • Avg contract value: $3,200
      • If 50% churn: $19,200 loss
      • Retention cost: ~$500 (calls + incentives)
      • ROI of intervention: 38x

      === INTERVENTION PRIORITY ===
      Tier 1 (>80% risk): 3 clients → $13,200 revenue
      Tier 2 (70-80% risk): 5 clients → $16,000 revenue
      Tier 3 (60-70% risk): 4 clients → $9,200 revenue

      RECOMMENDED ACTIONS:
      1. URGENT (Today): Call top 3 high-risk clients
      2. HIGH (This week): Resolve all billing issues
      3. MEDIUM (Next week): Coach transition check-ins
      4. ONGOING: Implement early warning system for missed sessions
      5. SYSTEMIC: Review coach assignment process
    `
  }
};

/**
 * USAGE EXAMPLES
 */

export const USAGE_EXAMPLES = `
// Example 1: Simple query
const result = await fetch('https://[project-ref].supabase.co/functions/v1/ptd-reasoning', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer [anon-key]',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Why is revenue down this month?",
    mode: "full" // or "compact" for just the answer
  })
});

const data = await result.json();
console.log(data.final_answer);
console.log(data.steps); // See the reasoning trace

// Example 2: Query with context
const result = await fetch('https://[project-ref].supabase.co/functions/v1/ptd-reasoning', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer [anon-key]',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Compare Coach A vs Coach B",
    context: "Focus on client retention and health scores",
    mode: "full"
  })
});

// Example 3: Complex multi-step query
const result = await fetch('https://[project-ref].supabase.co/functions/v1/ptd-reasoning', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer [anon-key]',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Analyze the full customer journey for john@example.com",
    mode: "full"
  })
});

// The response will include:
{
  "success": true,
  "query": "...",
  "chain_type": "sequential" | "parallel" | "conditional",
  "steps": [
    {
      "step_number": 1,
      "question": "...",
      "tool_to_use": "...",
      "tool_args": {...},
      "result": {...},
      "conclusion": "...",
      "execution_time_ms": 1234,
      "status": "completed"
    },
    // ... more steps
  ],
  "final_answer": "Comprehensive answer synthesizing all steps...",
  "execution_summary": {
    "total_steps": 5,
    "completed": 5,
    "failed": 0,
    "total_time_ms": 6789
  }
}
`;

/**
 * CHAIN TYPE EXAMPLES
 */

export const CHAIN_TYPE_EXAMPLES = {
  sequential: {
    description: "Each step depends on the previous step's result",
    example: "Why is revenue down?",
    steps: [
      "Get current revenue → $45,000",
      "Get last month revenue → $58,500 (uses nothing from step 1)",
      "Compare them → -23% (uses steps 1 & 2)",
      "Identify causes → fewer deals (uses step 3)",
      "Generate recommendations (uses step 4)"
    ],
    diagram: "A → B → C → D → E"
  },

  parallel: {
    description: "All steps can run independently and simultaneously",
    example: "Compare Coach A vs Coach B",
    steps: [
      "Get Coach A data (independent)",
      "Get Coach B data (independent)",
      "Compare metrics (uses both 1 & 2)",
      "Explain differences (uses step 3)"
    ],
    diagram: "A ─┐\nB ─┤→ C → D\n   │"
  },

  conditional: {
    description: "Steps branch based on conditions in previous results",
    example: "What's causing the increase in red zone clients?",
    steps: [
      "Get current red zone count → 15",
      "Get historical count → 9",
      "IF increase (15 > 9) → TRUE",
      "  THEN: Analyze red zone clients",
      "  THEN: Find common patterns",
      "  THEN: Generate intervention plan",
      "ELSE: Report normal status"
    ],
    diagram: "A → B → [C?] → (True: D→E→F) / (False: G)"
  }
};
