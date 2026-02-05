import {
  StageDetector,
  type SalesStage,
} from "../supabase/functions/_shared/stage-detection.ts";

function runTest() {
  console.log("🚦 Starting Sales Stage Logic Test...");

  let currentStage: SalesStage = "1_CONNECTION";

  const conversation = [
    { input: "I want to lose weight", expected: "2_SITUATION" },
    { input: "I usually go to the gym but fail", expected: "3_PROBLEM" },
    { input: "I am inconsistent", expected: "4_SOLUTION" },
    { input: "I want to lose 10kg", expected: "5_CLOSING" },
    { input: "Can I book a time?", expected: "6_BOOKED" },
  ];

  let passed = true;

  for (const turn of conversation) {
    console.log(`\n👉 Current: ${currentStage}`);
    console.log(`🗣️  User: "${turn.input}"`);

    const result = StageDetector.detect(currentStage, turn.input);

    if (result.stage === turn.expected) {
      console.log(`✅ MATCH: Advanced to ${result.stage}`);
      currentStage = result.stage;
    } else {
      console.error(`❌ FAIL: Expected ${turn.expected}, got ${result.stage}`);
      passed = false;
      break;
    }
  }

  if (passed) {
    console.log("\n🎉 ALL TESTS PASSED: NEPQ Flow Logic is correct.");
  } else {
    console.error("\n💥 TESTS FAILED.");
    Deno.exit(1);
  }
}

runTest();
