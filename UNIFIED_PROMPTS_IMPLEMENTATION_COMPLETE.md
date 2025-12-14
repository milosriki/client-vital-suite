# Unified Prompts Implementation Complete

## Summary

All AI agents have been updated to use the unified prompt system, ensuring consistency across the entire PTD Fitness AI ecosystem.

## Files Created

1. **`supabase/functions/_shared/unified-prompts.ts`**
   - Centralized prompt library for Edge Functions
   - Contains all unified prompt components:
     - `LEAD_LIFECYCLE_PROMPT` - Complete lead lifecycle knowledge
     - `UNIFIED_SCHEMA_PROMPT` - Single source of truth data schema
     - `AGENT_ALIGNMENT_PROMPT` - Mandatory alignment rules
     - `ULTIMATE_TRUTH_PROMPT` - Data alignment across FB CAPI, HubSpot, AnyTrack
     - `ROI_MANAGERIAL_PROMPT` - ROI-driven intelligence
     - `HUBSPOT_WORKFLOWS_PROMPT` - Workflow intelligence
   - Helper functions: `formatDealStage()`, `formatLifecycleStage()`
   - `buildUnifiedPromptForEdgeFunction()` - Dynamic prompt builder

## Files Updated

### 1. `supabase/functions/ptd-agent-claude/index.ts`
- ✅ Added import for unified prompts
- ✅ Replaced system prompt with unified prompt builder
- ✅ Updated `lead_control` tool to use `contacts` table instead of `enhanced_leads` (unified schema)

### 2. `supabase/functions/ptd-agent-gemini/index.ts`
- ✅ Added import for unified prompts
- ✅ Replaced system prompt with unified prompt builder
- ✅ Maintained chain-of-thought reasoning and tool usage strategy

### 3. `supabase/functions/ptd-ultimate-intelligence/index.ts`
- ✅ Added imports for all unified prompt components
- ✅ Integrated unified prompts into Claude and Gemini generation functions
- ✅ Updated `buildBusinessContext()` to use `contacts` table instead of `enhanced_leads`

## Unified Data Schema Changes

### Table Name Standardization
- ❌ **OLD**: `enhanced_leads` (deprecated)
- ✅ **NEW**: `contacts` (unified schema)

### Field Name Standardization
- Email: `contacts.email` (primary identifier)
- Lifecycle Stage: `contacts.lifecycle_stage` (lead, mql, sql, opportunity, customer)
- Deal Stage: `deals.stage` (HubSpot stage ID - use `formatDealStage()` to convert)
- Attribution Source: `attribution_events.source` (from AnyTrack - BEST attribution)
- Health Score: `client_health_scores.health_score` (0-100)

## Data Priority Rules (When sources conflict)

1. **Attribution**: AnyTrack > HubSpot > Facebook (AnyTrack has best attribution data)
2. **PII**: HubSpot > AnyTrack > Facebook (HubSpot has most complete contact data)
3. **Conversion**: HubSpot deals.closed_won is source of truth
4. **Health**: client_health_scores table is calculated source of truth

## Agent Alignment Rules

All agents now use:
- ✅ Consistent stage mappings (HubSpot Deal Stage IDs → Human-readable names)
- ✅ Consistent lifecycle stages (lead, mql, sql, opportunity, customer)
- ✅ Unified data sources (`contacts` table, not `enhanced_leads`)
- ✅ Standardized field names (`lifecycle_stage`, not `lifecycleStage`)
- ✅ Attribution priority (AnyTrack > HubSpot > Facebook)

## Lead Lifecycle Knowledge

All agents now understand the complete 12-stage lead journey:
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

## Ultimate Truth Alignment

All agents now understand:
- Event matching logic (by email, phone, external_id, time window ±7 days)
- Data reconciliation priorities (AnyTrack > HubSpot > Facebook)
- Attribution truth (AnyTrack has best attribution)
- PII truth (HubSpot has most complete PII)
- Conversion truth (HubSpot deal closed_won is source of truth)
- Confidence scoring (0-100 based on data completeness)

## ROI & Managerial Intelligence

All agents now calculate:
- LTV (Lifetime Value)
- CAC (Customer Acquisition Cost)
- Contribution Margin
- Payback Period
- Campaign-to-LTV Mapping
- Bleed Detection (high frontend, low backend)
- Scale Signals (high LTV, low CAC, high conversion)

## HubSpot Workflow Intelligence

All agents now understand:
- 201 total workflows (52 active, 149 inactive)
- Critical issues (infinite loop, inactive nurture sequences)
- Revenue impact (634,070+ AED/month lost)
- Workflow alignment with AI recommendations
- Proactive workflow suggestions

## Next Steps

1. **Deploy Edge Functions**
   ```bash
   supabase functions deploy ptd-agent-claude
   supabase functions deploy ptd-agent-gemini
   supabase functions deploy ptd-ultimate-intelligence
   ```

2. **Test Unified Prompts**
   - Test lead lifecycle queries
   - Test data alignment queries
   - Test ROI calculations
   - Test workflow intelligence

3. **Monitor Agent Consistency**
   - Run `agent-alignment-check` to verify consistency
   - Monitor for any alignment issues
   - Update prompts as needed

## Success Metrics

- ✅ All main agents updated (Claude, Gemini, Ultimate Intelligence)
- ✅ Unified data schema implemented (`contacts` table)
- ✅ Lead lifecycle knowledge integrated
- ✅ Ultimate truth alignment rules integrated
- ✅ ROI & managerial intelligence integrated
- ✅ HubSpot workflow intelligence integrated
- ✅ Agent alignment rules enforced

## Notes

- The unified prompts are modular - agents can include/exclude components as needed
- Edge Functions use Deno runtime, so prompts are copied to `_shared` directory (can't import from `src/lib`)
- All agents maintain their unique personalities while using unified knowledge base
- The `ptd-ultimate-intelligence` agent uses persona-based prompts with unified components added
