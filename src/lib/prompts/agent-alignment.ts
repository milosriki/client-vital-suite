// Agent Alignment Prompt Component
// Ensures all agents use unified data schema and consistent mappings

import { EXPECTED_ALIGNMENT } from '../agent-alignment-check';

export const AGENT_ALIGNMENT_PROMPT = `
=== AGENT ALIGNMENT RULES (MANDATORY) ===

ALL AGENTS MUST USE UNIFIED DATA SCHEMA:

1. STAGE MAPPINGS (Use these exact mappings):
${Object.entries(EXPECTED_ALIGNMENT.stage_mappings).map(([id, name]) => `   - ${id} = ${name}`).join('\n')}

2. LIFECYCLE STAGES (Use these exact names):
${Object.entries(EXPECTED_ALIGNMENT.lifecycle_stages).map(([stage, name]) => `   - ${stage} = ${name}`).join('\n')}

3. DATA SOURCES (Use these table names):
   - Contacts: ${EXPECTED_ALIGNMENT.data_sources.contacts}
   - Deals: ${EXPECTED_ALIGNMENT.data_sources.deals}
   - Calls: ${EXPECTED_ALIGNMENT.data_sources.calls}
   - Attribution: ${EXPECTED_ALIGNMENT.data_sources.attribution}
   
   ❌ NEVER use: enhanced_leads, hubspot_contacts (use 'contacts' instead)

4. FIELD NAMES (Use these exact field names):
   - Email: ${EXPECTED_ALIGNMENT.field_names.EMAIL}
   - Lifecycle Stage: ${EXPECTED_ALIGNMENT.field_names.LIFECYCLE_STAGE}
   - Deal Stage: ${EXPECTED_ALIGNMENT.field_names.DEAL_STAGE}
   - Owner ID: ${EXPECTED_ALIGNMENT.field_names.OWNER_ID}
   - Attribution Source: ${EXPECTED_ALIGNMENT.field_names.ATTRIBUTION_SOURCE} (from attribution_events table)

5. ATTRIBUTION PRIORITY (${EXPECTED_ALIGNMENT.attribution_priority}):
   - ALWAYS use attribution_events.source (from AnyTrack) as primary attribution
   - Fallback to contacts.first_touch_source only if attribution_events missing
   - NEVER use contacts.latest_traffic_source for attribution (use AnyTrack)

CRITICAL RULES:
- ALWAYS query LIVE data from Supabase tables
- Use formatDealStage(stage_id) to convert IDs to names
- Use formatLifecycleStage(lifecycle) to convert lifecycle to names
- When stage IDs conflict, use unified schema mappings above
- When attribution conflicts, prefer AnyTrack > HubSpot > Facebook
- When PII conflicts, prefer HubSpot > AnyTrack > Facebook
- When conversion conflicts, HubSpot deal closed_won is source of truth

ALIGNMENT CHECK:
- All agents should produce consistent results for same query
- Stage mappings must match unified schema
- Data sources must use correct table names
- Attribution must follow priority rules
`;
