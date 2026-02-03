import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

const BASE_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const PIPEBOARD_TOKEN = "pk_5f94902b81e24b1bb5bdf85e51bd7226";

async function run() {
  console.log("📊 Testing Pipeboard Insights Output...");

  // Request raw JSON if possible, but standard tool calls return text
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "get_insights",
      arguments: { level: "campaign", date_preset: "last_3d" },
    },
  };

  try {
    const resp = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PIPEBOARD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed", e);
  }
}

run();
