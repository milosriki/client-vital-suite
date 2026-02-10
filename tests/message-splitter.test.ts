import {
  splitMessage,
  MessageBubble,
  SplitOptions,
} from "../supabase/functions/_shared/message-splitter.ts";

describe("Message Splitter v1.0", () => {
  // -------------------------------------------------------
  // 1. Short message (< 15 words) => always exactly 1 bubble
  // -------------------------------------------------------
  test("short message (< 15 words) returns exactly 1 bubble", () => {
    const bubbles = splitMessage("Hey, how are you doing today?");
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0].text).toBe("Hey, how are you doing today?");
  });

  // -------------------------------------------------------
  // 2. Paragraph break splitting (\n\n) => multiple bubbles
  // -------------------------------------------------------
  test("text with paragraph breaks splits into multiple bubbles", () => {
    // Each paragraph needs >= 15 words total so the short-message guard doesn't collapse it.
    const text = [
      "This is the first paragraph with enough words to pass the short message threshold easily.",
      "This is the second paragraph that also contains plenty of words for splitting.",
    ].join("\n\n");

    const bubbles = splitMessage(text);
    expect(bubbles.length).toBeGreaterThanOrEqual(2);
    expect(bubbles[0].text).toContain("first paragraph");
    expect(bubbles[1].text).toContain("second paragraph");
  });

  // -------------------------------------------------------
  // 3. Sentence boundary splitting for long text
  // -------------------------------------------------------
  test("long text without paragraph breaks splits at sentence boundaries", () => {
    // Build a single block with multiple sentences and no paragraph breaks.
    // Each sentence is short enough that they won't all be merged, but total > 15 words.
    const text =
      "I checked your account and everything looks great. " +
      "Your payment went through successfully last Tuesday. " +
      "The next billing date is March fifteenth. " +
      "Let me know if you need anything else from us today.";

    const bubbles = splitMessage(text);
    // With no paragraph breaks, the splitter falls to sentence boundaries.
    // 4 sentences > 25 words each pair, so we expect at least 2 bubbles.
    expect(bubbles.length).toBeGreaterThanOrEqual(2);
    // Verify no bubble text is empty
    for (const b of bubbles) {
      expect(b.text.length).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------
  // 4. Default maxBubbles = 4: even very long text never exceeds 4
  // -------------------------------------------------------
  test("very long text never exceeds the default 4 bubbles", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, i) =>
        `This is paragraph number ${i + 1} and it has plenty of words to ensure it is a real paragraph.`,
    );
    const text = paragraphs.join("\n\n");

    const bubbles = splitMessage(text);
    expect(bubbles.length).toBeLessThanOrEqual(4);
  });

  // -------------------------------------------------------
  // 5. Custom maxBubbles option limits bubble count
  // -------------------------------------------------------
  test("custom maxBubbles: 2 limits output to at most 2 bubbles", () => {
    const text = [
      "First paragraph has more than enough words to be its own bubble here.",
      "Second paragraph is also quite long to justify being separate from the rest.",
      "Third paragraph exists so we can verify the limit is respected properly.",
    ].join("\n\n");

    const bubbles = splitMessage(text, { maxBubbles: 2 });
    expect(bubbles.length).toBeLessThanOrEqual(2);
  });

  // -------------------------------------------------------
  // 6. First bubble delay is 0 (multi-bubble path)
  // -------------------------------------------------------
  test("first bubble in a multi-bubble result has delayMs of 0", () => {
    const text =
      "Here is the first part of the message with enough words.\n\n" +
      "And here is the second part with enough words to split.";

    const bubbles = splitMessage(text);
    // Ensure we actually got multiple bubbles so the test is meaningful
    expect(bubbles.length).toBeGreaterThanOrEqual(2);
    expect(bubbles[0].delayMs).toBe(0);
  });

  // -------------------------------------------------------
  // 7. Subsequent bubble delays are positive (>= 400ms min)
  // -------------------------------------------------------
  test("non-first bubbles have positive delays of at least 400ms", () => {
    const text =
      "First paragraph has enough words to qualify as its own bubble.\n\n" +
      "Second paragraph also carries a good number of words here.";

    const bubbles = splitMessage(text);
    expect(bubbles.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < bubbles.length; i++) {
      expect(bubbles[i].delayMs).toBeGreaterThanOrEqual(400);
    }
  });

  // -------------------------------------------------------
  // 8. Minimum 3 words per bubble: tiny fragments get merged
  // -------------------------------------------------------
  test("tiny fragments (< 3 words) are merged with adjacent bubbles", () => {
    // Use newline-separated lines where some are very short.
    // Total must be >= 15 words to avoid short-message collapse.
    const text =
      "This is a long enough first line to start things off properly.\n\n" +
      "Ok\n\n" +
      "This final line has more than enough words to stand alone.";

    const bubbles = splitMessage(text);
    // "Ok" (1 word) should be merged into an adjacent bubble, not stand alone.
    const tinyBubble = bubbles.find((b) => {
      const wc = b.text.split(/\s+/).filter(Boolean).length;
      return wc < 3;
    });
    expect(tinyBubble).toBeUndefined();
  });

  // -------------------------------------------------------
  // 9. Empty input returns a single bubble with empty text
  // -------------------------------------------------------
  test("empty string input returns single bubble with empty text", () => {
    const bubbles = splitMessage("");
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0].text).toBe("");
  });

  // -------------------------------------------------------
  // 10. Emoji-only message: doesn't crash, returns 1 bubble
  // -------------------------------------------------------
  test("emoji-only message returns 1 bubble and does not crash", () => {
    const bubbles = splitMessage("\u{1F4AA}\u{1F4AA}\u{1F4AA}");
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0].text).toContain("\u{1F4AA}");
    expect(typeof bubbles[0].delayMs).toBe("number");
    expect(Number.isFinite(bubbles[0].delayMs)).toBe(true);
  });
});
