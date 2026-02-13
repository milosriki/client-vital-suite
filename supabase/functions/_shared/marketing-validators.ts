/**
 * Marketing Validators — Shared validation for marketing agent outputs.
 *
 * Used by: marketing-scout, marketing-analyst, marketing-predictor,
 *          marketing-copywriter, marketing-loss-analyst, marketing-allocator
 *
 * Pattern: Plain TypeScript validators (no Zod — Deno edge functions).
 * Each returns { valid: true, data } or { valid: false, errors: string[] }.
 */

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

// ── Signal Validator (marketing-scout) ──

export interface MarketingSignal {
  agent_name: string;
  signal_type: string;
  ad_id: string;
  severity: string;
  evidence: Record<string, unknown>;
  [key: string]: unknown;
}

export function validateMarketingSignal(
  obj: Record<string, unknown>,
): ValidationResult<MarketingSignal> {
  const errors: string[] = [];

  if (!obj.agent_name || typeof obj.agent_name !== "string") {
    errors.push("agent_name is required and must be a non-empty string");
  }
  if (!obj.signal_type || typeof obj.signal_type !== "string") {
    errors.push("signal_type is required and must be a non-empty string");
  }
  if (!obj.ad_id || typeof obj.ad_id !== "string") {
    errors.push("ad_id is required and must be a non-empty string");
  }
  if (
    !obj.severity ||
    typeof obj.severity !== "string" ||
    !["info", "warning", "critical", "opportunity"].includes(obj.severity)
  ) {
    errors.push(
      "severity must be one of: info, warning, critical, opportunity",
    );
  }
  if (!obj.evidence || typeof obj.evidence !== "object") {
    errors.push("evidence is required and must be an object");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: obj as unknown as MarketingSignal };
}

// ── Recommendation Validator (marketing-analyst) ──

const VALID_ACTIONS = ["SCALE", "PAUSE", "REFRESH", "KILL", "MONITOR", "HOLD", "WATCH"] as const;

export interface MarketingRecommendation {
  ad_id?: string;
  ad_name?: string;
  action: string;
  reasoning: string;
  [key: string]: unknown;
}

export function validateMarketingRecommendation(
  obj: Record<string, unknown>,
): ValidationResult<MarketingRecommendation> {
  const errors: string[] = [];

  if (!obj.ad_id && !obj.ad_name) {
    errors.push("at least one of ad_id or ad_name must be present");
  }
  if (
    !obj.action ||
    typeof obj.action !== "string" ||
    !VALID_ACTIONS.includes(obj.action as typeof VALID_ACTIONS[number])
  ) {
    errors.push(
      `action must be one of: ${VALID_ACTIONS.join(", ")}`,
    );
  }
  if (!obj.reasoning || typeof obj.reasoning !== "string") {
    errors.push("reasoning is required and must be a non-empty string");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: obj as unknown as MarketingRecommendation };
}

// ── Budget Proposal Validator (marketing-allocator) ──

export interface BudgetProposal {
  ad_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  proposed_daily_budget: number;
  action: string;
  [key: string]: unknown;
}

export function validateBudgetProposal(
  obj: Record<string, unknown>,
): ValidationResult<BudgetProposal> {
  const errors: string[] = [];

  if (!obj.ad_id && !obj.campaign_id && !obj.campaign_name) {
    errors.push(
      "at least one of ad_id, campaign_id, or campaign_name must be present",
    );
  }
  if (
    typeof obj.proposed_daily_budget !== "number" ||
    obj.proposed_daily_budget < 0
  ) {
    errors.push("proposed_daily_budget must be a non-negative number");
  }
  if (
    !obj.action ||
    typeof obj.action !== "string" ||
    !["increase", "decrease", "pause", "maintain"].includes(obj.action)
  ) {
    errors.push("action must be one of: increase, decrease, pause, maintain");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: obj as unknown as BudgetProposal };
}

// ── Loss Record Validator (marketing-loss-analyst) ──

export interface LossAnalysisRecord {
  contact_email: string;
  primary_loss_reason: string;
  confidence_pct: number;
  [key: string]: unknown;
}

export function validateLossRecord(
  obj: Record<string, unknown>,
): ValidationResult<LossAnalysisRecord> {
  const errors: string[] = [];

  if (!obj.contact_email || typeof obj.contact_email !== "string") {
    errors.push("contact_email is required and must be a non-empty string");
  }
  if (
    !obj.primary_loss_reason ||
    typeof obj.primary_loss_reason !== "string"
  ) {
    errors.push(
      "primary_loss_reason is required and must be a non-empty string",
    );
  }
  if (
    typeof obj.confidence_pct !== "number" ||
    obj.confidence_pct < 0 ||
    obj.confidence_pct > 100
  ) {
    errors.push("confidence_pct must be a number between 0 and 100");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: obj as unknown as LossAnalysisRecord };
}

// ── Fatigue Alert Validator (marketing-predictor) ──

export interface FatigueAlert {
  ad_id: string;
  alert_type: string;
  projected_roas_30d: number;
  [key: string]: unknown;
}

export function validateFatigueAlert(
  obj: Record<string, unknown>,
): ValidationResult<FatigueAlert> {
  const errors: string[] = [];

  if (!obj.ad_id || typeof obj.ad_id !== "string") {
    errors.push("ad_id is required and must be a non-empty string");
  }
  if (
    !obj.alert_type ||
    typeof obj.alert_type !== "string" ||
    !["fatigue", "opportunity", "trend_reversal"].includes(obj.alert_type)
  ) {
    errors.push(
      "alert_type must be one of: fatigue, opportunity, trend_reversal",
    );
  }
  if (typeof obj.projected_roas_30d !== "number") {
    errors.push("projected_roas_30d must be a number");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, data: obj as unknown as FatigueAlert };
}
