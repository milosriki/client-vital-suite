const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUBSPOT_API_KEY =
  process.env.HUBSPOT_API_KEY || process.env.VITE_HUBSPOT_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !HUBSPOT_API_KEY) {
  console.error("❌ Missing Credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(
    "🦅 Force Syncing HubSpot Data (Search API - Last 100 Modified) [V4]...",
  );

  try {
    const searchBody = {
      filterGroups: [],
      sorts: [
        {
          propertyName: "lastmodifieddate",
          direction: "DESCENDING",
        },
      ],
      properties: [
        "dealname",
        "amount",
        "dealstage",
        "closedate",
        "pipeline",
        "createdate",
      ],
      limit: 100,
      after: 0,
    };

    console.log("💼 Fetching Deals from HubSpot...");
    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/deals/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      },
    );

    if (!response.ok) {
      throw new Error(
        `HubSpot API Error: ${response.status} ${response.statusText} - ${await response.text()}`,
      );
    }

    const data = await response.json();
    console.log(
      `✅ Found ${data.total} deals in HubSpot (Syncing top ${data.results.length})...`,
    );

    let syncedCount = 0;
    for (const [index, deal] of data.results.entries()) {
      const props = deal.properties;

      const payload = {
        hubspot_deal_id: deal.id,
        deal_name: props.dealname,
        amount: props.amount,
        deal_value: props.amount ? parseFloat(props.amount) : 0, // FIX: Map amount to deal_value
        stage: props.dealstage,
        close_date: props.closedate,
        pipeline: props.pipeline,
        created_at: props.createdate,
      };

      if (index === 0) {
        console.log("🔍 DEBUG: First Payload Keys:", Object.keys(payload));
      }

      const { error } = await supabase
        .from("deals")
        .upsert(payload, { onConflict: "hubspot_deal_id" });

      if (error) {
        console.error(`❌ Failed to sync deal ${deal.id}:`, error.message);
      } else {
        syncedCount++;
      }
    }

    console.log(`🎉 Synced ${syncedCount} / ${data.results.length} deals.`);
  } catch (err) {
    console.error("\n❌ Unexpected Error:", err);
  }
}

main();
