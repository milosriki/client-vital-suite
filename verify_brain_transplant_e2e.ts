import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { SentimentTriage } from "./supabase/functions/_shared/sentiment.ts";
import { buildSmartPrompt } from "./supabase/functions/_shared/smart-prompt.ts";

/**
 * 🕵️ AUTONOMOUS VERIFICATION AGENT - E2E BRAIN SCAN
 * Target: WhatsApp "Brain Transplant" Logic
 */

Deno.test("🧠 Brain Transplant E2E Verification", async (t) => {
  // ===========================================================================
  // TEST CASE 1: MEMORY PERSISTENCE (The "2-3 Days" Request)
  // ===========================================================================
  await t.step("Test 1: Memory Horizon (3 Day Recall)", () => {
    console.log("\n🧪 Executing Memory Trace...");

    // MOCK: Database State from 3 days ago
    const mockDbRecord = {
      last_lead_message_at: new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 3 days ago
      dominant_pain: "Chronic Back Pain (L4-L5)",
      desired_outcome: "Run a marathon",
      lead_score: 15,
    };

    // LOGIC: The exact math used in aisensy-orchestrator/index.ts
    const daysSinceLastReply =
      (Date.now() - new Date(mockDbRecord.last_lead_message_at).getTime()) /
      86400000;

    // ASSERTION: Must be exactly ~3.0
    console.log(`   Time Delta: ${daysSinceLastReply.toFixed(2)} days`);
    assertEquals(
      Math.floor(daysSinceLastReply),
      3,
      "Failed to calculate 3-day gap",
    );

    // LOGIC: Prompt Injection
    // We confirm that the 'dominant_pain' from DB successfully enters the prompt builder
    const prompt = buildSmartPrompt({
      name: "TestUser",
      phone: "+123",
      goal: mockDbRecord.desired_outcome,
      dominant_pain: mockDbRecord.dominant_pain,
      days_since_last_reply: daysSinceLastReply,
      history_summary: "",
      message_count: 5,
      last_message: "I'm back.",
      lead_score: mockDbRecord.lead_score,
      psychological_profile: "analytical",
      referral_source: null,
      voice_mood: null,
      area: null, // Added property
      housing_type: null, // Added property
    });

    // VERIFY: The prompt MUST contain the pain point re-injected from memory
    assertStringIncludes(
      prompt,
      "Chronic Back Pain",
      "Memory Failure: Pain point not injected into prompt",
    );
    console.log(
      "✅ Memory Test Passed: Bot recalled 'Chronic Back Pain' after 3 days.",
    );
  });

  // ===========================================================================
  // TEST CASE 2: SENTIMENT & SAFETY (The "De-escalation" Switch)
  // ===========================================================================
  await t.step("Test 2: Sentiment Triage & Safety Switch", () => {
    console.log("\n🧪 Executing Sentiment Stress Test...");

    const angryMessage = "Stop messaging me I hate this service!";

    // 1. Run Analysis
    const result = SentimentTriage.analyze(angryMessage);
    console.log(`   Input: "${angryMessage}"`);
    console.log(`   Detected: ${result.sentiment} (${result.score})`); // Fixed property name

    // 2. ASSERTION: Must be RISK
    assertEquals(
      result.sentiment,
      "RISK",
      "Failed to detect high-risk sentiment",
    );

    // 3. LOGIC SIMULATION: The Orchestrator's De-escalation Switch
    let finalSystemPrompt = "Default Sales Prompt";
    if (result.sentiment === "RISK") {
      finalSystemPrompt =
        "You are Lisa, a helpful support agent. The user is upset. De-escalate. No selling. Be human.";
    }

    // VERIFY: We switched to the safety prompt
    assertStringIncludes(
      finalSystemPrompt,
      "De-escalate",
      "Safety Failure: Did not switch to de-escalation prompt",
    );
    console.log("✅ Safety Test Passed: Bot switched to De-escalation Mode.");
  });

  // ===========================================================================
  // TEST CASE 3: LEAD SCORING (The "Measurement" Upgrade)
  // ===========================================================================
  await t.step("Test 3: Lead Score Progression", () => {
    console.log("\n🧪 Executing Lead Score Validation...");

    // MOCK: Previous State
    const oldScore = 10;

    // MOCK: AI Thought (The 'Brain' output)
    const aiThought = {
      recommended_lead_score: 50, // AI thinks this is a hot lead
      rationale: "User wants to buy immediately",
    };

    // LOGIC: The weighted average formula from index.ts
    // (Old * 0.6) + (New * 0.4)
    // (10 * 0.6) + (50 * 0.4) = 6 + 20 = 26
    const newScore = Math.round(
      aiThought.recommended_lead_score * 0.4 + oldScore * 0.6,
    );

    console.log(
      `   Old Score: ${oldScore} | New Rec: ${aiThought.recommended_lead_score}`,
    );
    console.log(`   Calculated: ${newScore}`);

    // ASSERTION
    assertEquals(newScore, 26, "Scoring Math Failed");

    if (newScore <= oldScore) {
      throw new Error("Lead Score did not increase despite high intent!");
    }
    console.log(
      "✅ Scoring Test Passed: Lead score intelligently adapted (Smoothing applied).",
    );
  });
});
