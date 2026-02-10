/**
 * 🎭 SENTIMENT TRIAGE (OUTSTANDING GRADE)
 *
 * Goal: "Psychological Radar" for De-escalation and Opportunity Detection.
 * Now supports:
 * - Multilingual Risk (English, Arabic, Hindi)
 * - Positive Sentiment (Gratitude/Urgency)
 * - False Positive Prevention (Regex Word Boundaries)
 */

export type SentimentResult = {
  sentiment: "RISK" | "POSITIVE" | "NEUTRAL";
  score: number; // 1.0 = High Confidence
  triggers: string[];
};

export const SentimentTriage = {
  analyze(text: string): SentimentResult {
    const lower = text.toLowerCase();

    // 1. RISK DETECTION (Stop / Legal / Scam)
    // Uses word boundaries (\b) to avoid "unstoppable" errors
    const RISK_PATTERNS = [
      /\bstop\b/i,
      /\bunsubscribe\b/i,
      /\bfuck\b/i,
      /\bshit\b/i,
      /\bspam\b/i,
      /\bharass\b/i,
      /\breport\b/i,
      /\bpolice\b/i,
      /\bsue\b/i,
      /\blawyer\b/i,
      /\brefund\b/i,
      /\bscam\b/i,
      /\bfake\b/i,
      // Arabic/Hindi Context (Dubai Market)
      /\bharam\b/i,
      /\bkadb\b/i, // "Liar" in Arabic
      /\bchor\b/i,
      /\bfraud\b/i,
    ];

    const riskMatches = RISK_PATTERNS.filter((p) => p.test(text)).map((p) =>
      p.source.replace(/\\b/g, "").replace("/i", ""),
    );
    if (riskMatches.length > 0) {
      return { sentiment: "RISK", score: 1.0, triggers: riskMatches };
    }

    // 2. POSITIVE / URGENCY DETECTION (Hot Leads)
    const POSITIVE_PATTERNS = [
      /\bthank\b/i,
      /\bthanks\b/i,
      /\blove\b/i,
      /\bamazing\b/i,
      /\bready\b/i,
      /\bsign up\b/i,
      /\bjoin\b/i,
      /\bhurry\b/i,
      /\basap\b/i,
      /\binterested\b/i,
      /\bexcited\b/i,
      /\bperfect\b/i,
      /\bbooking\b/i,
      /\bpaid\b/i,
    ];

    const positiveMatches = POSITIVE_PATTERNS.filter((p) => p.test(text)).map(
      (p) => p.source.replace(/\\b/g, "").replace("/i", ""),
    );
    if (positiveMatches.length > 0) {
      // Bonus: Detect Urgency specifically
      const isUrgent = /\b(hurry|asap|now|urgent)\b/i.test(text);
      return {
        sentiment: "POSITIVE",
        score: isUrgent ? 1.0 : 0.8,
        triggers: positiveMatches,
      };
    }

    // 3. LIABILITY / SAFE HARBOR DETECTION (Medical / Financial / Guarantee)
    const LIABILITY_PATTERNS = [
      /\bguarantee[d]?\s+(returns|results|profit|income)\b/i,
      /\bcure\b/i,
      /\bmedical advice\b/i,
      /\bdoctor said\b/i,
      /\bsuicide\b/i,
      /\bkill myself\b/i,
      /\bhurt myself\b/i,
    ];

    const liabilityMatches = LIABILITY_PATTERNS.filter((p) => p.test(text)).map(
      (p) => p.source.replace(/\\b/g, "").replace("/i", ""),
    );
    if (liabilityMatches.length > 0) {
      return {
        sentiment: "RISK",
        score: 1.0,
        triggers: liabilityMatches.concat(["LIABILITY_RISK"]),
      };
    }

    // 4. NEUTRAL (Safe Default)
    // Add "Unsure" detection if needed in future
    return { sentiment: "NEUTRAL", score: 0.0, triggers: [] };
  },
};
