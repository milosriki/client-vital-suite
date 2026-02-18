import { buildSmartPrompt, ConversationContext, InternalThought } from "../supabase/functions/_shared/smart-prompt";

/**
 * Returns a default ConversationContext merged with any provided overrides.
 */
function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    name: null,
    phone: "+971500000000",
    goal: null,
    area: null,
    housing_type: null,
    history_summary: "",
    message_count: 0,
    last_message: "",
    lead_score: 50,
    dominant_pain: null,
    psychological_profile: null,
    days_since_last_reply: 0,
    referral_source: null,
    voice_mood: null,
    ...overrides,
  };
}

describe("Smart Prompt v10.0", () => {
  // ---------------------------------------------------------------
  // 1. Phase mapping - hook
  // ---------------------------------------------------------------
  it("maps message_count=1 to hook phase (CONNECT section marker)", () => {
    const ctx = makeContext({ message_count: 1 });
    const prompt = buildSmartPrompt(ctx);

    // The CONNECT section should have the marker
    const connectIdx = prompt.indexOf("[CONNECT");
    const problemIdx = prompt.indexOf("[PROBLEM");
    const connectSection = prompt.slice(connectIdx, problemIdx);

    expect(connectSection).toContain(">>> YOU ARE HERE <<<");
  });

  // ---------------------------------------------------------------
  // 2. Phase mapping - bridge
  // ---------------------------------------------------------------
  it("maps message_count=3 to bridge phase (PROBLEM section marker)", () => {
    const ctx = makeContext({ message_count: 3 });
    const prompt = buildSmartPrompt(ctx);

    const problemIdx = prompt.indexOf("[PROBLEM");
    const solutionIdx = prompt.indexOf("[SOLUTION");
    const problemSection = prompt.slice(problemIdx, solutionIdx);

    expect(problemSection).toContain(">>> YOU ARE HERE <<<");
  });

  // ---------------------------------------------------------------
  // 3. Phase mapping - select
  // ---------------------------------------------------------------
  it("maps message_count=5 to select phase (SOLUTION section marker)", () => {
    const ctx = makeContext({ message_count: 5 });
    const prompt = buildSmartPrompt(ctx);

    const solutionIdx = prompt.indexOf("[SOLUTION");
    const consequenceIdx = prompt.indexOf("[CONSEQUENCE");
    const solutionSection = prompt.slice(solutionIdx, consequenceIdx);

    expect(solutionSection).toContain(">>> YOU ARE HERE <<<");
  });

  // ---------------------------------------------------------------
  // 4. Phase mapping - close
  // ---------------------------------------------------------------
  it("maps message_count=7 to close phase (CONSEQUENCE section marker)", () => {
    const ctx = makeContext({ message_count: 7 });
    const prompt = buildSmartPrompt(ctx);

    const consequenceIdx = prompt.indexOf("[CONSEQUENCE");
    const commitmentIdx = prompt.indexOf("[COMMITMENT");
    const consequenceSection = prompt.slice(consequenceIdx, commitmentIdx);

    expect(consequenceSection).toContain(">>> YOU ARE HERE <<<");
  });

  // ---------------------------------------------------------------
  // 5. Phase mapping - post_close
  // ---------------------------------------------------------------
  it("maps message_count=9 to post_close phase (COMMITMENT section marker)", () => {
    const ctx = makeContext({ message_count: 9 });
    const prompt = buildSmartPrompt(ctx);

    const commitmentIdx = prompt.indexOf("[COMMITMENT");
    const commitmentSection = prompt.slice(commitmentIdx);

    expect(commitmentSection).toContain(">>> YOU ARE HERE <<<");
  });

  // ---------------------------------------------------------------
  // 6. Re-engagement override
  // ---------------------------------------------------------------
  it("overrides to hook phase when days_since_last_reply > 1, regardless of message_count", () => {
    const ctx = makeContext({ message_count: 7, days_since_last_reply: 3 });
    const prompt = buildSmartPrompt(ctx);

    // CONNECT (hook) section should have the marker
    const connectIdx = prompt.indexOf("[CONNECT");
    const problemIdx = prompt.indexOf("[PROBLEM");
    const connectSection = prompt.slice(connectIdx, problemIdx);
    expect(connectSection).toContain(">>> YOU ARE HERE <<<");

    // CONSEQUENCE (close) section should NOT have the marker
    const consequenceIdx = prompt.indexOf("[CONSEQUENCE");
    const commitmentIdx = prompt.indexOf("[COMMITMENT");
    const consequenceSection = prompt.slice(consequenceIdx, commitmentIdx);
    expect(consequenceSection).not.toContain(">>> YOU ARE HERE <<<");

    // Re-engagement block should also be activated
    expect(prompt).toContain(">>> LEAD HAS GONE COLD");
  });

  // ---------------------------------------------------------------
  // 7. Context injection
  // ---------------------------------------------------------------
  it("injects name and goal into the prompt output", () => {
    const ctx = makeContext({ name: "John", goal: "weight loss" });
    const prompt = buildSmartPrompt(ctx);

    expect(prompt).toContain("John");
    expect(prompt).toContain("weight loss");
  });

  // ---------------------------------------------------------------
  // 8. Emoji restriction in prompt
  // ---------------------------------------------------------------
  it("contains the emoji restriction rule in the prompt", () => {
    const ctx = makeContext();
    const prompt = buildSmartPrompt(ctx);

    expect(prompt).toContain("Use 💪🔥😊 only. Never 🌟✨🎉🙏");
  });
});
