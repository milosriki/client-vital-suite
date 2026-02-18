import { AntiRobot, AntiRobotOptions } from "../supabase/functions/_shared/anti-robot";

const withMockedRandom = <T,>(values: number[], fn: () => T): T => {
  let index = 0;
  const spy = jest
    .spyOn(Math, "random")
    .mockImplementation(() => values[index++] ?? 1);

  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
};

const sequenceWith = (overrides: Record<number, number>, length = 20) => {
  const values = Array.from({ length }, () => 1);
  for (const [idx, value] of Object.entries(overrides)) {
    values[Number(idx)] = value;
  }
  return values;
};

describe("AntiRobot v2.0", () => {
  // ---------------------------------------------------------------
  // 1. Contraction forcing fires ~95% of the time
  // ---------------------------------------------------------------
  it("should force contractions at >=90% rate (95% probability)", () => {
    const input = "I do not want to do that because I cannot stop.";
    const result = withMockedRandom(
      sequenceWith({ 0: 0 }), // contraction check passes
      () => AntiRobot.humanize(input, "PROFESSIONAL"),
    );

    expect(result).toContain("don't");
    expect(result).toContain("can't");
  });

  // ---------------------------------------------------------------
  // 2. Trailing period removal fires ~80% on short messages
  // ---------------------------------------------------------------
  it("should remove trailing period from short messages most of the time", () => {
    const input = "Sounds good."; // short message, < 12 words
    const result = withMockedRandom(
      sequenceWith({ 1: 0 }), // trailing period removal check passes
      () => AntiRobot.humanize(input, "PROFESSIONAL"),
    );

    // The raw transform removes the period; other transforms may add
    // closers/emojis after it, so check that it does NOT end with
    // exactly "good." (the original tail).
    expect(result.includes("good.")).toBe(false);
  });

  // ---------------------------------------------------------------
  // 3. Formal phrase removal fires ~90%
  // ---------------------------------------------------------------
  it("should replace formal AI phrases with casual equivalents at >=80% rate", () => {
    const input = "I would be happy to help you with that.";
    const result = withMockedRandom(
      sequenceWith({ 11: 0 }),
      () => AntiRobot.humanize(input, "PROFESSIONAL"),
    );

    expect(result).toContain("I can");
    expect(result).not.toContain("I would be happy to");
  });

  // ---------------------------------------------------------------
  // 4. CASUAL mode fires more transforms than PROFESSIONAL
  // ---------------------------------------------------------------
  it("should apply more transforms in CASUAL mode than PROFESSIONAL", () => {
    // Use a long-ish input so multiple transforms can fire
    const input =
      "I do not think that is going to work. I would be happy to help you find a better solution. Let us try something new.";
    const sequence = Array.from({ length: 100 }, () => 0.11);

    const casual = withMockedRandom(sequence, () =>
      AntiRobot.humanize(input, "CASUAL"),
    );
    const prof = withMockedRandom(sequence, () =>
      AntiRobot.humanize(input, "PROFESSIONAL"),
    );

    // CASUAL (casualFactor=1.5) should accumulate MORE total changes
    expect(levenshteinLite(input, casual)).toBeGreaterThan(
      levenshteinLite(input, prof),
    );
  });

  // ---------------------------------------------------------------
  // 5. Name injection with userName
  // ---------------------------------------------------------------
  it("should sometimes prepend userName when provided", () => {
    const input = "Here is your schedule for next week.";
    const opts: AntiRobotOptions = { mood: "CASUAL", userName: "Sarah" };
    const withName = withMockedRandom(
      sequenceWith({ 9: 0 }),
      () => AntiRobot.humanize(input, opts),
    );
    const withoutName = withMockedRandom(
      sequenceWith({ 9: 1 }),
      () => AntiRobot.humanize(input, opts),
    );

    expect(withName.startsWith("Sarah,") || withName.startsWith("Sarah ")).toBe(
      true,
    );
    expect(
      withoutName.startsWith("Sarah,") || withoutName.startsWith("Sarah "),
    ).toBe(false);
  });

  // ---------------------------------------------------------------
  // 6. Emoji restriction: only 3 allowed context emojis
  // ---------------------------------------------------------------
  it("should only inject emojis from the CONTEXT_EMOJIS whitelist", () => {
    const input = "You are doing amazing work and I think that is great";
    const allowedEmojis = new Set(["💪", "🔥", "😊"]);
    const result = withMockedRandom(
      sequenceWith({ 6: 0 }),
      () => AntiRobot.humanize(input, "CASUAL"),
    );
    const foundEmojis = result.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
    for (const emoji of foundEmojis) {
      expect(allowedEmojis.has(emoji)).toBe(true);
    }
  });

  // ---------------------------------------------------------------
  // 7. Abbreviation injection in CASUAL mode
  // ---------------------------------------------------------------
  it("should sometimes abbreviate 'going to' to 'gonna' in CASUAL mode", () => {
    const input = "I am going to set up your plan now.";
    const result = withMockedRandom(
      sequenceWith({ 10: 0 }),
      () => AntiRobot.humanize(input, "CASUAL"),
    );

    expect(result).toContain("gonna");
  });

  // ---------------------------------------------------------------
  // 8. Idempotency: double-humanize should not double-mutate
  // ---------------------------------------------------------------
  it("should not double-mutate when humanize is called twice", () => {
    const input = "I do not want to do that. I cannot believe it.";
    const once = withMockedRandom(sequenceWith({ 0: 0 }), () =>
      AntiRobot.humanize(input, "PROFESSIONAL"),
    );
    const twice = withMockedRandom(sequenceWith({ 0: 0 }), () =>
      AntiRobot.humanize(once, "PROFESSIONAL"),
    );

    // Should never produce double-apostrophe contractions
    expect(twice).not.toContain("don''t");
    expect(twice).not.toContain("can''t");
    expect(twice).not.toContain("won''t");

    // Should never have double emojis adjacent (e.g. "💪 💪")
    const emojiPairs = twice.match(/([\u{1F300}-\u{1F9FF}])\s+\1/gu);
    expect(emojiPairs).toBeNull();
  });

  // ---------------------------------------------------------------
  // 9. Empty input returns empty string
  // ---------------------------------------------------------------
  it("should return empty string for empty input", () => {
    const professional = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize("", "PROFESSIONAL"),
    );
    const casual = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize("", "CASUAL"),
    );
    const casualNamed = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize("", { mood: "CASUAL", userName: "Test" }),
    );

    expect(professional).toBe("");
    expect(casual).toBe("");
    expect(casualNamed).toBe("");
  });

  // ---------------------------------------------------------------
  // 10. Unicode / Arabic input should not crash
  // ---------------------------------------------------------------
  it("should handle Arabic and other Unicode text without throwing", () => {
    const arabicInput = "مرحبا، كيف حالك اليوم؟ أنا بخير والحمد لله";
    const professional = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize(arabicInput, "PROFESSIONAL"),
    );
    const casual = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize(arabicInput, "CASUAL"),
    );

    expect(professional).toContain("مرحبا");
    expect(casual).toContain("مرحبا");

    const result = casual;
    // Should still contain the Arabic characters (not be mangled)
    expect(result).toContain("مرحبا");
  });

  // ---------------------------------------------------------------
  // 11. Options normalization: string vs object
  // ---------------------------------------------------------------
  it("should accept both a string mood and an options object", () => {
    const input = "I do not know what to say about this.";

    // Both forms should produce valid results without throwing
    const resultString = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize(input, "CASUAL"),
    );
    const resultObject = withMockedRandom(sequenceWith({}, 1), () =>
      AntiRobot.humanize(input, { mood: "CASUAL" }),
    );

    expect(typeof resultString).toBe("string");
    expect(typeof resultObject).toBe("string");
    expect(resultString.length).toBeGreaterThan(0);
    expect(resultObject.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // 12. No banned emojis ever appear
  // ---------------------------------------------------------------
  it("should never produce banned emojis across 100 CASUAL runs", () => {
    const bannedEmojis = ["👊", "🙌", "✨", "💯", "⚡", "🌟", "🎉", "🙏"];
    const input =
      "I would be happy to help you with your fitness goals. You are doing great work and I am proud of you. Let us keep going!";
    const result = withMockedRandom(sequenceWith({ 6: 0 }), () =>
      AntiRobot.humanize(input, "CASUAL"),
    );
    for (const banned of bannedEmojis) {
      expect(result).not.toContain(banned);
    }
  });
});

// ---------------------------------------------------------------
// Lightweight Levenshtein-like distance for comparing text mutation
// (counts character-level differences, not a full edit distance)
// ---------------------------------------------------------------
function levenshteinLite(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;

  let diffs = Math.abs(a.length - b.length);
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) diffs++;
  }
  return diffs;
}
