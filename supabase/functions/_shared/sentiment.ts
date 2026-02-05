/**
 * SENTIMENT TRIAGE
 *
 * Goal: Detect "Risk" words that require immediate De-escalation.
 * This is a keyword-based "Triage" before sending to full LLM.
 */

export const SentimentTriage = {
  analyze(text: string): "POSITIVE" | "NEUTRAL" | "RISK" {
    const lower = text.toLowerCase();

    const RISK_TRIGGERS = [
      "stop",
      "unsubscribe",
      "fuck",
      "shit",
      "spam",
      "harass",
      "annoying",
      "report",
      "police",
      "sue",
      "lawyer",
      "refund",
      "scam",
      "fake",
    ];

    if (RISK_TRIGGERS.some((t) => lower.includes(t))) {
      return "RISK";
    }

    return "NEUTRAL"; // Default to Neutral (safe)
  },
};
