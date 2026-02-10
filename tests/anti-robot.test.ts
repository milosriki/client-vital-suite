import { AntiRobot, AntiRobotOptions } from "../supabase/functions/_shared/anti-robot.ts";

describe("AntiRobot v2.0", () => {
  // ---------------------------------------------------------------
  // 1. Contraction forcing fires ~95% of the time
  // ---------------------------------------------------------------
  it("should force contractions at >=90% rate (95% probability)", () => {
    const input = "I do not want to do that because I cannot stop.";
    const runs = 20;
    let contractedCount = 0;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, "PROFESSIONAL");
      if (result.includes("don't") || result.includes("can't")) {
        contractedCount++;
      }
    }

    // At 95% probability, expect at least 18 out of 20 (90%)
    expect(contractedCount).toBeGreaterThanOrEqual(18);
  });

  // ---------------------------------------------------------------
  // 2. Trailing period removal fires ~80% on short messages
  // ---------------------------------------------------------------
  it("should remove trailing period from short messages most of the time", () => {
    const input = "Sounds good."; // short message, < 12 words
    const runs = 50;
    let removedCount = 0;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, "PROFESSIONAL");
      // The raw transform removes the period; other transforms may add
      // closers/emojis after it, so check that it does NOT end with
      // exactly "good." (the original tail).
      if (!result.includes("good.")) {
        removedCount++;
      }
    }

    // 80% probability => expect at least 60% to account for variance
    const ratio = removedCount / runs;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });

  // ---------------------------------------------------------------
  // 3. Formal phrase removal fires ~90%
  // ---------------------------------------------------------------
  it("should replace formal AI phrases with casual equivalents at >=80% rate", () => {
    const input = "I would be happy to help you with that.";
    const runs = 50;
    let replacedCount = 0;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, "PROFESSIONAL");
      if (result.includes("I can") && !result.includes("I would be happy to")) {
        replacedCount++;
      }
    }

    // 90% probability => expect at least 80% with variance margin
    const ratio = replacedCount / runs;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  });

  // ---------------------------------------------------------------
  // 4. CASUAL mode fires more transforms than PROFESSIONAL
  // ---------------------------------------------------------------
  it("should apply more transforms in CASUAL mode than PROFESSIONAL", () => {
    // Use a long-ish input so multiple transforms can fire
    const input =
      "I do not think that is going to work. I would be happy to help you find a better solution. Let us try something new.";
    const runs = 200;

    let casualDiffTotal = 0;
    let profDiffTotal = 0;

    for (let i = 0; i < runs; i++) {
      const casual = AntiRobot.humanize(input, "CASUAL");
      const prof = AntiRobot.humanize(input, "PROFESSIONAL");

      // Measure edit distance proxy: count characters changed from original
      casualDiffTotal += levenshteinLite(input, casual);
      profDiffTotal += levenshteinLite(input, prof);
    }

    // CASUAL (casualFactor=1.5) should accumulate MORE total changes
    expect(casualDiffTotal).toBeGreaterThan(profDiffTotal);
  });

  // ---------------------------------------------------------------
  // 5. Name injection with userName
  // ---------------------------------------------------------------
  it("should sometimes prepend userName when provided", () => {
    const input = "Here is your schedule for next week.";
    const opts: AntiRobotOptions = { mood: "CASUAL", userName: "Sarah" };
    const runs = 100;
    let nameCount = 0;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, opts);
      if (result.startsWith("Sarah,") || result.startsWith("Sarah ")) {
        nameCount++;
      }
    }

    // 20% probability => expect at least a few hits
    expect(nameCount).toBeGreaterThanOrEqual(1);
    // And it should NOT fire every single time
    expect(nameCount).toBeLessThan(runs);
  });

  // ---------------------------------------------------------------
  // 6. Emoji restriction: only 3 allowed context emojis
  // ---------------------------------------------------------------
  it("should only inject emojis from the CONTEXT_EMOJIS whitelist", () => {
    const input = "You are doing amazing work and I think that is great";
    const allowedEmojis = new Set(["💪", "🔥", "😊"]);
    const runs = 200;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, "CASUAL");
      // Extract all emojis from result using unicode emoji regex
      const foundEmojis = result.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
      for (const emoji of foundEmojis) {
        expect(allowedEmojis.has(emoji)).toBe(true);
      }
    }
  });

  // ---------------------------------------------------------------
  // 7. Abbreviation injection in CASUAL mode
  // ---------------------------------------------------------------
  it("should sometimes abbreviate 'going to' to 'gonna' in CASUAL mode", () => {
    const input = "I am going to set up your plan now.";
    const runs = 100;
    let abbrCount = 0;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, "CASUAL");
      if (result.includes("gonna")) {
        abbrCount++;
      }
    }

    // CASUAL abbreviation probability ~ 22.5% (0.15 * 1.5), expect at least a few
    expect(abbrCount).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------
  // 8. Idempotency: double-humanize should not double-mutate
  // ---------------------------------------------------------------
  it("should not double-mutate when humanize is called twice", () => {
    const input = "I do not want to do that. I cannot believe it.";
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      const once = AntiRobot.humanize(input, "PROFESSIONAL");
      const twice = AntiRobot.humanize(once, "PROFESSIONAL");

      // Should never produce double-apostrophe contractions
      expect(twice).not.toContain("don''t");
      expect(twice).not.toContain("can''t");
      expect(twice).not.toContain("won''t");

      // Should never have double emojis adjacent (e.g. "💪 💪")
      const emojiPairs = twice.match(/([\u{1F300}-\u{1F9FF}])\s+\1/gu);
      expect(emojiPairs).toBeNull();
    }
  });

  // ---------------------------------------------------------------
  // 9. Empty input returns empty string
  // ---------------------------------------------------------------
  it("should return empty string for empty input", () => {
    expect(AntiRobot.humanize("", "PROFESSIONAL")).toBe("");
    expect(AntiRobot.humanize("", "CASUAL")).toBe("");
    expect(AntiRobot.humanize("", { mood: "CASUAL", userName: "Test" })).toBe("");
  });

  // ---------------------------------------------------------------
  // 10. Unicode / Arabic input should not crash
  // ---------------------------------------------------------------
  it("should handle Arabic and other Unicode text without throwing", () => {
    const arabicInput = "مرحبا، كيف حالك اليوم؟ أنا بخير والحمد لله";
    expect(() => AntiRobot.humanize(arabicInput, "PROFESSIONAL")).not.toThrow();
    expect(() => AntiRobot.humanize(arabicInput, "CASUAL")).not.toThrow();

    const result = AntiRobot.humanize(arabicInput, "CASUAL");
    // Should still contain the Arabic characters (not be mangled)
    expect(result).toContain("مرحبا");
  });

  // ---------------------------------------------------------------
  // 11. Options normalization: string vs object
  // ---------------------------------------------------------------
  it("should accept both a string mood and an options object", () => {
    const input = "I do not know what to say about this.";

    // Both forms should produce valid results without throwing
    const resultString = AntiRobot.humanize(input, "CASUAL");
    const resultObject = AntiRobot.humanize(input, { mood: "CASUAL" });

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
    const runs = 100;

    for (let i = 0; i < runs; i++) {
      const result = AntiRobot.humanize(input, "CASUAL");
      for (const banned of bannedEmojis) {
        expect(result).not.toContain(banned);
      }
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
