import { buildSmartPrompt } from "./supabase/functions/_shared/smart-prompt.ts";

// Mock Context for Verification
const mockContext = {
  name: "Test User",
  phone: "1234567890",
  goal: "Muscle Gain",
  area: "Dubai",
  housing_type: "Villa",
  history_summary: "User wants to build muscle but is busy.",
  message_count: 5,
  last_message: "I am ready to book.",
  lead_score: 10,
  dominant_pain: "Lack of time",
  psychological_profile: "Action Taker",
  days_since_last_reply: 0.1,
  referral_source: "Instagram",
};

console.log("🔍 VERIFYING SMART COOL PERSONA...");

const prompt = buildSmartPrompt(mockContext);
let errors = [];

// 1. Verify Identity & Vibe
if (!prompt.includes('You have "SMART COOL" energy')) {
  errors.push("❌ Missing 'SMART COOL' identity instruction.");
} else {
  console.log("✅ 'Smart Cool' Identity Verified.");
}

// 2. Verify Vocabulary
if (!prompt.includes('"I\'ve got you" instead of "I understand"')) {
  errors.push("❌ Missing 'I've got you' vocabulary rule.");
} else {
  console.log("✅ 'I've got you' Vocabulary Verified.");
}

if (!prompt.includes('"Fair play" instead of "Okay"')) {
  errors.push("❌ Missing 'Fair play' vocabulary rule.");
} else {
  console.log("✅ 'Fair play' Vocabulary Verified.");
}

// 3. Verify Lifestyle Audit Script
if (!prompt.includes("Beast Mode") || !prompt.includes("Survival Mode")) {
  errors.push("❌ Missing 'Lifestyle Audit' (Beast/Survival Mode) script.");
} else {
  console.log("✅ 'Lifestyle Audit' Script Verified.");
}

// 4. Verify Quality Scarcity
if (!prompt.includes("customize every plan")) {
  errors.push("❌ Missing 'Quality Scarcity' reason.");
} else {
  console.log("✅ 'Quality Scarcity' Logic Verified.");
}

// 5. Verify Empathetic Takeaway
if (!prompt.includes("honesty is key")) {
  errors.push("❌ Missing 'Empathetic Takeaway' script.");
} else {
  console.log("✅ 'Empathetic Takeaway' Verified.");
}

console.log("\n--- REPORT ---");
if (errors.length > 0) {
  console.error("FAILED with " + errors.length + " errors:");
  errors.forEach((e) => console.error(e));
  Deno.exit(1);
} else {
  console.log("🎉 ALL CHECKS PASSED: Lisa is officially Cool & Smart.");
  Deno.exit(0);
}
