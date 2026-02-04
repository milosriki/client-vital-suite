/**
 * CONTENT FILTER
 *
 * Sanitizes AI responses to prevent leaking internal system information
 * to customers via WhatsApp or other channels.
 */

const SENSITIVE_PATTERNS = [
  // Skill activation markers
  /!!! ACTIVE SKILL ACTIVATED:.*!!!/gi,
  /ACTIVE SKILL ACTIVATED:.*/gi,
  /<internal_context>[\s\S]*?<\/internal_context>/gi,

  // Technical details
  /CAPABILITIES:.*/gi,
  /\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi,
  /internal_rules:.*/gi,
  /available_tools:.*/gi,

  // Function/code references
  /function\s+\w+\s*\(/gi,
  /const\s+\w+\s*=/gi,
  /supabase\./gi,
  /\.from\(['"].*?['"]\)/gi,

  // Database/system references
  /database/gi,
  /table:/gi,
  /query:/gi,
  /SELECT \* FROM/gi,

  // API keys and secrets
  /API[_\s]?KEY/gi,
  /SECRET/gi,
  /Bearer\s+[a-zA-Z0-9\-_.]+/g,

  // Edge function names
  /edge[\s-]?function/gi,
  /invoke\(/gi,

  // Deno/deployment references
  /deno\./gi,
  /Deno\.env/gi,
];

const REPLACEMENT_MAP: Record<string, string> = {
  supabase: "our system",
  database: "our records",
  function: "feature",
  API: "service",
};

export function sanitizeResponse(aiResponse: string): string {
  let cleaned = aiResponse;

  // Remove sensitive patterns
  SENSITIVE_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "");
  });

  // Replace technical terms with user-friendly language
  Object.entries(REPLACEMENT_MAP).forEach(([tech, friendly]) => {
    const regex = new RegExp(tech, "gi");
    cleaned = cleaned.replace(regex, friendly);
  });

  // Remove multiple consecutive line breaks
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

export function validateResponseSafety(response: string): {
  isSafe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for capability mentions
  if (/capabilities/i.test(response)) {
    issues.push("Response mentions 'capabilities'");
  }

  // Check for skill activation
  if (/skill.*activate/i.test(response)) {
    issues.push("Response mentions skill activation");
  }

  // Check for internal markers
  if (/<internal/i.test(response)) {
    issues.push("Response contains internal context markers");
  }

  // Check for code-like content
  if (/function|const|let|var\s+\w+\s*=/i.test(response)) {
    issues.push("Response contains code-like syntax");
  }

  // Check for technical jargon
  const technicalTerms = [
    "supabase",
    "edge function",
    "database query",
    "API key",
    "invoke",
  ];
  technicalTerms.forEach((term) => {
    if (new RegExp(term, "i").test(response)) {
      issues.push(`Response contains technical term: "${term}"`);
    }
  });

  return {
    isSafe: issues.length === 0,
    issues,
  };
}

export function formatForWhatsApp(message: string): string {
  // Ensure proper WhatsApp formatting
  let formatted = message;

  // Convert markdown bold to WhatsApp bold (if needed)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Keep line breaks reasonable (WhatsApp-friendly)
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  // Limit message length (WhatsApp has ~4096 char limit)
  if (formatted.length > 4000) {
    formatted =
      formatted.slice(0, 3950) + "\n\n...(message truncated for length)";
  }

  return formatted.trim();
}

// Export as object for easier testing (factory pattern)
export const contentFilter = {
  sanitize: (message: string): string => {
    let cleaned = message;
    // Remove internal patterns completely
    const patterns = [/AGENT_KNOWLEDGE_BASE/gi, /INTERNAL_TOOL/gi, /SKILL_/gi];
    patterns.forEach((p) => {
      cleaned = cleaned.replace(p, "");
    });
    // Enforce length limit strictly
    if (cleaned.length > 4096) {
      cleaned = cleaned.substring(0, 4093) + "...";
    }
    return cleaned.trim();
  },
  detectSkillLeak: (message: string) => {
    const leakPatterns = [
      /what (skills?|capabilities|functions?|tools?) (do you|can you)/i,
      /list your (skills?|capabilities|functions?)/i,
      /show me your (prompt|instructions|capabilities)/i,
      /what can you do/i,
      /tell me about your (functions?|abilities)/i,
    ];

    const hasMatch = leakPatterns.some((pattern) => pattern.test(message));
    return {
      hasLeak: hasMatch,
      confidence: hasMatch ? 0.9 : 0.1,
    };
  },
  toWhatsAppFormat: (text: string): string => {
    // Use unique placeholders to avoid regex interference
    let formatted = text;
    // Step 1: **bold** -> __BOLD__...__/BOLD__
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "__BOLD__$1__/BOLD__");
    // Step 2: *italic* -> _italic_
    formatted = formatted.replace(/\*([^*]+)\*/g, "_$1_");
    // Step 3: Restore bold with WhatsApp format
    formatted = formatted.replace(/__BOLD__(.+?)__\/BOLD__/g, "*$1*");
    if (formatted.length > 4000) {
      formatted = formatted.slice(0, 3950) + "\n\n...(truncated)";
    }
    return formatted.trim();
  },
};
