import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const USER_PROMPT =
  "who was my leads in hubdpot who have scheduled confirmed and fwihic stter had most confirmed appoitmtes and how many he have to cinfirmed and give me lead to book book to hel and close won per ster last 4 days";

async function runSimulation() {
  console.log("🤖 Sending prompt to ptd-agent-gemini...");
  console.log(`> "${USER_PROMPT}"`);

  const { data, error } = await supabase.functions.invoke("ptd-agent-gemini", {
    body: {
      query: USER_PROMPT,
      conversation_id: "simulation-test-1",
    },
  });

  if (error) {
    console.error("❌ Function Error:", error);
  } else {
    console.log("✅ AI Response:\n", JSON.stringify(data, null, 2));
  }
}

runSimulation();
