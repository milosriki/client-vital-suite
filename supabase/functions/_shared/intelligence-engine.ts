/**
 * INTELLIGENCE ENGINE
 *
 * Lead scoring, sentiment detection, and engagement analysis.
 * Zero-cost: Pure logic, no external API calls.
 */

// ============================================================================
// LEAD SCORING
// ============================================================================

interface LeadScoringParams {
  intent: string;
  messageLength: number;
  messageCount: number;
  hasSharedGoal: boolean;
  hasSharedPain: boolean;
  hasAskedPrice: boolean;
}

const INTENT_SCORES: Record<string, number> = {
  "Booking.Request": 30,
  "Booking.Availability": 25,
  "Lead.Goal": 20,
  "Lead.Pain": 15,
  "Lead.Location": 10,
  "Lead.Name": 5,
  "Pricing.Query": 10,
  "Confirmation.Yes": 40,
  "Objection.Time": -5,
  "Objection.Think": -10,
  "Confirmation.No": -15,
  "Default Welcome Intent": 0,
  "Default Fallback Intent": 0,
};

export function calculateLeadScore(params: LeadScoringParams): number {
  let score = 0;

  // Intent-based scoring
  score += INTENT_SCORES[params.intent] || 0;

  // Message engagement
  if (params.messageLength > 20) score += 5;
  if (params.messageLength > 50) score += 10;

  // Conversation depth
  if (params.messageCount > 3) score += 10;
  if (params.messageCount > 6) score += 15;

  // Key milestones
  if (params.hasSharedGoal) score += 20;
  if (params.hasSharedPain) score += 10;
  if (params.hasAskedPrice) score += 15;

  return Math.min(100, Math.max(0, score));
}

// ============================================================================
// SENTIMENT DETECTION
// ============================================================================

const POSITIVE_WORDS = [
  "great",
  "excited",
  "ready",
  "yes",
  "perfect",
  "love",
  "awesome",
  "amazing",
  "interested",
  "definitely",
  "sure",
  "okay",
  "thanks",
  "helpful",
  "good",
];

const NEGATIVE_WORDS = [
  "busy",
  "expensive",
  "no",
  "maybe",
  "later",
  "think",
  "worried",
  "scared",
  "unsure",
  "can't",
  "won't",
  "difficult",
  "hard",
  "problem",
  "issue",
];

export function detectSentiment(message: string): number {
  const words = message.toLowerCase().split(/\s+/);
  let score = 0;

  words.forEach((word) => {
    if (POSITIVE_WORDS.includes(word)) score += 0.2;
    if (NEGATIVE_WORDS.includes(word)) score -= 0.2;
  });

  // Emoji detection
  if (/[\u{1F60A}\u{1F642}\u{1F44D}\u{1F4AA}\u{2705}\u{1F389}]/u.test(message))
    score += 0.3;
  if (/[\u{1F615}\u{1F622}\u{1F620}\u{274C}]/u.test(message)) score -= 0.3;

  return Math.max(-1, Math.min(1, score));
}

// ============================================================================
// ENGAGEMENT LEVEL
// ============================================================================

export type EngagementLevel = "cold" | "warm" | "hot";

export function determineEngagement(
  score: number,
  sentiment: number,
): EngagementLevel {
  if (score >= 70 && sentiment >= 0) return "hot";
  if (score >= 40 || sentiment >= -0.3) return "warm";
  return "cold";
}

// ============================================================================
// CONVERSATION STAGE
// ============================================================================

const STAGE_MAP: Record<string, string> = {
  "Default Welcome Intent": "discovery",
  "Lead.Goal": "discovery",
  "Lead.Pain": "qualification",
  "Lead.Location": "qualification",
  "Lead.Name": "qualification",
  "Booking.Request": "booking",
  "Booking.Availability": "booking",
  "Pricing.Query": "qualification",
  "Confirmation.Yes": "confirmation",
  "Confirmation.No": "qualification",
  "Objection.Time": "objection_handling",
  "Objection.Think": "objection_handling",
};

export function determineStage(intent: string): string {
  return STAGE_MAP[intent] || "discovery";
}

// ============================================================================
// AVATAR DETECTION (from message content)
// ============================================================================

const AVATAR_KEYWORDS: Record<string, string[]> = {
  mom: ["kids", "child", "baby", "postpartum", "mom", "mother", "pregnancy"],
  male40: ["career", "busy", "work", "energy", "belly", "executive", "office"],
  male50: ["joint", "pain", "older", "longevity", "health", "injury", "safe"],
  female40: ["hormone", "menopause", "metabolism", "slow", "40"],
  female50: ["bone", "osteoporosis", "safe", "gentle", "50"],
};

export function detectAvatar(message: string, existingGoal?: string): string {
  const combined = `${message} ${existingGoal || ""}`.toLowerCase();

  for (const [avatar, keywords] of Object.entries(AVATAR_KEYWORDS)) {
    if (keywords.some((keyword) => combined.includes(keyword))) {
      return avatar;
    }
  }

  return "";
}

// ============================================================================
// COMBINED INTELLIGENCE ANALYSIS
// ============================================================================

export interface IntelligenceResult {
  leadScore: number;
  sentiment: number;
  engagementLevel: EngagementLevel;
  conversationStage: string;
  detectedAvatar: string;
}

export function analyzeIntelligence(params: {
  intent: string;
  message: string;
  history: Array<{ intent: string }>;
  existingGoal?: string;
}): IntelligenceResult {
  const hasSharedGoal = params.history.some((h) => h.intent === "Lead.Goal");
  const hasSharedPain = params.history.some((h) => h.intent === "Lead.Pain");
  const hasAskedPrice = params.history.some(
    (h) => h.intent === "Pricing.Query",
  );

  const leadScore = calculateLeadScore({
    intent: params.intent,
    messageLength: params.message.length,
    messageCount: params.history.length,
    hasSharedGoal,
    hasSharedPain,
    hasAskedPrice,
  });

  const sentiment = detectSentiment(params.message);
  const engagementLevel = determineEngagement(leadScore, sentiment);
  const conversationStage = determineStage(params.intent);
  const detectedAvatar = detectAvatar(params.message, params.existingGoal);

  return {
    leadScore,
    sentiment,
    engagementLevel,
    conversationStage,
    detectedAvatar,
  };
}
