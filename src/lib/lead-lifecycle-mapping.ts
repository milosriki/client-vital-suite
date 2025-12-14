// Complete Lead Lifecycle Mapping - LIVE DATA ONLY
// Maps HubSpot stages to PTD business process

export const LEAD_LIFECYCLE_STAGES = {
  // HubSpot Deal Stage IDs → Human-Readable Names
  DEAL_STAGES: {
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
  },

  // HubSpot Lifecycle Stages
  LIFECYCLE_STAGES: {
    'lead': 'New Lead',
    'marketingqualifiedlead': 'MQL (Marketing Qualified Lead)',
    'salesqualifiedlead': 'SQL (Sales Qualified Lead)',
    'opportunity': 'Opportunity',
    'customer': 'Customer ✅',
  },

  // Complete Lead Journey Flow
  JOURNEY_FLOW: [
    { stage: 'lead_created', hubspot_lifecycle: 'lead', deal_stage: '122178070', description: 'Lead Created in HubSpot' },
    { stage: 'owner_assigned', hubspot_lifecycle: 'lead', deal_stage: null, description: 'Setter/Owner Assigned' },
    { stage: 'first_contact', hubspot_lifecycle: 'lead', deal_stage: '122237508', description: 'First Contact Attempt (< 20 min SLA)' },
    { stage: 'appointment_booked', hubspot_lifecycle: 'marketingqualifiedlead', deal_stage: '122237508', description: 'Appointment Booked (Assessment Booked)' },
    { stage: 'appointment_held', hubspot_lifecycle: 'salesqualifiedlead', deal_stage: '122237276', description: 'Appointment Held (Assessment Completed)' },
    { stage: 'coach_confirmed', hubspot_lifecycle: 'salesqualifiedlead', deal_stage: '122221229', description: 'Coach Confirmed/Assigned (Booking Process)' },
    { stage: 'deal_created', hubspot_lifecycle: 'opportunity', deal_stage: '122221229', description: 'Deal Created' },
    { stage: 'package_selected', hubspot_lifecycle: 'opportunity', deal_stage: 'qualifiedtobuy', description: 'Package Selected (Qualified to Buy)' },
    { stage: 'contract_sent', hubspot_lifecycle: 'opportunity', deal_stage: 'decisionmakerboughtin', description: 'Contract Sent (Decision Maker Bought In)' },
    { stage: 'payment_pending', hubspot_lifecycle: 'opportunity', deal_stage: '2900542', description: 'Payment Pending' },
    { stage: 'onboarding', hubspot_lifecycle: 'customer', deal_stage: '987633705', description: 'Onboarding' },
    { stage: 'closed_won', hubspot_lifecycle: 'customer', deal_stage: 'closedwon', description: 'Closed Won ✅' },
  ],
};

export const LEAD_LIFECYCLE_PROMPT = `
=== COMPLETE LEAD LIFECYCLE KNOWLEDGE ===

PTD LEAD JOURNEY (12 Stages):
1. Lead Created → HubSpot Contact (lifecycle: lead, deal_stage: 122178070)
2. Owner Assigned → Setter/Owner assigned (< 20 min SLA)
3. First Contact → Deal Stage: 122237508 (Assessment Booked)
4. Appointment Booked → Lifecycle: marketingqualifiedlead
5. Appointment Held → Deal Stage: 122237276 (Assessment Completed), Lifecycle: salesqualifiedlead
6. Coach Confirmed → Deal Stage: 122221229 (Booking Process)
7. Deal Created → Lifecycle: opportunity
8. Package Selected → Deal Stage: qualifiedtobuy
9. Contract Sent → Deal Stage: decisionmakerboughtin
10. Payment Pending → Deal Stage: 2900542
11. Onboarding → Deal Stage: 987633705, Lifecycle: customer
12. Closed Won → Deal Stage: closedwon ✅

CRITICAL RULES:
- ALWAYS query LIVE data from Supabase tables (contacts, deals, call_records)
- NEVER use cached or mock data
- When tracking a lead, check ALL stages: lifecycle_stage, deal_stage, lead_status
- Use long_cycle_protection view to prevent premature closure
- Track time between stages to identify bottlenecks

DATA SOURCES (LIVE ONLY):
- contacts table: lifecycle_stage, lead_status, owner_name
- deals table: stage (deal_stage ID), status, close_date
- call_records table: call_outcome, transcription
- appointments table: status, scheduled_at
- customer_journey_view: Unified view of all touchpoints

STAGE MAPPING FUNCTIONS:
- formatDealStage(stage_id) → Returns human-readable name
- formatLifecycleStage(lifecycle) → Returns human-readable name
- getCurrentStage(contact_id) → Returns current stage from LIVE data
`;

export function formatDealStage(stageId: string): string {
  return LEAD_LIFECYCLE_STAGES.DEAL_STAGES[stageId as keyof typeof LEAD_LIFECYCLE_STAGES.DEAL_STAGES] || stageId;
}

export function formatLifecycleStage(lifecycle: string): string {
  return LEAD_LIFECYCLE_STAGES.LIFECYCLE_STAGES[lifecycle as keyof typeof LEAD_LIFECYCLE_STAGES.LIFECYCLE_STAGES] || lifecycle;
}

export function getStageFromJourney(stageName: string) {
  return LEAD_LIFECYCLE_STAGES.JOURNEY_FLOW.find(s => s.stage === stageName);
}
