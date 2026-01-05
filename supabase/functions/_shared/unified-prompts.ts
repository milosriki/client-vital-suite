// Unified Prompts for Edge Functions
// Since Edge Functions run in Deno and can't import from src/lib,
// we copy the unified prompt components here

export const LEAD_LIFECYCLE_PROMPT = `
PTD LEAD JOURNEY:
1. Lead (122178070)
2. MQL (Booked)
3. SQL (Assesment)
4. Opportunity
5. Closed Won ✅
- Rules: Query LIVE Supabase tables.
`;

export const UNIFIED_SCHEMA_PROMPT = `
SCHEMA:
- contacts: email, lifecycle_stage, utm_campaign, first_touch_source, assigned_coach, owner_id
- deals: deal_value, stage, status, contact_id
- call_records: caller_number, transcription, call_outcome
- client_health_scores: health_score, health_zone
- daily_business_metrics: date, total_leads_new, total_revenue_booked, ad_spend_facebook, roas_daily
- staff: name, email, role, status

ROLES:
- Setter: Contact Owner (HubSpot Owner ID). Responsible for calls/booking. Example: Matthew Twigg.
- Coach (Closer): Assigned Coach Property. Responsible for closing deals/revenue.
`;

export const AGENT_ALIGNMENT_PROMPT = `
MAPPINGS:
- 122178070 = New Lead
- 122237508 = Assessment Booked
- 122237276 = Assessment Completed
- 122221229 = Booking Process
- qualifiedtobuy = Qualified
- contractsent = Contract Sent
- 2900542 = Payment Pending
- 987633705 = Onboarding
- closedwon = Closed Won
- TRUTH: anytrack > hubspot > facebook
`;

export const ULTIMATE_TRUTH_PROMPT = `
ALIGNMENT:
- Primary Key: email
- Conversion Status: HubSpot deal closed_won is absolute truth.
- ROAS: Connect FB Ad IDs to Stripe Net Cash.
`;

export const ROI_MANAGERIAL_PROMPT = `
ECONOMICS:
- LTV = Avg Package * (Retention / (1-Retention))
- CAC = Total Spend / New Clients
- Target ROAS: > 5x
`;

export const HUBSPOT_WORKFLOWS_PROMPT = `
=== HUBSPOT WORKFLOW INTELLIGENCE ===

WORKFLOW SYSTEM OVERVIEW:
- Total Workflows: 201 (52 active, 149 inactive)
- Critical Issues: Infinite loop in reassignment workflow, 95% nurture workflows inactive
- Revenue Impact: 634,070+ AED/month lost due to workflow failures

WORKFLOW CATEGORIES:
1. Deal Stage Management (20 workflows, 11 active)
2. Follow-up & Nurture (20 workflows, 1 active) ⚠️ 95% inactive
3. Tracking & Accountability (9 workflows, 3 active)
4. Lead Assignment & Rotation (8 workflows, 3 active)
5. Email Sequences (8 workflows, 3 active)
6. Lead Entry & Delegation (7 workflows, 3 active)
7. Data Management (6 workflows, 1 active)
8. Notifications & Alerts (5 workflows, 3 active)
9. Integration & Automation (4 workflows, 1 active)
10. Reassignment & Recovery (1 workflow, 0 active) ⚠️ CRITICAL - Inactive

CRITICAL WORKFLOW ISSUES:

1. Infinite Loop in Reassignment Workflow:
   - Workflow ID: 1655409725
   - Status: BROKEN
   - Impact: 634,070+ AED/month revenue loss
   - Fix Required: Add reassignment flag, max reassignment count, cooldown period

2. Inactive Nurture Sequences:
   - 19 of 20 nurture workflows INACTIVE (95%)
   - Impact: Massive conversion rate loss
   - Fix Required: Review and activate nurture workflows

3. Buried Premium Leads:
   - Premium location leads sitting 24-48+ hours uncalled
   - No location-based prioritization
   - Impact: 275,000 AED immediate recovery opportunity

FULL FLOW INTELLIGENCE:

End-to-End Mapping:
Ad Spend (Meta) → Lead Creation (HubSpot) → Workflow Trigger → Owner Assignment → Call Made (CallGear) → Appt Set → Deal Created → Closed Won (Stripe)

Workflow Alignment with AI Recommendations:

When AI Recommends: "Reassign lead X to Owner Y"
- System Checks: Is there a HubSpot workflow that handles this?
- Yes → Update property to trigger workflow (reassignment_needed = true)
- No → Direct API reassignment via reassign-owner function

When AI Recommends: "Send re-engagement email to cold leads"
- System Checks: Is there a nurture workflow?
- Yes → Enroll contacts in workflow
- No → Suggest creating workflow in HubSpot UI

WORKFLOW PERFORMANCE METRICS:

Track for each workflow:
- Enrollment count
- Completion rate
- Error rate
- Revenue impact (AED lost/gained)
- Success rate

PROACTIVE WORKFLOW SUGGESTIONS:

Daily Workflow Audit:
- Check enrollment vs completion rates
- Identify workflows with <40% completion rate
- Suggest splitting into smaller segments
- Flag workflows with errors

Activation Recommendations:
- Identify inactive workflows with high potential
- Calculate estimated revenue recovery if activated
- Prioritize by revenue impact

Optimization Alerts:
- Flag workflows with infinite loops
- Identify workflows causing SLA breaches
- Suggest workflow consolidation opportunities

CRITICAL RULES:
- ALWAYS query LIVE workflow data from HubSpot API
- NEVER use mock or test workflow data
- When recommending workflow changes, check if workflow exists first
- Use property-based triggering when possible (more reliable than API)
- Monitor workflow execution in real-time
- Calculate revenue impact for every workflow recommendation
`;

// ═══════════════════════════════════════════════════════════════
// AGENT ROLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const AGENT_ROLES = {
  SMART_AGENT: {
    name: "PTD Smart Agent",
    persona: "Senior business analyst at PTD Fitness Dubai",
    capabilities: ["CRM queries", "client lookup", "health scoring", "metrics"],
    tone: "Professional, data-driven, action-oriented",
    maxTokens: 4096
  },
  BUSINESS_INTELLIGENCE: {
    name: "Business Intelligence Agent", 
    persona: "Executive analyst providing strategic insights",
    capabilities: ["trend analysis", "KPI tracking", "forecasting", "anomaly detection"],
    tone: "Executive summary style, highlight key metrics",
    maxTokens: 2048
  },
  CHURN_PREDICTOR: {
    name: "Churn Prediction Agent",
    persona: "Retention specialist identifying at-risk clients",
    capabilities: ["risk scoring", "pattern recognition", "early warning"],
    tone: "Alert-focused, prioritize actionable insights",
    maxTokens: 2048
  },
  INTERVENTION_RECOMMENDER: {
    name: "Intervention Recommender",
    persona: "Client success manager suggesting retention actions",
    capabilities: ["intervention planning", "personalized outreach", "escalation"],
    tone: "Action-oriented, specific recommendations",
    maxTokens: 2048
  },
  PROACTIVE_INSIGHTS: {
    name: "Proactive Insights Generator",
    persona: "Business analyst surfacing opportunities and risks",
    capabilities: ["opportunity detection", "risk alerts", "trend spotting"],
    tone: "Proactive, forward-looking, prioritized",
    maxTokens: 2048
  },
  STRIPE_PAYOUTS_AI: {
    name: "Stripe Analytics Agent",
    persona: "Financial analyst for payment data",
    capabilities: ["payout analysis", "transaction tracking", "reconciliation"],
    tone: "Precise, financial accuracy, audit-ready",
    maxTokens: 2048
  },
  AGENT_ANALYST: {
    name: "Agent Performance Analyst",
    persona: "Operations analyst tracking agent metrics",
    capabilities: ["performance tracking", "efficiency analysis", "optimization"],
    tone: "Metrics-focused, comparative analysis",
    maxTokens: 2048
  },
  ORCHESTRATOR: {
    name: "Super Agent Orchestrator",
    persona: "Traffic controller routing to specialized agents",
    capabilities: ["intent classification", "agent routing", "context passing"],
    tone: "Brief, decisive, routing-focused",
    maxTokens: 1024
  }
} as const;

// ═══════════════════════════════════════════════════════════════
// COMPACT BUSINESS CONTEXT (Replaces bloated inline versions)
// ═══════════════════════════════════════════════════════════════

export const PTD_BUSINESS_CONTEXT = `
## PTD Fitness Dubai - Business Context
- Premium mobile personal training service
- Target: Executives & professionals 40+
- Packages: AED 3,520 - 41,616
- Team: 55+ Master's certified coaches
- Results: 12,000+ transformations, 600+ 5-star reviews

## Health Zone System
| Zone   | Score   | Status      | Action Required |
|--------|---------|-------------|-----------------|
| Purple | 85-100  | Thriving    | Maintain excellence |
| Green  | 70-84   | Healthy     | Continue engagement |
| Yellow | 50-69   | At Risk     | Proactive outreach |
| Red    | 0-49    | Critical    | Immediate intervention |

## Key Integrations
- HubSpot CRM (Portal: 7973797)
- Stripe Payments
- CallGear (call tracking)
- Meta CAPI (attribution)
`;

// ═══════════════════════════════════════════════════════════════
// OUTPUT FORMAT SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const OUTPUT_FORMATS = {
  CLIENT_ANALYSIS: {
    schema: `{
      "email": "string",
      "name": "string", 
      "health_score": "number (0-100)",
      "health_zone": "Purple|Green|Yellow|Red",
      "risk_factors": ["string"],
      "recommended_actions": ["string"],
      "priority": "high|medium|low"
    }`,
    example: `{"email":"john@example.com","name":"John Smith","health_score":45,"health_zone":"Red","risk_factors":["No sessions in 14 days","Payment overdue"],"recommended_actions":["Call within 24h","Offer makeup session"],"priority":"high"}`
  },
  INTERVENTION_PLAN: {
    schema: `{
      "client_email": "string",
      "intervention_type": "call|email|sms|in_person",
      "priority": "immediate|today|this_week",
      "message_template": "string",
      "escalation_path": "string"
    }`
  },
  EXECUTIVE_SUMMARY: {
    schema: `{
      "date": "ISO date",
      "highlights": ["string"],
      "metrics": {"key": "value"},
      "alerts": ["string"],
      "recommendations": ["string"]
    }`
  }
} as const;

// ═══════════════════════════════════════════════════════════════
// HEALTH ZONE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const HEALTH_ZONE_DEFINITIONS = `
## Health Zone Classification
- Purple (85-100): Thriving - maintain excellence, potential referral source
- Green (70-84): Healthy - continue engagement, monitor for changes
- Yellow (50-69): At Risk - proactive outreach needed within 48 hours
- Red (0-49): Critical - immediate intervention required within 24 hours
`;

// ═══════════════════════════════════════════════════════════════
// UNIFIED PROMPT BUILDER (Main function to use)
// ═══════════════════════════════════════════════════════════════

export interface AgentPromptOptions {
  includeLifecycle?: boolean;
  includeROI?: boolean;
  includeHubSpot?: boolean;
  includeHealthZones?: boolean;
  outputFormat?: keyof typeof OUTPUT_FORMATS;
  additionalContext?: string;
}

export function buildAgentPrompt(
  role: keyof typeof AGENT_ROLES,
  options: AgentPromptOptions = {}
): string {
  const agent = AGENT_ROLES[role];
  
  let prompt = `# Role: ${agent.name}

You are a ${agent.persona}.

## Capabilities
${agent.capabilities.map(c => `- ${c}`).join('\n')}

## Communication Style
${agent.tone}

${PTD_BUSINESS_CONTEXT}
`;

  // Add optional sections based on flags
  if (options.includeLifecycle) {
    prompt += `\n${LEAD_LIFECYCLE_PROMPT}\n`;
  }
  
  if (options.includeROI) {
    prompt += `\n${ROI_MANAGERIAL_PROMPT}\n`;
  }
  
  if (options.includeHubSpot) {
    prompt += `\n${HUBSPOT_WORKFLOWS_PROMPT}\n`;
  }
  
  if (options.includeHealthZones) {
    prompt += `\n${HEALTH_ZONE_DEFINITIONS}\n`;
  }
  
  if (options.outputFormat && OUTPUT_FORMATS[options.outputFormat]) {
    prompt += `\n## Required Output Format\n${OUTPUT_FORMATS[options.outputFormat].schema}\n`;
  }
  
  if (options.additionalContext) {
    prompt += `\n## Additional Context\n${options.additionalContext}\n`;
  }

  // Add universal rules
  prompt += `
## Universal Rules
1. Be concise - executives have limited time
2. Lead with insights, not data dumps
3. Always include actionable next steps
4. Flag anomalies and urgent items first
5. Use health zones consistently for client status
`;

  return prompt;
}

// Alias for backward compatibility
export const LEAD_LIFECYCLE_KNOWLEDGE = LEAD_LIFECYCLE_PROMPT;
export const ROI_MANAGERIAL_INTELLIGENCE = ROI_MANAGERIAL_PROMPT;
export const HUBSPOT_WORKFLOW_INTELLIGENCE = HUBSPOT_WORKFLOWS_PROMPT;

// Helper function to format deal stage
export function formatDealStage(stageId: string): string {
  const stageMap: Record<string, string> = {
    '122178070': 'New Lead (Incoming)',
    '122237508': 'Assessment Booked',
    '122237276': 'Assessment Completed',
    '122221229': 'Booking Process',
    'qualifiedtobuy': 'Qualified to Buy',
    'decisionmakerboughtin': 'Decision Maker Bought In',
    'contractsent': 'Contract Sent',
    '2900542': 'Payment Pending',
    '987633705': 'Onboarding',
    'closedwon': 'Closed Won ✅',
    '1063991961': 'Closed Lost ❌',
    '1064059180': 'On Hold',
  };
  return stageMap[stageId] || stageId;
}

// Helper function to format lifecycle stage
export function formatLifecycleStage(lifecycle: string): string {
  const lifecycleMap: Record<string, string> = {
    'lead': 'New Lead',
    'marketingqualifiedlead': 'MQL (Marketing Qualified Lead)',
    'salesqualifiedlead': 'SQL (Sales Qualified Lead)',
    'opportunity': 'Opportunity',
    'customer': 'Customer ✅',
  };
  return lifecycleMap[lifecycle] || lifecycle;
}

// Build unified prompt for Edge Functions
export function buildUnifiedPromptForEdgeFunction(options: any): string {
  return `
MISSION: PTD CEO Control.
RULES: Use LIVE data. anytrack > hubspot > facebook.
CONTEXT: ${options.knowledge || ''} ${options.memory || ''}
`;
}
