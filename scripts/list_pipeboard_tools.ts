import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

const BASE_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const PIPEBOARD_TOKEN = process.env.PIPEBOARD_API_KEY || "";

async function run() {
  console.log("🔍 Fetching Pipeboard Tools...");

  // List tools to find the schema
  const rpcPayload = {
    jsonrpc: "2.0",
    method: "tools/list",
    id: 1,
    params: {},
  };

  try {
    const resp = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PIPEBOARD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpcPayload),
    });

    const data = await resp.json();
    if (data.result && data.result.tools) {
      const t = data.result.tools.find((x: any) => x.name === "get_insights");
      console.log("SCHEMA:", JSON.stringify(t, null, 2));
    }
  } catch (e) {
    console.error("RPC Failed", e);
  }
}

run();
