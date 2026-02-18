/**
 * SINGLE SOURCE OF TRUTH: HubSpot Deal Stage Mappings
 * Pulled from HubSpot Pipelines API on 2026-02-18
 *
 * Mirror of supabase/functions/_shared/stage-mapping.ts for frontend use.
 */

export const SALES_PIPELINE_STAGES: Record<string, { label: string; order: number }> = {
  "decisionmakerboughtin": { label: "Called - Follow up", order: 0 },
  "qualifiedtobuy":        { label: "Assessment Scheduled", order: 1 },
  "122178070":             { label: "Assessment Booking Process", order: 2 },
  "122237508":             { label: "Assessment Confirmed", order: 3 },
  "122221229":             { label: "Assessment Postponed", order: 4 },
  "987633705":             { label: "Rebook", order: 5 },
  "122237276":             { label: "Canceled - Follow up", order: 6 },
  "2900542":               { label: "Assessment Done - Follow up", order: 7 },
  "contractsent":          { label: "Assessment Done - Waiting Decision", order: 8 },
  "closedwon":             { label: "Closed Won", order: 9 },
  "closedlost":            { label: "Closed Lost", order: 10 },
};

export const AI_AGENT_PIPELINE_STAGES: Record<string, { label: string; order: number }> = {
  "1064059179": { label: "Lead", order: 0 },
  "1064059180": { label: "Call", order: 1 },
  "1064059181": { label: "Not Connected", order: 2 },
  "1064059182": { label: "Call Later", order: 3 },
  "1064059183": { label: "Messaging", order: 4 },
  "1064059184": { label: "Qualified - Reach WhatsApp", order: 5 },
  "1073372017": { label: "Booking Process", order: 6 },
  "1064059185": { label: "Booked", order: 7 },
  "1063991961": { label: "Not Qualified", order: 8 },
};

export const BOOKING_PIPELINE_STAGES: Record<string, { label: string; order: number }> = {
  "966318637": { label: "New Lead", order: 0 },
  "966318638": { label: "Powerdialer", order: 1 },
  "966318639": { label: "Call Back", order: 2 },
  "966318640": { label: "Reached - Not Booked MQ", order: 3 },
  "966318641": { label: "Reached - Not Booked Not MQ", order: 4 },
  "966318643": { label: "Reached - Booked", order: 5 },
  "966318642": { label: "Spam / Technical Error", order: 6 },
};

export const PIPELINE_NAMES: Record<string, string> = {
  "default":     "Sales Pipeline",
  "94205364":    "Test",
  "657631654":   "Booking Pipeline",
  "729570995":   "AI Agent",
  "734041388":   "Confirmation Pipeline",
  "734041391":   "SM Sales Pipeline",
};

// Unified map across all pipelines
const ALL_STAGES: Record<string, string> = {};
for (const [id, s] of Object.entries(SALES_PIPELINE_STAGES)) ALL_STAGES[id] = s.label;
for (const [id, s] of Object.entries(AI_AGENT_PIPELINE_STAGES)) ALL_STAGES[id] = s.label;
for (const [id, s] of Object.entries(BOOKING_PIPELINE_STAGES)) ALL_STAGES[id] = s.label;

export function formatDealStage(stageId: string | null | undefined): string {
  if (!stageId) return "Unknown";
  return ALL_STAGES[stageId] || stageId;
}

export function formatPipelineName(pipelineId: string | null | undefined): string {
  if (!pipelineId) return "Unknown Pipeline";
  return PIPELINE_NAMES[pipelineId] || pipelineId;
}

/** Real PTD sales funnel stages in order */
export const SALES_FUNNEL_STAGES = [
  { id: "decisionmakerboughtin", label: "Called - Follow up", order: 0 },
  { id: "qualifiedtobuy",        label: "Assessment Scheduled", order: 1 },
  { id: "122178070",             label: "Booking Process", order: 2 },
  { id: "122237508",             label: "Assessment Confirmed", order: 3 },
  { id: "2900542",               label: "Assessment Done", order: 7 },
  { id: "contractsent",          label: "Waiting Decision", order: 8 },
  { id: "closedwon",             label: "Closed Won", order: 9 },
] as const;

export const WON_STAGES = ["closedwon", "1070353735"];
export const LOST_STAGES = ["closedlost", "1063991961", "1070354491"];

export function isWonDeal(stage: string | null | undefined): boolean {
  return !!stage && WON_STAGES.includes(stage);
}

export function isLostDeal(stage: string | null | undefined): boolean {
  return !!stage && LOST_STAGES.includes(stage);
}
