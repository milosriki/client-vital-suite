import { calculateSmartPause } from "../supabase/functions/_shared/smart-pause";

/**
 * Helper: run calculateSmartPause N times and return the average.
 * Because the function includes +-20% random jitter, we sample many
 * iterations and assert on the mean to get deterministic-enough coverage.
 */
function averagePause(
  incoming: string,
  response?: string,
  iterations = 50,
): number {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += calculateSmartPause(incoming, response);
  }
  return sum / iterations;
}

describe("Smart Pause v2.0", () => {
  // ---------------------------------------------------------------
  // 1. Floor bound — every result must be >= 1200 ms
  // ---------------------------------------------------------------
  it("never returns below the 1200 ms floor", () => {
    for (let i = 0; i < 50; i++) {
      const result = calculateSmartPause("");
      expect(result).toBeGreaterThanOrEqual(1200);
    }
    // Also check with a minimal casual message (which gets -200ms discount)
    for (let i = 0; i < 50; i++) {
      const result = calculateSmartPause("ok");
      expect(result).toBeGreaterThanOrEqual(1200);
    }
  });

  // ---------------------------------------------------------------
  // 2. Ceiling bound — every result must be <= 6000 ms
  // ---------------------------------------------------------------
  it("never returns above the 6000 ms ceiling", () => {
    const longQuestion =
      "Can you please explain to me in extensive detail every single step of the process " +
      "and also elaborate on the reasoning behind each decision and how it affects the overall " +
      "outcome of the training program that we discussed last week during our team meeting?";

    for (let i = 0; i < 50; i++) {
      const result = calculateSmartPause(longQuestion);
      expect(result).toBeLessThanOrEqual(6000);
    }
    // Also check with a very long response text
    for (let i = 0; i < 50; i++) {
      const result = calculateSmartPause(longQuestion, longQuestion + " " + longQuestion);
      expect(result).toBeLessThanOrEqual(6000);
    }
  });

  // ---------------------------------------------------------------
  // 3. Short casual message — "ok" should be near the floor
  // ---------------------------------------------------------------
  it("returns a low delay (1200-2000 ms average) for a short casual message like 'ok'", () => {
    // "ok" = 1 word, isCasual = true (wordCount <= 3), no question
    // Base: 800 + readMs(~0) + typeMs(~0) - 200 (casual) = ~600 -> clamped to 1200
    // With jitter the average should still sit in 1200-2000 range
    const avg = averagePause("ok");
    expect(avg).toBeGreaterThanOrEqual(1200);
    expect(avg).toBeLessThanOrEqual(2000);
  });

  // ---------------------------------------------------------------
  // 4. Long question message — 40-word question yields higher delay
  // ---------------------------------------------------------------
  it("returns a higher delay for a long question than for a short casual message", () => {
    const longQuestion =
      "Could you please walk me through the entire onboarding process step by step " +
      "so that I understand exactly what documents I need to prepare and what deadlines " +
      "I should be aware of before the training session begins next Monday morning?";
    // 40 words, is a question, > 30 words so gets long-msg bonus

    const avgLong = averagePause(longQuestion);
    const avgShort = averagePause("ok");

    expect(avgLong).toBeGreaterThan(avgShort);
  });

  // ---------------------------------------------------------------
  // 5. Question detection bonus — question yields higher delay
  //    than a non-question of similar word count
  // ---------------------------------------------------------------
  it("returns a higher delay for a question than a non-question with similar word count", () => {
    const question = "What time is the appointment?"; // 5 words, has '?'
    const statement = "The appointment is at five"; // 5 words, no question

    const avgQuestion = averagePause(question);
    const avgStatement = averagePause(statement);

    // Question should average ~500 ms higher
    expect(avgQuestion).toBeGreaterThan(avgStatement);
  });

  // ---------------------------------------------------------------
  // 6. Casual/emoji discount — emoji-heavy msg gets lower delay
  // ---------------------------------------------------------------
  it("returns a lower delay for a casual emoji message than a formal message of similar length", () => {
    const casual = "\u{1F60A}\u{1F60A} cool"; // 2 emojis + 1 word -> isCasual
    const formal = "I would like to discuss the training program"; // 8 words, not casual

    const avgCasual = averagePause(casual);
    const avgFormal = averagePause(formal);

    expect(avgCasual).toBeLessThan(avgFormal);
  });

  // ---------------------------------------------------------------
  // 7. Long message bonus — 35+ word message gets +300 ms
  // ---------------------------------------------------------------
  it("gives a long-message bonus for messages over 30 words", () => {
    // Build two messages: one just under 30 words, one just over 30 words
    // We keep them non-question and non-casual to isolate the bonus.
    const wordsUnder = Array(28).fill("word").join(" "); // 28 words
    const wordsOver = Array(35).fill("word").join(" ");  // 35 words

    const avgUnder = averagePause(wordsUnder);
    const avgOver = averagePause(wordsOver);

    // The difference should include the 300 ms LONG_MSG_BONUS plus the
    // extra reading time for 7 more words. We check the over-30 version
    // is meaningfully higher (at least 200 ms on average, accounting for jitter).
    expect(avgOver - avgUnder).toBeGreaterThanOrEqual(200);
  });

  // ---------------------------------------------------------------
  // 8. Response text affects delay — providing a long response
  //    should produce a different (higher) delay than no response
  // ---------------------------------------------------------------
  it("returns a different delay when a long response text is provided", () => {
    const incoming = "hey"; // short casual
    const longResponse =
      "Great question! Let me walk you through the entire enrollment process. " +
      "First you need to fill out the application form online, then submit your " +
      "documents, and finally schedule your initial consultation with the team.";

    const avgWithoutResponse = averagePause(incoming);
    const avgWithResponse = averagePause(incoming, longResponse);

    // Without responseText, the function uses incoming ("hey" = 1 word) for
    // typing time. With the long response (~30 words), typing time increases.
    // The response version should be notably higher.
    expect(avgWithResponse).toBeGreaterThan(avgWithoutResponse);
  });
});
