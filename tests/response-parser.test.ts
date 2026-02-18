import { parseAIResponse, ParsedResponse } from "../supabase/functions/_shared/response-parser";

describe("Response Parser", () => {
  // ---------------------------------------------------------------
  // 1. Correct format parsing: both thought and reply extracted
  // ---------------------------------------------------------------
  it("extracts thought and reply when both markers are present", () => {
    const input = [
      "---THOUGHT_START---",
      '{"fitness_intent":"weight_loss","user_felt_heard":"yes","is_warmed_up":"no","move":"hook","summary":"New lead"}',
      "---THOUGHT_END---",
      "",
      "---REPLY_START---",
      "hey! lisa here. what's the main goal?",
      "---REPLY_END---",
    ].join("\n");

    const result: ParsedResponse = parseAIResponse(input);

    expect(result.thought).not.toBeNull();
    expect(result.thought?.fitness_intent).toBe("weight_loss");
    expect(result.reply).toBe("hey! lisa here. what's the main goal?");
  });

  // ---------------------------------------------------------------
  // 2. Thought JSON parsing: valid JSON becomes a parsed object
  // ---------------------------------------------------------------
  it("parses valid InternalThought JSON into a typed object", () => {
    const thought = {
      fitness_intent: "muscle_gain",
      user_felt_heard: "yes",
      is_warmed_up: "yes",
      move: "close",
      summary: "Returning prospect ready to commit",
      user_energy: "high",
      recommended_lead_score: 85,
    };
    const input = [
      `---THOUGHT_START---`,
      JSON.stringify(thought),
      `---THOUGHT_END---`,
      "",
      "---REPLY_START---",
      "Awesome, let's lock it in!",
      "---REPLY_END---",
    ].join("\n");

    const result = parseAIResponse(input);

    expect(result.thought).toEqual(thought);
    expect(result.thought?.recommended_lead_score).toBe(85);
    expect(result.thought?.user_energy).toBe("high");
  });

  // ---------------------------------------------------------------
  // 3. Invalid thought JSON: thought is null, reply still extracted
  // ---------------------------------------------------------------
  it("sets thought to null when JSON between thought markers is malformed", () => {
    const input = [
      "---THOUGHT_START---",
      "{this is NOT valid json!!!}",
      "---THOUGHT_END---",
      "",
      "---REPLY_START---",
      "hey! what brings you here today?",
      "---REPLY_END---",
    ].join("\n");

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = parseAIResponse(input);
    consoleSpy.mockRestore();

    expect(result.thought).toBeNull();
    expect(result.reply).toBe("hey! what brings you here today?");
  });

  // ---------------------------------------------------------------
  // 4. No markers fallback: reply is the full raw text
  // ---------------------------------------------------------------
  it("uses the full raw text as reply when no markers are present", () => {
    const input = "Just a plain response without any markers.";
    const result = parseAIResponse(input);

    expect(result.thought).toBeNull();
    expect(result.reply).toBe("Just a plain response without any markers.");
  });

  // ---------------------------------------------------------------
  // 5. Thought block stripped in fallback (REPLY markers missing)
  // ---------------------------------------------------------------
  it("strips thought block from reply when REPLY markers are missing", () => {
    const input = [
      "---THOUGHT_START---",
      '{"fitness_intent":"flexibility","user_felt_heard":"no","is_warmed_up":"no","move":"rapport","summary":"Cold lead"}',
      "---THOUGHT_END---",
      "",
      "Tell me more about your goals!",
    ].join("\n");

    const result = parseAIResponse(input);

    expect(result.thought).not.toBeNull();
    expect(result.thought?.fitness_intent).toBe("flexibility");
    expect(result.reply).toBe("Tell me more about your goals!");
    expect(result.reply).not.toContain("THOUGHT_START");
    expect(result.reply).not.toContain("THOUGHT_END");
  });

  // ---------------------------------------------------------------
  // 6. Empty reply fallback: default Lisa greeting
  // ---------------------------------------------------------------
  it("returns default Lisa greeting when parsed reply is empty", () => {
    const input = [
      "---THOUGHT_START---",
      '{"fitness_intent":"unknown","user_felt_heard":"no","is_warmed_up":"no","move":"greet","summary":"Empty response"}',
      "---THOUGHT_END---",
      "",
      "---REPLY_START---",
      "",
      "---REPLY_END---",
    ].join("\n");

    const result = parseAIResponse(input);

    expect(result.reply).toBe(
      "Hey! Lisa here. Glad you reached out. What's the main goal we're looking at?"
    );
  });

  // ---------------------------------------------------------------
  // 7. 200-word truncation fires for long replies
  // ---------------------------------------------------------------
  it("truncates reply to 200 words or fewer when input exceeds 200 words", () => {
    const longSentence = "This is a test sentence that adds several words. ";
    // Each repetition is 9 words; ~28 reps = 252 words
    const longReply = longSentence.repeat(28).trim();
    const wordCount = longReply.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(200);

    const input = [
      "---REPLY_START---",
      longReply,
      "---REPLY_END---",
    ].join("\n");

    const result = parseAIResponse(input);
    const resultWordCount = result.reply.split(/\s+/).length;

    expect(resultWordCount).toBeLessThanOrEqual(200);
  });

  // ---------------------------------------------------------------
  // 8. Truncation at sentence boundary
  // ---------------------------------------------------------------
  it("truncates at a sentence boundary ending with . ! or ?", () => {
    // Build text: 150 words of sentences, then a long 60-word sentence
    const firstBlock = "I love fitness and helping people reach their goals. ".repeat(15).trim();
    // 15 * 9 = 135 words
    const longTail = ("word ".repeat(65)).trim() + " final";
    // ~66 words with no sentence boundary
    const longReply = firstBlock + " " + longTail;
    const totalWords = longReply.split(/\s+/).length;
    expect(totalWords).toBeGreaterThan(200);

    const input = `---REPLY_START---\n${longReply}\n---REPLY_END---`;

    const result = parseAIResponse(input);

    // Truncated reply should end at a sentence boundary
    const lastChar = result.reply.trim().slice(-1);
    expect([".","!","?"]).toContain(lastChar);
    expect(result.reply.split(/\s+/).length).toBeLessThanOrEqual(200);
  });

  // ---------------------------------------------------------------
  // 9. Raw field preserved: always contains original input unchanged
  // ---------------------------------------------------------------
  it("preserves the original input in the raw field unchanged", () => {
    const input = [
      "---THOUGHT_START---",
      '{"fitness_intent":"weight_loss","user_felt_heard":"yes","is_warmed_up":"no","move":"hook","summary":"test"}',
      "---THOUGHT_END---",
      "",
      "---REPLY_START---",
      "Let's talk about your plan!",
      "---REPLY_END---",
    ].join("\n");

    const result = parseAIResponse(input);

    expect(result.raw).toBe(input);
  });

  // ---------------------------------------------------------------
  // 10. Whitespace handling: trimmed around reply markers
  // ---------------------------------------------------------------
  it("trims extra whitespace around the reply content", () => {
    const input = [
      "---REPLY_START---",
      "   ",
      "   hey there, how can I help?   ",
      "   ",
      "---REPLY_END---",
    ].join("\n");

    const result = parseAIResponse(input);

    expect(result.reply).toBe("hey there, how can I help?");
    expect(result.reply).not.toMatch(/^\s/);
    expect(result.reply).not.toMatch(/\s$/);
  });
});
