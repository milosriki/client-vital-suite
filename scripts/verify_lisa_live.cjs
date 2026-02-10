// scripts/verify_lisa_live.cjs
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load Env
const localEnv = path.resolve(process.cwd(), ".env");
const homeEnv = path.resolve("/Users/milosvukovic", ".env");

if (fs.existsSync(localEnv)) dotenv.config({ path: localEnv });
else if (fs.existsSync(homeEnv)) dotenv.config({ path: homeEnv });

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = "ztjndilxurtsfqdsvfds"; // From deployment logs
const FUNCTION_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/ptd-agent-gemini`;

async function callLiveLisa(userMessage) {
  if (!SUPABASE_KEY) {
    console.error("❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY not found in .env");
    return "Error: No API Key available.";
  }

  const payload = {
    message: userMessage,
    context: {
      source: "whatsapp",
      platform: "whatsapp",
      contactId: "test-verifier",
      name: "Milos",
    },
    history: [], // Fresh chat
  };

  console.log(`Connecting to Validated Brain: ${FUNCTION_URL}`);

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.response || data; // 'apiSuccess' returns { response: ... }
  } catch (e) {
    console.error("Live Call Failed:", e.message);
    return "Error calling Live Brain.";
  }
}

async function runLiveVerification() {
  console.log("🟢 Running LIVE Verification for Lisa (Live Edge Function)...");
  console.log("---------------------------------------------------");

  const testMessage = "can i get a job with you guys?";
  console.log(`📥 User: "${testMessage}"`);
  console.log("---------------------------------------------------");

  console.log("... Connecting to Supabase Edge Network (Real AI) ...");
  // Polyfill fetch if needed (Node 18+ has it)
  if (!global.fetch) {
    console.error("Node version too old for fetch. Please use Node 18+");
    return;
  }

  const response = await callLiveLisa(testMessage);

  console.log("---------------------------------------------------");
  console.log("💬 Lisa's Live Response:\n");
  console.log(response);
  console.log("---------------------------------------------------");
}

runLiveVerification();
