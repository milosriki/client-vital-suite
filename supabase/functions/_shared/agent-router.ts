// ============= INTELLIGENT AGENT ROUTER (3→10) =============
// Routes queries to the optimal specialist agent based on intent detection

export interface RouteResult {
  primary_agent: string;
  secondary_agents: string[];
  confidence: number;
  detected_intents: string[];
  reasoning: string;
}

// Intent detection patterns with weights
const INTENT_PATTERNS: Record<string, { keywords: string[]; weight: number; agent: string }> = {
  // Fraud Detection
  fraud: {
    keywords: ['fraud', 'suspicious', 'chargeback', 'refund', 'dispute', 'unknown card', 'fake', 'scam'],
    weight: 1.0,
    agent: 'fraud_detective'
  },

  // Churn & Retention
  churn: {
    keywords: ['churn', 'leaving', 'cancel', 'quit', 'stop', 'red zone', 'at risk', 'dropout', 'inactive'],
    weight: 1.0,
    agent: 'churn_predictor'
  },

  // Sales & Pipeline
  sales: {
    keywords: ['pipeline', 'deal', 'close', 'conversion', 'sales', 'opportunity', 'revenue', 'quota'],
    weight: 0.9,
    agent: 'sales_optimizer'
  },

  // Coach Performance
  coach: {
    keywords: ['coach', 'trainer', 'performance', 'workload', 'client distribution', 'assignment'],
    weight: 0.9,
    agent: 'coach_analyzer'
  },

  // Revenue & Pricing
  revenue: {
    keywords: ['revenue', 'pricing', 'upsell', 'ltv', 'lifetime value', 'profit', 'margin', 'package'],
    weight: 0.85,
    agent: 'revenue_engineer'
  },

  // Lead Management
  lead: {
    keywords: ['lead', 'prospect', 'new contact', 'assign', 'route', 'response time', 'follow up'],
    weight: 0.85,
    agent: 'lead_router'
  },

  // Campaign & Ads
  campaign: {
    keywords: ['campaign', 'ad', 'facebook', 'google', 'roas', 'cpc', 'attribution', 'spend', 'meta'],
    weight: 0.9,
    agent: 'campaign_analyst'
  },

  // Call Analysis
  call: {
    keywords: ['call', 'phone', 'transcript', 'recording', 'objection', 'sentiment', 'conversation'],
    weight: 0.9,
    agent: 'call_whisperer'
  },

  // HubSpot & CRM
  hubspot: {
    keywords: ['hubspot', 'crm', 'sync', 'workflow', 'property', 'contact', 'lifecycle'],
    weight: 0.85,
    agent: 'hubspot_guardian'
  },

  // Anomaly & Patterns
  anomaly: {
    keywords: ['anomaly', 'unusual', 'pattern', 'trend', 'spike', 'drop', 'weird', 'strange'],
    weight: 0.8,
    agent: 'pattern_hunter'
  }
};

// Semantic similarity using keyword matching (can be upgraded to embeddings)
function calculateIntentScores(query: string): Map<string, number> {
  const queryLower = query.toLowerCase();
  const scores = new Map<string, number>();

  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of config.keywords) {
      if (queryLower.includes(keyword)) {
        // Exact match gets full weight
        score += config.weight;
        matchedKeywords.push(keyword);
      } else {
        // Partial match (word starts with keyword)
        const words = queryLower.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(keyword.slice(0, 4)) && keyword.length > 3) {
            score += config.weight * 0.5;
            matchedKeywords.push(`~${keyword}`);
          }
        }
      }
    }

    // Normalize by number of keywords
    const normalizedScore = score / Math.sqrt(config.keywords.length);
    scores.set(intent, normalizedScore);
  }

  return scores;
}

// Route query to best agent(s)
export function routeQuery(query: string): RouteResult {
  const scores = calculateIntentScores(query);
  const sortedIntents = [...scores.entries()]
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  // No matches - use general agent
  if (sortedIntents.length === 0) {
    return {
      primary_agent: 'general',
      secondary_agents: [],
      confidence: 0.5,
      detected_intents: [],
      reasoning: 'No specific intent detected, routing to general agent'
    };
  }

  const [primaryIntent, primaryScore] = sortedIntents[0];
  const primaryAgent = INTENT_PATTERNS[primaryIntent].agent;

  // Get secondary agents for multi-agent coordination
  const secondaryAgents = sortedIntents
    .slice(1, 3)
    .filter(([_, score]) => score > primaryScore * 0.5) // Within 50% of primary score
    .map(([intent, _]) => INTENT_PATTERNS[intent].agent);

  // Calculate confidence based on score spread
  const confidence = Math.min(0.95, primaryScore / (primaryScore + 0.5));

  return {
    primary_agent: primaryAgent,
    secondary_agents: secondaryAgents,
    confidence,
    detected_intents: sortedIntents.map(([intent, _]) => intent),
    reasoning: `Detected ${primaryIntent} intent with ${(confidence * 100).toFixed(0)}% confidence. Keywords matched: ${INTENT_PATTERNS[primaryIntent].keywords.filter(k => query.toLowerCase().includes(k)).join(', ')}`
  };
}

// Get agent-specific system prompt enhancement
export function getAgentPromptEnhancement(agentType: string): string {
  const enhancements: Record<string, string> = {
    fraud_detective: `
FRAUD DETECTION FOCUS:
- Look for patterns: multiple refunds, unusual timing, suspicious amounts
- Check Stripe data for chargeback patterns
- Verify payment method consistency
- Flag unknown or suspicious cards
- Calculate fraud risk score (0-100)
OUTPUT: Always include fraud_risk_score, suspicious_indicators[], recommended_action`,

    churn_predictor: `
CHURN PREDICTION FOCUS:
- Analyze engagement decline patterns
- Check session frequency drops
- Look for payment issues or complaints
- Calculate days since last activity
- Identify intervention opportunities
OUTPUT: Always include churn_probability (0-1), risk_factors[], days_until_likely_churn, intervention_recommendation`,

    sales_optimizer: `
SALES OPTIMIZATION FOCUS:
- Analyze pipeline velocity and bottlenecks
- Calculate conversion rates by stage
- Identify stuck deals and reasons
- Track deal value trends
- Find optimization opportunities
OUTPUT: Always include conversion_rate, avg_cycle_days, bottleneck_stage, revenue_at_risk, optimization_actions[]`,

    coach_analyzer: `
COACH ANALYSIS FOCUS:
- Compare coach performance metrics
- Analyze client distribution and capacity
- Track success rates by coach
- Identify workload imbalances
- Suggest optimal client assignments
OUTPUT: Always include performance_score, client_count, capacity_utilization, recommendations[]`,

    revenue_engineer: `
REVENUE ENGINEERING FOCUS:
- Calculate LTV, CAC, contribution margin
- Identify upsell opportunities
- Analyze pricing effectiveness
- Track revenue leaks
- Model revenue scenarios
OUTPUT: Always include ltv_aed, cac_aed, margin_percent, upsell_opportunities[], revenue_leak_aed`,

    lead_router: `
LEAD ROUTING FOCUS:
- Score leads by conversion probability
- Match leads to best-fit setters
- Optimize response time
- Track lead source quality
- Prioritize high-value leads
OUTPUT: Always include lead_score, recommended_owner, priority_level, source_quality, expected_ltv`,

    campaign_analyst: `
CAMPAIGN ANALYSIS FOCUS:
- Calculate ROAS by campaign
- Track attribution accuracy
- Identify best/worst performers
- Analyze audience segments
- Optimize budget allocation
OUTPUT: Always include roas, cost_per_lead, cost_per_customer, attribution_confidence, budget_recommendation`,

    call_whisperer: `
CALL ANALYSIS FOCUS:
- Analyze call transcripts for patterns
- Detect objection types and frequency
- Track sentiment trends
- Identify successful techniques
- Score call quality
OUTPUT: Always include sentiment_score, objections_detected[], successful_techniques[], call_quality_score`,

    hubspot_guardian: `
HUBSPOT GUARDIAN FOCUS:
- Monitor sync health and errors
- Check data quality issues
- Validate workflow execution
- Track property updates
- Ensure data consistency
OUTPUT: Always include sync_status, error_count, data_quality_score, workflow_issues[], recommendations[]`,

    pattern_hunter: `
PATTERN DETECTION FOCUS:
- Find unusual data patterns
- Detect trend changes
- Identify correlations
- Spot anomalies early
- Track pattern evolution
OUTPUT: Always include anomalies_detected[], trend_direction, correlation_strength, pattern_confidence, alert_level`
  };

  return enhancements[agentType] || '';
}

// Get tool subset for specialist agent
export function getAgentTools(agentType: string): string[] {
  const toolSets: Record<string, string[]> = {
    fraud_detective: ['stripe_control', 'universal_search', 'analytics_control'],
    churn_predictor: ['client_control', 'get_at_risk_clients', 'analytics_control', 'intelligence_control'],
    sales_optimizer: ['sales_flow_control', 'lead_control', 'analytics_control', 'get_daily_summary'],
    coach_analyzer: ['get_coach_performance', 'get_coach_clients', 'client_control', 'analytics_control'],
    revenue_engineer: ['stripe_control', 'sales_flow_control', 'analytics_control', 'get_daily_summary'],
    lead_router: ['lead_control', 'universal_search', 'hubspot_control', 'get_proactive_insights'],
    campaign_analyst: ['analytics_control', 'hubspot_control', 'get_daily_summary'],
    call_whisperer: ['call_control', 'universal_search', 'analytics_control'],
    hubspot_guardian: ['hubspot_control', 'universal_search', 'intelligence_control'],
    pattern_hunter: ['analytics_control', 'get_daily_summary', 'get_proactive_insights', 'intelligence_control'],
    general: ['universal_search', 'client_control', 'lead_control', 'sales_flow_control', 'hubspot_control',
              'stripe_control', 'call_control', 'analytics_control', 'intelligence_control',
              'get_at_risk_clients', 'get_coach_performance', 'get_proactive_insights', 'get_daily_summary']
  };

  return toolSets[agentType] || toolSets.general;
}
