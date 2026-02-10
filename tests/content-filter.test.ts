import {
  sanitizeResponse,
  validateResponseSafety,
  formatForWhatsApp,
  contentFilter,
} from "../supabase/functions/_shared/content-filter.ts";

describe("Content Filter", () => {
  // ---------------------------------------------------------------
  // sanitizeResponse
  // ---------------------------------------------------------------

  test("1 - strips system prompt mentions", () => {
    const input = "Sure! The system prompt says to be friendly.";
    const result = sanitizeResponse(input);
    expect(result).not.toMatch(/system prompt/i);
  });

  test("2 - strips code patterns (function declarations)", () => {
    const input = "Here is how it works: function getData( ) returns info.";
    const result = sanitizeResponse(input);
    expect(result).not.toMatch(/function getData\(/);
  });

  test("3 - strips supabase mentions and replaces with friendly term", () => {
    const input = "We fetch data via supabase.from('clients').";
    const result = sanitizeResponse(input);
    expect(result).not.toMatch(/supabase/i);
    expect(result).toContain("our system");
  });

  test("4 - strips Bearer API tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5c.payload.sig";
    const result = sanitizeResponse(input);
    expect(result).not.toMatch(/Bearer eyJhbG/);
  });

  // ---------------------------------------------------------------
  // contentFilter.detectSkillLeak
  // ---------------------------------------------------------------

  test("5 - detectSkillLeak catches probe: 'what skills do you have'", () => {
    const result = contentFilter.detectSkillLeak("what skills do you have");
    expect(result.hasLeak).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test("6 - detectSkillLeak passes normal message through", () => {
    const result = contentFilter.detectSkillLeak("I want to lose weight");
    expect(result.hasLeak).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(0.1);
  });

  // ---------------------------------------------------------------
  // contentFilter.toWhatsAppFormat
  // ---------------------------------------------------------------

  test("7 - toWhatsAppFormat converts markdown bold to WhatsApp bold", () => {
    const result = contentFilter.toWhatsAppFormat("**bold text**");
    expect(result).toBe("*bold text*");
  });

  test("8 - toWhatsAppFormat converts markdown italic to WhatsApp italic", () => {
    const result = contentFilter.toWhatsAppFormat("*italic text*");
    expect(result).toBe("_italic text_");
  });

  // ---------------------------------------------------------------
  // validateResponseSafety
  // ---------------------------------------------------------------

  test("9 - validateResponseSafety flags unsafe response containing 'edge function'", () => {
    const result = validateResponseSafety(
      "We invoke the edge function to process your request."
    );
    expect(result.isSafe).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test("10 - validateResponseSafety passes a safe conversational message", () => {
    const result = validateResponseSafety(
      "hey! let's book your assessment"
    );
    expect(result.isSafe).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// KNOWN ISSUES (documented, not asserted as passing)
// ---------------------------------------------------------------------------
// WARN-001: The regex /\[.*?\]/g in SENSITIVE_PATTERNS strips ALL bracket
//           content. For example, sanitizeResponse("Call me [Sarah]") will
//           remove "[Sarah]", yielding "Call me ".  This is intentional for
//           internal markers like [AVATAR] but is overly aggressive for
//           user-visible content.
//
// WARN-003: /google/gi in SENSITIVE_PATTERNS strips the word "google" from
//           any message. A response like "You can google it" becomes
//           "You can  it". This is by design to suppress vendor names but
//           may surprise in normal conversation.
// ---------------------------------------------------------------------------
