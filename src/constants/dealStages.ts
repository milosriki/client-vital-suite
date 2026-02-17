/**
 * Centralized HubSpot Deal Stage IDs and Labels
 * Source of truth for all frontend deal stage references.
 *
 * HubSpot uses both numeric pipeline IDs and string stage identifiers.
 * These map to the PTD Group sales pipeline.
 */

export const DEAL_STAGES = {
  // String-based stage identifiers (HubSpot deal pipeline)
  APPOINTMENT_SCHEDULED: "appointmentscheduled",
  QUALIFIED_TO_BUY: "qualifiedtobuy",
  DECISION_MAKER_BOUGHT_IN: "decisionmakerboughtin",
  CONTRACT_SENT: "contractsent",
  CLOSED_WON: "closedwon",
  CLOSED_LOST: "closedlost",
} as const;

/** Numeric HubSpot pipeline stage IDs (internal HubSpot identifiers) */
export const HUBSPOT_STAGE_IDS = {
  ASSESSMENT_BOOKING: "122178070",
  BOOKED: "122237508",
  ASSESSMENT_POSTPONED: "122221229",
  CANCELED_FOLLOWUP: "122237276",
  ASSESSMENT_DONE: "2900542",
  REBOOK: "987633705",
  // Booking Pipeline
  NEW_LEAD: "966318637",
  REACHED_BOOKED: "966318643",
  // AI Agent Pipeline
  AI_MESSAGING: "1064059183",
  AI_BOOKING_PROCESS: "1073372017",
  AI_BOOKED: "1064059185",
} as const;

/** All active pipeline stages (for filtering deals in progress) */
export const ACTIVE_PIPELINE_STAGES = [
  HUBSPOT_STAGE_IDS.ASSESSMENT_BOOKING,
  HUBSPOT_STAGE_IDS.BOOKED,
  HUBSPOT_STAGE_IDS.ASSESSMENT_POSTPONED,
  HUBSPOT_STAGE_IDS.ASSESSMENT_DONE,
  HUBSPOT_STAGE_IDS.REBOOK,
  HUBSPOT_STAGE_IDS.REACHED_BOOKED,
  HUBSPOT_STAGE_IDS.AI_MESSAGING,
  HUBSPOT_STAGE_IDS.AI_BOOKING_PROCESS,
  HUBSPOT_STAGE_IDS.AI_BOOKED,
  DEAL_STAGES.QUALIFIED_TO_BUY,
  DEAL_STAGES.DECISION_MAKER_BOUGHT_IN,
  DEAL_STAGES.CONTRACT_SENT,
  DEAL_STAGES.CLOSED_WON,
] as const;

/** Human-readable stage labels */
export const STAGE_LABELS: Record<string, string> = {
  [DEAL_STAGES.QUALIFIED_TO_BUY]: "Assessment Scheduled",
  [DEAL_STAGES.DECISION_MAKER_BOUGHT_IN]: "Called - Follow up",
  [DEAL_STAGES.CONTRACT_SENT]: "Assessment done - waiting decision",
  [DEAL_STAGES.CLOSED_WON]: "Closed Won",
  [DEAL_STAGES.CLOSED_LOST]: "Closed Lost",
  [HUBSPOT_STAGE_IDS.ASSESSMENT_BOOKING]: "Assessment booking process",
  [HUBSPOT_STAGE_IDS.BOOKED]: "Assessment Confirmed",
  [HUBSPOT_STAGE_IDS.ASSESSMENT_POSTPONED]: "Assessment postponed",
  [HUBSPOT_STAGE_IDS.CANCELED_FOLLOWUP]: "Canceled - Follow up",
  [HUBSPOT_STAGE_IDS.ASSESSMENT_DONE]: "Assessment Done - Follow up",
  [HUBSPOT_STAGE_IDS.REBOOK]: "Rebook",
  [HUBSPOT_STAGE_IDS.NEW_LEAD]: "New Lead",
  [HUBSPOT_STAGE_IDS.REACHED_BOOKED]: "Reached - Booked",
  [HUBSPOT_STAGE_IDS.AI_MESSAGING]: "Messaging",
  [HUBSPOT_STAGE_IDS.AI_BOOKING_PROCESS]: "Booking Process",
  [HUBSPOT_STAGE_IDS.AI_BOOKED]: "Booked",
};

/** Stage ordering for funnel progression (higher = further along) */
export const STAGE_ORDER: Record<string, number> = {
  [HUBSPOT_STAGE_IDS.NEW_LEAD]: 1,
  [HUBSPOT_STAGE_IDS.AI_MESSAGING]: 2,
  [DEAL_STAGES.DECISION_MAKER_BOUGHT_IN]: 3,
  [HUBSPOT_STAGE_IDS.ASSESSMENT_BOOKING]: 4,
  [HUBSPOT_STAGE_IDS.BOOKED]: 5,
  [DEAL_STAGES.QUALIFIED_TO_BUY]: 6,
  [HUBSPOT_STAGE_IDS.ASSESSMENT_POSTPONED]: 7,
  [HUBSPOT_STAGE_IDS.REBOOK]: 7,
  [HUBSPOT_STAGE_IDS.ASSESSMENT_DONE]: 8,
  [DEAL_STAGES.CONTRACT_SENT]: 9,
  [DEAL_STAGES.CLOSED_WON]: 10,
  [DEAL_STAGES.CLOSED_LOST]: 11,
};

export type DealStage = (typeof DEAL_STAGES)[keyof typeof DEAL_STAGES];
