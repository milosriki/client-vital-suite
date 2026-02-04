const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUBSPOT_API_KEY =
  process.env.HUBSPOT_API_KEY || process.env.VITE_HUBSPOT_ACCESS_TOKEN; // Check naming

if (!SUPABASE_URL || !SUPABASE_KEY || !HUBSPOT_API_KEY) {
  console.error("❌ Missing Credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(
    "🦅 Force Syncing HubSpot Data (Search API - Last 100 Modified)...",
  );

  try {
    // Search Body for Deals
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
        "hubspot_owner_id",
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

    // DEBUG SCHEMA
    const { data: sampleDeals } = await supabase
      .from("deals")
      .select("*")
      .limit(1);
    if (sampleDeals && sampleDeals.length > 0) {
      console.log(
        "🔍 Deals Schema Keys:",
        Object.keys(sampleDeals[0]).join(", "),
      );
    }

    let syncedCount = 0;
    for (const deal of data.results) {
      const props = deal.properties;

      const payload = {
        id: deal.id,
        deal_name: props.dealname,
        amount: props.amount,
        stage: props.dealstage,
        close_date: props.closedate,
        pipeline: props.pipeline,
        created_at: props.createdate,
        // hubspot_owner_id: props.hubspot_owner_id // COMMENTED OUT TO UNBLOCK SYNC
      };

      const { error } = await supabase.from("deals").upsert(payload);

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
