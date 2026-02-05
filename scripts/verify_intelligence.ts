import { RepairEngine } from "../supabase/functions/_shared/repair-engine.ts";

console.log("🧠 VERIFYING SUPER INTELLIGENCE (Loop & Repair) 🧠\n");

// TEST 1: Loop Detection
console.log("[Test 1] Loop Detection Logic");
const prev = "My bad, didn't catch that.";
const next = "My bad, didn't catch that.";
const isLoop = RepairEngine.detectLoop(prev, next);
console.log(`Input: "${prev}" vs "${next}"`);
console.log(`Deep Loop Detected: ${isLoop ? "✅ YES" : "❌ NO"}`);
console.log("---------------------------------------------------\n");

// TEST 2: Slang & Typo Reasoning
console.log("[Test 2] Deep Reasoning Repair Prompt");
const trickyInput = "Sta ti nije jasno"; // Serbian for "What isn't clear?"
const prompt = RepairEngine.generateRepairPrompt(trickyInput, []);

console.log("Generated Repair Prompt:");
console.log(prompt);

console.log("\n---------------------------------------------------");
if (
  prompt.includes("Detect Foreign Language") &&
  prompt.includes("DEEP REASONING")
) {
  console.log("✅ Verification Passed: System is using Deep Reasoning.");
} else {
  console.log("❌ Verification Failed: Standard prompt used.");
}
