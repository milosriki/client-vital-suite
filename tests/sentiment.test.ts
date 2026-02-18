import { SentimentTriage, SentimentResult } from "../supabase/functions/_shared/sentiment";

describe("Sentiment Triage", () => {
  // ── RISK Detection ────────────────────────────────────────────────

  test("detects RISK for profanity with max score", () => {
    const result: SentimentResult = SentimentTriage.analyze("fuck this spam");
    expect(result.sentiment).toBe("RISK");
    expect(result.score).toBe(1.0);
    expect(result.triggers).toEqual(expect.arrayContaining(["fuck", "spam"]));
  });

  test("detects RISK for legal threats and includes trigger word", () => {
    const result: SentimentResult = SentimentTriage.analyze("I will sue you");
    expect(result.sentiment).toBe("RISK");
    expect(result.triggers).toEqual(expect.arrayContaining(["sue"]));
  });

  test("detects RISK for multilingual keywords (Arabic/Hindi)", () => {
    const result: SentimentResult = SentimentTriage.analyze("this is haram");
    expect(result.sentiment).toBe("RISK");
    expect(result.triggers).toEqual(expect.arrayContaining(["haram"]));
  });

  // ── POSITIVE Detection ────────────────────────────────────────────

  test("detects POSITIVE for gratitude expressions", () => {
    const result: SentimentResult = SentimentTriage.analyze("thank you so much!");
    expect(result.sentiment).toBe("POSITIVE");
    expect(result.triggers).toEqual(expect.arrayContaining(["thank"]));
  });

  test("detects POSITIVE with urgency bonus (score 1.0)", () => {
    const result: SentimentResult = SentimentTriage.analyze("I need this asap");
    expect(result.sentiment).toBe("POSITIVE");
    expect(result.score).toBe(1.0);
    expect(result.triggers).toEqual(expect.arrayContaining(["asap"]));
  });

  test("detects POSITIVE without urgency at standard score (0.8)", () => {
    const result: SentimentResult = SentimentTriage.analyze("I'm interested");
    expect(result.sentiment).toBe("POSITIVE");
    expect(result.score).toBe(0.8);
    expect(result.triggers).toEqual(expect.arrayContaining(["interested"]));
  });

  // ── Word Boundary & Edge Cases ────────────────────────────────────

  test("known false positive: 'stop by' triggers RISK because \\bstop\\b matches", () => {
    // KNOWN LIMITATION: The regex \bstop\b matches the word "stop" even
    // in the innocent phrase "stop by tomorrow". This is a documented
    // false positive that would require NLP-level context to avoid.
    const result: SentimentResult = SentimentTriage.analyze("I'll stop by tomorrow");
    expect(result.sentiment).toBe("RISK");
    expect(result.triggers).toEqual(expect.arrayContaining(["stop"]));
  });

  test("word boundary prevents matching 'stop' inside 'unstoppable'", () => {
    const result: SentimentResult = SentimentTriage.analyze("unstoppable energy");
    expect(result.sentiment).not.toBe("RISK");
    // With no positive or risk matches, this falls through to NEUTRAL
    expect(result.sentiment).toBe("NEUTRAL");
    expect(result.triggers).toEqual([]);
  });
});
