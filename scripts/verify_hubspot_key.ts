import { config } from "dotenv";
config();

async function verifyHubSpot() {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) {
    console.error("❌ HUBSPOT_API_KEY not found in env");
    process.exit(1);
  }

  console.log("🔑 Testing HubSpot API Key...");

  try {
    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      console.log("✅ HubSpot API Key is VALID!");
      const data = await response.json();
      console.log(`   Found ${data.total || data.results?.length} contacts.`);
    } else {
      console.error(
        `❌ HubSpot API Error: ${response.status} ${response.statusText}`,
      );
      const body = await response.text();
      console.error(body);
    }
  } catch (error) {
    console.error("❌ Network/Script Error:", error);
  }
}

verifyHubSpot();
