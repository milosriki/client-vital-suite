import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // fallback to .env
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConnection() {
  console.log(`🔌 Testing connection to: ${SUPABASE_URL}`);

  // 1. Read Test
  const { data, error } = await supabase
    .from("agent_decisions")
    .select("count")
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      console.error("❌ Table 'agent_decisions' DOES NOT EXIST.");
    } else {
      console.error(`❌ Connection Failed: ${error.message} (${error.code})`);
    }
  } else {
    console.log("✅ Read Success: agent_decisions is accessible.");
  }

  // 2. Write Test (if read worked or table exists)
  if (!error || error.code !== "42P01") {
    const { error: writeError } = await supabase
      .from("agent_decisions")
      .insert({
        decision_type: "SYSTEM_TEST",
        decision_output: { test: true, time: new Date().toISOString() },
        outcome: "test_success",
        status: "verified",
        agent_id: "system-test",
        input_context: {},
      });

    if (writeError) {
      console.error(`❌ Write Failed: ${writeError.message}`);
    } else {
      console.log("✅ Write Success: Can insert into agent_decisions.");
    }
  }
}

checkConnection();
