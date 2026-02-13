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
  BOOKED: "122237508",
  HELD: "122237276",
  ASSESSMENT_DONE: "122221229",
  PAYMENT_PENDING: "2900542",
  PAYMENT_RECEIVED: "987633705",
} as const;

/** All active pipeline stages (for filtering deals in progress) */
export const ACTIVE_PIPELINE_STAGES = [
  HUBSPOT_STAGE_IDS.BOOKED,
  HUBSPOT_STAGE_IDS.HELD,
  HUBSPOT_STAGE_IDS.ASSESSMENT_DONE,
  DEAL_STAGES.QUALIFIED_TO_BUY,
  DEAL_STAGES.DECISION_MAKER_BOUGHT_IN,
  HUBSPOT_STAGE_IDS.PAYMENT_PENDING,
  HUBSPOT_STAGE_IDS.PAYMENT_RECEIVED,
  DEAL_STAGES.CLOSED_WON,
] as const;

/** Human-readable stage labels */
export const STAGE_LABELS: Record<string, string> = {
  [HUBSPOT_STAGE_IDS.BOOKED]: "Booked",
  [HUBSPOT_STAGE_IDS.HELD]: "Held",
  [HUBSPOT_STAGE_IDS.ASSESSMENT_DONE]: "Assessment Done",
  [DEAL_STAGES.QUALIFIED_TO_BUY]: "Qualified to Buy",
  [DEAL_STAGES.DECISION_MAKER_BOUGHT_IN]: "Decision Maker Bought In",
  [HUBSPOT_STAGE_IDS.PAYMENT_PENDING]: "Payment Pending",
  [HUBSPOT_STAGE_IDS.PAYMENT_RECEIVED]: "Payment Received",
  [DEAL_STAGES.CONTRACT_SENT]: "Contract Sent",
  [DEAL_STAGES.CLOSED_WON]: "Closed Won",
  [DEAL_STAGES.CLOSED_LOST]: "Closed Lost",
};

/** Stage ordering for funnel progression (higher = further along) */
export const STAGE_ORDER: Record<string, number> = {
  [HUBSPOT_STAGE_IDS.BOOKED]: 4,
  [HUBSPOT_STAGE_IDS.HELD]: 5,
  [HUBSPOT_STAGE_IDS.ASSESSMENT_DONE]: 6,
  [DEAL_STAGES.QUALIFIED_TO_BUY]: 8,
  [DEAL_STAGES.DECISION_MAKER_BOUGHT_IN]: 9,
  [HUBSPOT_STAGE_IDS.PAYMENT_PENDING]: 10,
  [HUBSPOT_STAGE_IDS.PAYMENT_RECEIVED]: 11,
  [DEAL_STAGES.CLOSED_WON]: 12,
  [DEAL_STAGES.CLOSED_LOST]: 13,
};

export type DealStage = (typeof DEAL_STAGES)[keyof typeof DEAL_STAGES];
