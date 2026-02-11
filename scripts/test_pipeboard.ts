import { config } from "dotenv";

const PIPEBOARD_TOKEN = process.env.PIPEBOARD_API_KEY || "";
const BASE_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

async function testConnection() {
  console.log("🚀 Testing Pipeboard MCP (Method List)...");

  // The user provided Python code using `MultiServerMCPClient`.
  // It creates a client with url="https://mcp.pipeboard.co/meta-ads-mcp".
  // It probably uses the SSE transport if it's "Streaming HTTP".
  // Let's try to hit the URL with an 'Upgrade' header or just look for the SSE endpoint.

  // Attempt 1: POST query (if it's a direct agent endpoint) or JSON-RPC
  const rpcPayload = {
    jsonrpc: "2.0",
    method: "tools/list",
    id: 1,
    params: {},
  };

  try {
    const resp = await fetch(BASE_URL, {
      method: "POST", // Standard HTTP MCP often uses POST for messages
      headers: {
        Authorization: `Bearer ${PIPEBOARD_TOKEN}`,
        "X-Pipeboard-Token": PIPEBOARD_TOKEN,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(rpcPayload),
    });

    console.log(`RPC Status: ${resp.status}`);
    const text = await resp.text();
    if (text.startsWith("<")) console.log("Received HTML (Not RPC endpoint)");
    else console.log("RPC Response:", text.substring(0, 500));
  } catch (e) {
    console.log("RPC Failed");
  }

  // Attempt 2: SSE endpoint check
  try {
    const sseUrl = `${BASE_URL}/sse`;
    const resp = await fetch(sseUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PIPEBOARD_TOKEN}`,
        "X-Pipeboard-Token": PIPEBOARD_TOKEN,
        Accept: "text/event-stream",
      },
    });
    console.log(`SSE Status: ${resp.status}`);
    if (resp.status === 200) console.log("✅ SSE Endpoint Confirmed!");
    else {
      const t = await resp.text();
      console.log("SSE Response:", t.substring(0, 200));
    }
  } catch (e) {
    console.log("SSE Failed");
  }
}

testConnection();
