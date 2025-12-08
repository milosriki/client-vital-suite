# [DEPRECATED] N8N Workflow Analysis & Claude Agent Replacement Strategy

> **⚠️ DEPRECATED NOTICE**: This document is kept for historical reference only. n8n is no longer used in this system. All automation has been migrated to Supabase Edge Functions and RPC calls as described in this document.

## Executive Summary

The current system uses **5 n8n workflows** running on n8n Cloud to handle client health scoring, risk analysis, and automation. This analysis breaks down each workflow's logic and proposes a **simpler, more maintainable** architecture using **Claude Agents + Supabase Edge Functions**.

**STATUS**: Migration complete. n8n has been replaced with Supabase-based automation.

---

## Current N8N Workflows Overview

### Workflow Inventory

| Workflow | ID | Priority | Purpose |
|----------|-----|----------|---------|
| Daily Calculator | BdVKbuQH6f5nYkvV | HIGH | Calculate health scores for all clients |
| AI Daily Risk Analysis | 2VMbW3pS7pEHkcH1 | HIGH | AI-powered risk assessment |
| Daily Summary Email | G3nWtHVguXSfo81e | MEDIUM | Send daily email reports |
| AI Weekly Pattern Detection | QTpWugAwBcW3kMtU | MEDIUM | Detect weekly behavioral patterns |
| AI Monthly Coach Review | WdzfJ2s0B55XO7Ks | LOW | Monthly coach performance analysis |

---

## Detailed Workflow Logic Breakdown

### 1. Daily Calculator Workflow

**Current n8n Flow:**
```
Schedule Trigger (Daily at 6 AM)
    ↓
PostgreSQL: Fetch all clients from HubSpot contacts
    ↓
Code Node: Calculate Health Scores
    - Engagement Score (sessions frequency)
    - Financial Score (payment status)
    - Package Health Score (sessions remaining vs time)
    - Momentum Score (trend direction)
    - Overall Health Score (weighted average)
    ↓
Code Node: Add Predictive Risk Intelligence
    - Calculate momentum (ACCELERATING/STABLE/DECLINING)
    - Calculate rate of change percentage
    - Generate predictive risk score (0-100)
    - Identify risk factors
    - Flag early warnings
    ↓
Filter: Valid emails only
    ↓
Code Node: Aggregate company-wide metrics
    - Company average score
    - Median score
    - Standard deviation
    - Zone distribution (RED/YELLOW/GREEN/PURPLE counts)
    - Clients improving vs declining
    ↓
HTTP Request: Upsert to Supabase client_health_scores
    ↓
HTTP Request: Update HubSpot contact properties
```

**Core Algorithm (Predictive Risk Score):**
```javascript
// Base risk = 50
let predictiveRisk = 50;

// Momentum impact
if (momentum === 'DECLINING') predictiveRisk += 30;
else if (momentum === 'ACCELERATING') predictiveRisk -= 15;

// Recent activity impact
if (sessions7d === 0) predictiveRisk += 25;
else if (sessions7d < 1) predictiveRisk += 15;
else if (sessions7d >= 2) predictiveRisk -= 10;

// Gap impact
if (daysSince > 30) predictiveRisk += 25;
else if (daysSince > 14) predictiveRisk += 15;
else if (daysSince <= 7) predictiveRisk -= 10;

// Package depletion impact
const remainingPercent = (outstanding / purchased) * 100;
if (remainingPercent < 10 && sessions7d < 2) predictiveRisk += 20;
else if (remainingPercent > 50) predictiveRisk -= 10;

// Zone mismatch penalty
if (healthZone === 'GREEN' && momentum === 'DECLINING') predictiveRisk += 10;

// Clamp to 0-100
predictiveRisk = Math.max(0, Math.min(100, predictiveRisk));
```

**Health Zone Classification:**
```javascript
// Zone thresholds
PURPLE: score >= 85  // Champions
GREEN:  score >= 70  // Healthy
YELLOW: score >= 50  // At Risk
RED:    score < 50   // Critical
```

---

### 2. AI Daily Risk Analysis Workflow

**Current n8n Flow:**
```
Schedule Trigger (Daily after calculator)
    ↓
HTTP Request: Get at-risk clients (Yellow/Red zones)
    - Call RPC: get_at_risk_clients(target_date)
    ↓
Code Node: Prepare prompts for AI analysis
    - Build context for each client
    - Include session history, trends, patterns
    ↓
HTTP Request: Call OpenAI/Claude API
    - Generate psychological insights
    - Recommend intervention strategies
    - Estimate success probability
    ↓
Code Node: Parse AI responses
    - Extract recommendations
    - Generate communication templates
    - Assign priority scores
    ↓
HTTP Request: Insert to intervention_log
```

**AI Prompt Template:**
```
Analyze this client for churn risk:
- Health Score: {health_score}
- Health Zone: {zone}
- Sessions Last 7 Days: {sessions_7d}
- Sessions Last 30 Days: {sessions_30d}
- Days Since Last Session: {days_since}
- Outstanding Sessions: {outstanding}
- Momentum: {momentum_indicator}
- Rate of Change: {rate_of_change}%

Provide:
1. Psychological profile assessment
2. Root cause of disengagement
3. Top 3 intervention recommendations
4. Optimal communication approach
5. Success probability estimate
```

---

### 3. Daily Summary Email Workflow

**Current n8n Flow:**
```
Schedule Trigger (Daily at 8 AM)
    ↓
HTTP Request: Get zone distribution
    - Call RPC: get_zone_distribution(target_date)
    ↓
HTTP Request: Get overall average
    - Call RPC: get_overall_avg(target_date)
    ↓
HTTP Request: Get at-risk clients
    - Call RPC: get_at_risk_clients(target_date)
    ↓
Code Node: Build email content
    - Compile statistics
    - Format HTML template
    - Include intervention priorities
    ↓
Email Node: Send to stakeholders
```

---

### 4. Weekly Pattern Detection Workflow

**Current n8n Flow:**
```
Schedule Trigger (Weekly on Sunday)
    ↓
PostgreSQL: Fetch 7 days of health scores
    ↓
Code Node: Analyze patterns
    - Calculate week-over-week changes
    - Identify consistent decliners
    - Find improvement patterns
    - Detect seasonal trends
    ↓
HTTP Request: Upsert to weekly_patterns table
```

---

### 5. Monthly Coach Review Workflow

**Current n8n Flow:**
```
Schedule Trigger (Monthly on 1st)
    ↓
PostgreSQL: Fetch coach performance data
    ↓
Code Node: Calculate metrics per coach
    - Average client health score
    - Zone distribution
    - Intervention success rate
    - Revenue at risk
    ↓
HTTP Request: Upsert to coach_performance
```

---

## Problems with Current N8N Architecture

### 1. Complexity & Maintenance
- **10+ node types** across workflows (PostgreSQL, HTTP, Code, Set, Filter, Email)
- **87.5% failure rate** on Daily Calculator (35 of 40 executions failed)
- **Multiple credential configurations** (Supabase PostgreSQL, HTTP headers, API keys)
- **Fragile node connections** - one broken link stops entire flow

### 2. Configuration Drift
- URL changes require manual updates in multiple nodes
- Credential mismatches between environments
- SQL column name changes break queries
- HubSpot property mappings get out of sync

### 3. Limited Error Handling
- Single node failure stops entire workflow
- No retry logic for transient errors
- Poor debugging visibility
- No partial execution recovery

### 4. External Dependency
- n8n Cloud subscription required (~$50/month)
- Rate limits on API calls
- Network latency between n8n and Supabase
- No local development/testing capability

---

## Simplified Architecture with Claude Agents

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐     ┌────────────────────┐          │
│  │ daily-health-calc  │────▶│ Claude AI Analysis │          │
│  │ (Cron: 0 6 * * *)  │     │ (On-demand)        │          │
│  └────────────────────┘     └────────────────────┘          │
│           │                          │                       │
│           ▼                          ▼                       │
│  ┌────────────────────┐     ┌────────────────────┐          │
│  │ client_health_scores│     │ intervention_log   │          │
│  │ (Database Table)   │     │ (Database Table)   │          │
│  └────────────────────┘     └────────────────────┘          │
│           │                                                  │
│           ▼                                                  │
│  ┌────────────────────┐                                      │
│  │ Supabase Realtime  │◀────── React Dashboard               │
│  │ (Auto-updates)     │                                      │
│  └────────────────────┘                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Single Edge Function Replacement

**Replace ALL 5 workflows with ONE edge function:**

```typescript
// supabase/functions/health-intelligence/index.ts

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!
});

interface HealthMetrics {
  email: string;
  sessions_last_7d: number;
  sessions_last_30d: number;
  outstanding_sessions: number;
  sessions_purchased: number;
  days_since_last_session: number;
}

// ============================================
// STEP 1: Calculate Health Scores (replaces Daily Calculator)
// ============================================
async function calculateHealthScores(): Promise<any[]> {
  // Fetch all clients with their metrics
  const { data: clients, error } = await supabase
    .from("contacts")
    .select(`
      id, email, firstname, lastname,
      sessions_last_7d, sessions_last_30d, sessions_last_90d,
      outstanding_sessions, sessions_purchased,
      days_since_last_session, days_until_renewal,
      assigned_coach, package_type, package_value_aed
    `);

  if (error) throw error;

  return clients.map(client => {
    // Calculate component scores
    const engagementScore = calculateEngagementScore(client);
    const packageHealthScore = calculatePackageHealthScore(client);
    const momentumScore = calculateMomentumScore(client);

    // Overall health score (weighted average)
    const healthScore = Math.round(
      engagementScore * 0.4 +
      packageHealthScore * 0.3 +
      momentumScore * 0.3
    );

    // Determine zone
    const healthZone =
      healthScore >= 85 ? "PURPLE" :
      healthScore >= 70 ? "GREEN" :
      healthScore >= 50 ? "YELLOW" : "RED";

    // Calculate predictive risk
    const { predictiveRisk, momentum, riskFactors } =
      calculatePredictiveRisk(client);

    return {
      ...client,
      health_score: healthScore,
      health_zone: healthZone,
      engagement_score: engagementScore,
      package_health_score: packageHealthScore,
      momentum_score: momentumScore,
      predictive_risk_score: predictiveRisk,
      momentum_indicator: momentum,
      risk_factors: riskFactors,
      calculated_at: new Date().toISOString(),
      calculated_on: new Date().toISOString().split("T")[0]
    };
  });
}

function calculateEngagementScore(client: HealthMetrics): number {
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const daysSince = client.days_since_last_session || 999;

  let score = 50;

  // Recent activity bonus
  if (sessions7d >= 3) score += 30;
  else if (sessions7d >= 2) score += 20;
  else if (sessions7d >= 1) score += 10;

  // Consistency bonus
  if (sessions30d >= 12) score += 15;
  else if (sessions30d >= 8) score += 10;

  // Recency penalty
  if (daysSince > 30) score -= 30;
  else if (daysSince > 14) score -= 15;
  else if (daysSince > 7) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function calculatePackageHealthScore(client: HealthMetrics): number {
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const remainingPct = (outstanding / purchased) * 100;

  if (remainingPct >= 50) return 90;
  if (remainingPct >= 30) return 70;
  if (remainingPct >= 10) return 50;
  return 30;
}

function calculateMomentumScore(client: HealthMetrics): number {
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;

  const avgWeekly7d = sessions7d;
  const avgWeekly30d = sessions30d / 4.3;

  if (avgWeekly30d === 0) return sessions7d > 0 ? 70 : 30;

  const rateOfChange = ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100;

  if (rateOfChange > 20) return 90;
  if (rateOfChange > 0) return 70;
  if (rateOfChange > -20) return 50;
  return 30;
}

function calculatePredictiveRisk(client: HealthMetrics) {
  const sessions7d = client.sessions_last_7d || 0;
  const sessions30d = client.sessions_last_30d || 0;
  const outstanding = client.outstanding_sessions || 0;
  const purchased = client.sessions_purchased || 1;
  const daysSince = client.days_since_last_session || 0;

  // Calculate momentum
  const avgWeekly7d = sessions7d;
  const avgWeekly30d = sessions30d / 4.3;
  const rateOfChange = avgWeekly30d > 0
    ? ((avgWeekly7d - avgWeekly30d) / avgWeekly30d) * 100
    : 0;

  const momentum =
    rateOfChange > 20 ? "ACCELERATING" :
    rateOfChange < -20 ? "DECLINING" : "STABLE";

  // Calculate risk score
  let predictiveRisk = 50;

  if (momentum === "DECLINING") predictiveRisk += 30;
  else if (momentum === "ACCELERATING") predictiveRisk -= 15;

  if (sessions7d === 0) predictiveRisk += 25;
  else if (sessions7d < 1) predictiveRisk += 15;
  else if (sessions7d >= 2) predictiveRisk -= 10;

  if (daysSince > 30) predictiveRisk += 25;
  else if (daysSince > 14) predictiveRisk += 15;
  else if (daysSince <= 7) predictiveRisk -= 10;

  const remainingPct = (outstanding / purchased) * 100;
  if (remainingPct < 10 && sessions7d < 2) predictiveRisk += 20;
  else if (remainingPct > 50) predictiveRisk -= 10;

  predictiveRisk = Math.max(0, Math.min(100, predictiveRisk));

  const riskFactors = {
    declining_frequency: momentum === "DECLINING",
    low_absolute_sessions: sessions7d < 1,
    long_gap: daysSince > 14,
    package_depletion: remainingPct < 20,
    zero_recent_activity: sessions7d === 0
  };

  return { predictiveRisk, momentum, rateOfChange, riskFactors };
}

// ============================================
// STEP 2: AI Risk Analysis (replaces AI Daily Risk Analysis)
// ============================================
async function analyzeRisksWithClaude(atRiskClients: any[]) {
  const interventions = [];

  for (const client of atRiskClients) {
    const prompt = `You are a client retention specialist. Analyze this fitness client's data and provide intervention recommendations.

Client Profile:
- Name: ${client.firstname} ${client.lastname}
- Health Score: ${client.health_score}/100 (${client.health_zone} zone)
- Sessions Last 7 Days: ${client.sessions_last_7d}
- Sessions Last 30 Days: ${client.sessions_last_30d}
- Days Since Last Session: ${client.days_since_last_session}
- Outstanding Sessions: ${client.outstanding_sessions}/${client.sessions_purchased}
- Momentum: ${client.momentum_indicator} (${client.rate_of_change_percent}% change)
- Risk Score: ${client.predictive_risk_score}/100

Risk Factors Active: ${Object.entries(client.risk_factors)
  .filter(([_, v]) => v)
  .map(([k]) => k.replace(/_/g, ' '))
  .join(', ')}

Provide a JSON response with:
{
  "psychological_profile": "Brief assessment of client mindset",
  "root_cause": "Primary reason for disengagement",
  "intervention_type": "One of: PROACTIVE_CHECKIN, RE_ENGAGEMENT, COACH_CALL, SPECIAL_OFFER, URGENT_OUTREACH",
  "recommended_actions": ["Action 1", "Action 2", "Action 3"],
  "communication_template": "Personalized message to send",
  "optimal_timing": "Best time/day to reach out",
  "success_probability": 0.0-1.0
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    });

    const analysisText = response.content[0].type === "text"
      ? response.content[0].text
      : "";

    // Parse JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    interventions.push({
      client_email: client.email,
      client_name: `${client.firstname} ${client.lastname}`,
      health_score: client.health_score,
      health_zone: client.health_zone,
      intervention_type: analysis.intervention_type || "PROACTIVE_CHECKIN",
      ai_analysis: analysis,
      recommended_actions: analysis.recommended_actions || [],
      communication_template: analysis.communication_template || "",
      success_probability: analysis.success_probability || 0.5,
      status: "PENDING",
      created_at: new Date().toISOString()
    });
  }

  return interventions;
}

// ============================================
// STEP 3: Generate Summary (replaces Daily Summary Email)
// ============================================
function generateDailySummary(healthScores: any[]) {
  const total = healthScores.length;
  const zones = {
    PURPLE: healthScores.filter(c => c.health_zone === "PURPLE").length,
    GREEN: healthScores.filter(c => c.health_zone === "GREEN").length,
    YELLOW: healthScores.filter(c => c.health_zone === "YELLOW").length,
    RED: healthScores.filter(c => c.health_zone === "RED").length
  };

  const avgScore = healthScores.reduce((sum, c) => sum + c.health_score, 0) / total;
  const atRiskCount = zones.YELLOW + zones.RED;
  const atRiskRevenue = healthScores
    .filter(c => ["YELLOW", "RED"].includes(c.health_zone))
    .reduce((sum, c) => sum + (c.package_value_aed || 0), 0);

  const improving = healthScores.filter(c => c.momentum_indicator === "ACCELERATING").length;
  const declining = healthScores.filter(c => c.momentum_indicator === "DECLINING").length;

  return {
    date: new Date().toISOString().split("T")[0],
    total_clients: total,
    average_health_score: Math.round(avgScore * 10) / 10,
    zone_distribution: zones,
    at_risk_count: atRiskCount,
    at_risk_revenue_aed: atRiskRevenue,
    clients_improving: improving,
    clients_declining: declining,
    critical_interventions_needed: zones.RED
  };
}

// ============================================
// STEP 4: Weekly Patterns (replaces Weekly Pattern Detection)
// ============================================
async function detectWeeklyPatterns() {
  const { data: weekData } = await supabase
    .from("client_health_scores")
    .select("*")
    .gte("calculated_on", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    .order("calculated_on", { ascending: true });

  if (!weekData?.length) return null;

  // Group by client
  const clientTrends = new Map<string, number[]>();
  weekData.forEach(record => {
    const scores = clientTrends.get(record.email) || [];
    scores.push(record.health_score);
    clientTrends.set(record.email, scores);
  });

  // Analyze trends
  const patterns = {
    consistently_declining: [] as string[],
    consistently_improving: [] as string[],
    volatile: [] as string[],
    stable: [] as string[]
  };

  clientTrends.forEach((scores, email) => {
    if (scores.length < 3) return;

    const changes = scores.slice(1).map((s, i) => s - scores[i]);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length;

    if (avgChange < -3 && variance < 25) patterns.consistently_declining.push(email);
    else if (avgChange > 3 && variance < 25) patterns.consistently_improving.push(email);
    else if (variance > 100) patterns.volatile.push(email);
    else patterns.stable.push(email);
  });

  return {
    week_ending: new Date().toISOString().split("T")[0],
    patterns,
    summary: {
      declining_count: patterns.consistently_declining.length,
      improving_count: patterns.consistently_improving.length,
      volatile_count: patterns.volatile.length,
      stable_count: patterns.stable.length
    }
  };
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json().catch(() => ({ action: "full" }));
    const results: any = { timestamp: new Date().toISOString() };

    // STEP 1: Calculate all health scores
    console.log("Step 1: Calculating health scores...");
    const healthScores = await calculateHealthScores();
    results.clients_processed = healthScores.length;

    // STEP 2: Upsert to database
    console.log("Step 2: Saving to database...");
    const { error: upsertError } = await supabase
      .from("client_health_scores")
      .upsert(healthScores, {
        onConflict: "email,calculated_on",
        ignoreDuplicates: false
      });

    if (upsertError) throw upsertError;
    results.database_updated = true;

    // STEP 3: Generate summary
    console.log("Step 3: Generating summary...");
    const summary = generateDailySummary(healthScores);
    results.summary = summary;

    // Save summary
    await supabase.from("daily_summary").upsert(summary, {
      onConflict: "date"
    });

    // STEP 4: AI analysis for at-risk clients (if requested)
    if (action === "full" || action === "ai_analysis") {
      console.log("Step 4: Running AI analysis...");
      const atRiskClients = healthScores.filter(c =>
        ["YELLOW", "RED"].includes(c.health_zone)
      );

      if (atRiskClients.length > 0) {
        const interventions = await analyzeRisksWithClaude(atRiskClients);

        await supabase.from("intervention_log").insert(interventions);
        results.interventions_created = interventions.length;
      }
    }

    // STEP 5: Weekly patterns (if Sunday or requested)
    const isWeekend = new Date().getDay() === 0;
    if (isWeekend || action === "weekly") {
      console.log("Step 5: Detecting weekly patterns...");
      const patterns = await detectWeeklyPatterns();
      if (patterns) {
        await supabase.from("weekly_patterns").upsert(patterns, {
          onConflict: "week_ending"
        });
        results.weekly_patterns = patterns.summary;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("Health intelligence error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
```

---

## Comparison: N8N vs Claude Agent Approach

| Aspect | N8N (Current) | Claude Agent (Proposed) |
|--------|---------------|------------------------|
| **Files/Components** | 5 workflows, 50+ nodes | 1 edge function (~300 lines) |
| **External Dependencies** | n8n Cloud subscription | Just Supabase (already have) |
| **Monthly Cost** | ~$50+ (n8n Cloud) | $0 (included in Supabase) |
| **Failure Rate** | 87.5% on critical workflow | Built-in error handling |
| **Debugging** | Navigate through nodes | Single file, console logs |
| **Testing** | Manual via n8n UI | Local Deno testing |
| **AI Integration** | Separate HTTP nodes | Native Claude SDK |
| **Data Flow** | Complex node chains | Linear function calls |
| **Version Control** | Export/import JSON | Git-tracked TypeScript |
| **Rollback** | Manual workflow restore | Git revert |

---

## Migration Steps

### Phase 1: Create Edge Function (Day 1)
1. Create `supabase/functions/health-intelligence/index.ts`
2. Implement health score calculation logic
3. Test locally with `supabase functions serve`

### Phase 2: Add AI Analysis (Day 2)
1. Add Claude API integration
2. Implement intervention generation
3. Test with sample at-risk clients

### Phase 3: Add Scheduling (Day 3)
1. Set up Supabase cron job
2. Configure daily/weekly triggers
3. Add email notification via Resend/SendGrid

### Phase 4: Parallel Running (Week 1)
1. Run new function alongside n8n
2. Compare outputs for accuracy
3. Fix any discrepancies

### Phase 5: Decommission N8N (Week 2)
1. Disable n8n workflows
2. Cancel n8n Cloud subscription
3. Archive workflow exports

---

## Scheduling with Supabase Cron

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily health calculation at 6 AM Dubai time
SELECT cron.schedule(
  'daily-health-calc',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://boowptjtwadxpjkpctna.supabase.co/functions/v1/health-intelligence',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"action": "full"}'
  );
  $$
);

-- Weekly patterns on Sunday at midnight
SELECT cron.schedule(
  'weekly-patterns',
  '0 0 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://boowptjtwadxpjkpctna.supabase.co/functions/v1/health-intelligence',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"action": "weekly"}'
  );
  $$
);
```

---

## Benefits of Simplified Architecture

### 1. Single Source of Truth
- All logic in one file
- Easy to understand data flow
- No hidden node configurations

### 2. Better Error Handling
```typescript
try {
  const scores = await calculateHealthScores();
  await saveToDatabase(scores);
  await notifyOnSuccess();
} catch (error) {
  await logError(error);
  await notifyOnFailure(error);
  // Partial results still saved
}
```

### 3. Native Claude Integration
- Direct SDK usage (no HTTP node configuration)
- Streaming support for long analyses
- Tool use for complex reasoning

### 4. Cost Savings
- Eliminate n8n Cloud: -$50/month
- Faster execution: Less API calls
- Included in Supabase free tier

### 5. Developer Experience
- TypeScript with full type safety
- Local testing with hot reload
- Git-based version control
- IDE autocompletion

---

## Conclusion

The current n8n architecture is **over-engineered** for this use case. The 5 workflows with 50+ nodes can be replaced by a **single 300-line TypeScript function** that:

1. Runs directly on Supabase (no external service)
2. Has native Claude AI integration
3. Is fully version-controlled
4. Costs $0 extra per month
5. Has proper error handling
6. Is easier to debug and maintain

**Recommendation**: Migrate to the Claude Agent + Edge Function architecture within 2 weeks, running in parallel with n8n for validation before full cutover.
