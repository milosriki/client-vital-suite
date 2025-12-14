// Lead Lifecycle Prompt Component
// Complete stage mappings, lifecycle progression rules, conversion funnel logic

import { LEAD_LIFECYCLE_PROMPT } from '../lead-lifecycle-mapping';

// Export the prompt (already defined in lead-lifecycle-mapping.ts)
export { LEAD_LIFECYCLE_PROMPT };

// Additional lifecycle-specific prompt content
export const LEAD_LIFECYCLE_ADDITIONAL_PROMPT = `
=== LEAD LIFECYCLE TRACKING RULES ===

CONVERSION FUNNEL LOGIC:

Stage Progression Rules:
1. Lead Created → Must have owner assigned within 20 minutes (SLA)
2. Owner Assigned → First contact attempt triggers Assessment Booked stage
3. Assessment Booked → Appointment Held triggers Assessment Completed
4. Assessment Completed → Coach assignment triggers Booking Process
5. Booking Process → Package selection triggers Qualified to Buy
6. Qualified to Buy → Contract triggers Decision Maker Bought In
7. Decision Maker Bought In → Payment triggers Payment Pending
8. Payment Pending → Onboarding triggers Onboarding stage
9. Onboarding → Completion triggers Closed Won

Bottleneck Detection:
- Leads stuck in stage >7 days = BOTTLENECK
- No activity for 48+ hours = STALLED
- Multiple stage reversals = WORKFLOW ISSUE

Long Cycle Protection:
- Check long_cycle_protection view before closing leads
- Don't close leads with recent activity (< 7 days calls, < 14 days appointments)
- Verify all touchpoints before marking Closed Won

CRITICAL RULES:
- ALWAYS query LIVE data from lead_lifecycle_view
- Track time in each stage to identify bottlenecks
- Use formatDealStage() and formatLifecycleStage() to convert IDs
- Check for stalled leads (>48h in same stage)
- Verify workflow triggers are firing correctly
`;
