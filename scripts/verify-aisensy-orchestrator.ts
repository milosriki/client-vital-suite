import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Mocking AISensy Webhook Payload
const mockPayload = {
  message: {
    payload: {
      text: "Hey Mark, can I book a session?",
    },
  },
  destinationNumber: "+971501234567",
};

async function testOrchestrator() {
  console.log("🧪 [Verification] Starting AISensy Orchestrator Test...");

  const functionUrl =
    "http://localhost:54321/functions/v1/aisensy-orchestrator"; // Local Supabase if running
  const actualUrl = Deno.env.get("SUPABASE_FUNCTION_URL") || functionUrl;

  const start = Date.now();

  try {
    const response = await fetch(actualUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-aisensy-signature": "test_signature",
      },
      body: JSON.stringify(mockPayload),
    });

    const data = await response.json();
    const duration = Date.now() - start;

    console.log(`⏱️ Response received in ${duration}ms`);
    console.log("📄 Response Data:", data);

    if (response.ok) {
      console.log("✅ Success: Orchestrator responded correctly.");
    } else {
      console.error("❌ Failure: Orchestrator returned an error.");
    }

    if (duration < 1500) {
      console.log("⚡ SPEED GAIN: Passed benchmark (<1.5s).");
    } else {
      console.warn("⚠️ SLOW: Failed speed benchmark.");
    }
  } catch (e) {
    console.error("💥 Test failed to connect:", e.message);
  }
}

// Run test
testOrchestrator();
