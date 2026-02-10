// ================================================================
// File: supabase/functions/_shared/lead-scorer.ts
// Rule-based lead scoring as fallback/validation
// ================================================================

export interface ScoringSignals {
  hasName: boolean;
  hasGoal: boolean;
  hasPain: boolean;
  hasArea: boolean;
  messageCount: number;
  askedAboutPrice: boolean;
  askedAboutSchedule: boolean;
  mentionedTimeframe: boolean;
  mentionedPastFailure: boolean;
  expressedUrgency: boolean;
  saidExpensive: boolean;
  saidThinkAboutIt: boolean;
  daysInactive: number;
}

export function calculateLeadScore(signals: ScoringSignals): number {
  let score = 10; // Base score for any inquiry

  // Positive signals
  if (signals.hasName) score += 5;
  if (signals.hasGoal) score += 10;
  if (signals.hasPain) score += 15;
  if (signals.hasArea) score += 5;
  if (signals.askedAboutPrice) score += 10;
  if (signals.askedAboutSchedule) score += 20;
  if (signals.mentionedTimeframe) score += 10;
  if (signals.mentionedPastFailure) score += 10;
  if (signals.expressedUrgency) score += 15;

  // Engagement depth
  if (signals.messageCount >= 3) score += 5;
  if (signals.messageCount >= 6) score += 5;
  if (signals.messageCount >= 10) score += 5;

  // Negative signals
  if (signals.saidExpensive) score -= 10;
  if (signals.saidThinkAboutIt) score -= 5;

  // Decay for inactivity
  if (signals.daysInactive >= 1) score -= 5;
  if (signals.daysInactive >= 3) score -= 10;
  if (signals.daysInactive >= 7) score -= 20;

  // Clamp between 0-100
  return Math.max(0, Math.min(100, score));
}
