// Node.js Version of the Edge Function Logic
const PB_TOKEN = process.env.PIPEBOARD_API_KEY || "";
const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

async function callPipeboard(tool: string, args: any) {
  console.log(`\n📡 Pipeboard Call: ${tool}`);
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: Date.now(),
    params: { name: tool, arguments: args },
  };

  const resp = await fetch(PB_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok)
    throw new Error(`Pipeboard HTTP ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();

  if (json.error) throw new Error(`MCP Error: ${JSON.stringify(json.error)}`);
  if (json.result?.isError)
    throw new Error(`Tool Error: ${JSON.stringify(json.result.content)}`);

  const content = json.result?.content?.[0]?.text;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

async function run() {
  try {
    // 1. Get Ad Accounts
    console.log("1️⃣ Fetching Accounts...");
    const accounts = await callPipeboard("get_ad_accounts", { limit: 1 });
    console.log(`Response Type: ${typeof accounts}`);

    let accountList = [];
    if (Array.isArray(accounts)) accountList = accounts;
    else if (accounts && accounts.data) accountList = accounts.data;

    if (accountList.length === 0) {
      console.error("❌ No accounts found. Cannot proceed.");
      return;
    }

    const adAccountId = accountList[0].id;
    console.log(`✅ Found Account: ${adAccountId} (${accountList[0].name})`);

    // 2. Get Insights
    console.log("\n2️⃣ Fetching Insights (Last 30 Days)...");
    const insights = await callPipeboard("get_insights", {
      object_id: adAccountId,
      level: "campaign",
      time_range: "last_30d",
      limit: 5,
    });

    const data = Array.isArray(insights) ? insights : insights.data || [];
    console.log(`✅ Got ${data.length} campaign records.`);

    if (data.length > 0) {
      console.log("\nSample Campaign Stats:");
      console.log(JSON.stringify(data[0], null, 2));
    }

    console.log("\n✅ VERIFICATION COMPLETE: Pipeboard Integration Works!");
  } catch (e: any) {
    console.error("\n❌ TEST FAILED:", e.message);
  }
}

run();
