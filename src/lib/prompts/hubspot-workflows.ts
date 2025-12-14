// HubSpot Workflow Intelligence Prompt Component
// Workflow analysis, optimization suggestions, full flow mapping

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

WORKFLOW INTEGRATION POINTS:
- Boardroom Architecture: "The Analyst (Sherlock)" reads workflow data
- Human Performance: Workflow execution tied to Setter/Owner metrics
- ROI Knowledge Base: Workflow optimization includes revenue impact
- Ultimate Truth: Workflow triggers affect event alignment
`;
