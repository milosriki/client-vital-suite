/**
 * AI Safety & Bias Detection Framework
 * Enterprise AI safety per AI Engineer skill
 *
 * Provides:
 * - Bias detection in AI responses
 * - Safety classification
 * - Audit logging for AI interactions
 */

// Bias indicators to scan for in AI responses
const BIAS_PATTERNS: {
  pattern: RegExp;
  category: string;
  severity: "low" | "medium" | "high";
}[] = [
  // Gender bias
  {
    pattern: /\b(he|his|him)\b.*\b(boss|leader|strong|decisive)\b/i,
    category: "gender",
    severity: "medium",
  },
  {
    pattern: /\b(she|her)\b.*\b(emotional|sensitive|nurturing)\b/i,
    category: "gender",
    severity: "medium",
  },

  // Age bias
  {
    pattern: /\b(too old|too young|elderly|millennial|boomer)\b/i,
    category: "age",
    severity: "medium",
  },

  // Nationality/race bias
  {
    pattern: /\b(those people|their kind|typical of)\b/i,
    category: "discrimination",
    severity: "high",
  },

  // Fitness industry specific bias
  {
    pattern: /\b(lazy|undisciplined|no willpower|fat|skinny)\b/i,
    category: "body_shaming",
    severity: "high",
  },
  {
    pattern: /\b(real men|real women|man up|act like a)\b/i,
    category: "gender_roles",
    severity: "high",
  },

  // Financial bias
  {
    pattern: /\b(can't afford|cheap|poor|broke)\b/i,
    category: "economic",
    severity: "medium",
  },
];

// Safety categories
const SAFETY_KEYWORDS = {
  harmful: /\b(kill|die|suicide|self.harm|hurt yourself)\b/i,
  medical: /\b(diagnose|prescription|medication|dosage|medical advice)\b/i,
  legal: /\b(lawsuit|sue|legal advice|liability)\b/i,
  financial: /\b(guaranteed returns|get rich|financial advice|invest)\b/i,
};

export interface BiasCheckResult {
  hasBias: boolean;
  flags: {
    category: string;
    severity: "low" | "medium" | "high";
    match: string;
  }[];
  safetyFlags: string[];
  score: number; // 0-100, where 100 is fully safe
  recommendation: "pass" | "review" | "block";
}

/**
 * Check AI response for bias and safety issues
 */
export function checkBias(text: string): BiasCheckResult {
  const flags: BiasCheckResult["flags"] = [];
  const safetyFlags: string[] = [];

  // Check bias patterns
  for (const { pattern, category, severity } of BIAS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      flags.push({ category, severity, match: match[0] });
    }
  }

  // Check safety keywords
  for (const [category, pattern] of Object.entries(SAFETY_KEYWORDS)) {
    if (pattern.test(text)) {
      safetyFlags.push(category);
    }
  }

  // Calculate safety score
  const highCount = flags.filter((f) => f.severity === "high").length;
  const mediumCount = flags.filter((f) => f.severity === "medium").length;
  const lowCount = flags.filter((f) => f.severity === "low").length;

  let score = 100;
  score -= highCount * 30;
  score -= mediumCount * 15;
  score -= lowCount * 5;
  score -= safetyFlags.length * 25;
  score = Math.max(0, Math.min(100, score));

  const recommendation: BiasCheckResult["recommendation"] =
    score >= 80 ? "pass" : score >= 50 ? "review" : "block";

  return {
    hasBias: flags.length > 0,
    flags,
    safetyFlags,
    score,
    recommendation,
  };
}

/**
 * Log AI interaction for audit trail
 */
export async function logAIInteraction(
  supabase: {
    from: (table: string) => {
      insert: (data: Record<string, unknown>) => Promise<unknown>;
    };
  },
  interaction: {
    functionName: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    biasCheck?: BiasCheckResult;
    latencyMs?: number;
    contactId?: string;
  },
): Promise<void> {
  try {
    await supabase.from("ai_audit_log").insert({
      function_name: interaction.functionName,
      model: interaction.model,
      input_tokens: interaction.inputTokens,
      output_tokens: interaction.outputTokens,
      bias_score: interaction.biasCheck?.score,
      bias_flags: interaction.biasCheck?.flags,
      safety_flags: interaction.biasCheck?.safetyFlags,
      recommendation: interaction.biasCheck?.recommendation,
      latency_ms: interaction.latencyMs,
      contact_id: interaction.contactId,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("[AI Safety] Failed to log interaction:", error);
  }
}

/**
 * Middleware: Check and optionally block biased responses
 */
export function withBiasCheck(
  response: string,
  functionName: string,
): { text: string; blocked: boolean; check: BiasCheckResult } {
  const check = checkBias(response);

  if (check.recommendation === "block") {
    console.warn(
      `🚫 [AI Safety] Response BLOCKED in ${functionName}:`,
      check.flags,
    );
    return {
      text: "I'd like to rephrase that. Let me provide a more helpful response.",
      blocked: true,
      check,
    };
  }

  if (check.recommendation === "review") {
    console.warn(
      `⚠️ [AI Safety] Response flagged for REVIEW in ${functionName}:`,
      check.flags,
    );
  }

  return { text: response, blocked: false, check };
}
