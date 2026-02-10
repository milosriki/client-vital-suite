import { config } from "dotenv";
config();

async function getHubSpotId() {
  const token = process.env.HUBSPOT_API_KEY; // "pat-na1-..."
  if (!token) {
    console.error("Missing HUBSPOT_API_KEY");
    return;
  }

  // Use headers for Private App Token
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  console.log("Fetching one contact from HubSpot...");
  const res = await fetch(
    "https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=email",
    {
      headers,
    },
  );

  if (!res.ok) {
    console.error("Error:", res.status, await res.text());
    return;
  }

  const data = await res.json();
  if (data.results && data.results.length > 0) {
    console.log("Found Contact:", data.results[0]);
    console.log("ID:", data.results[0].id);
    console.log("Email:", data.results[0].properties?.email);
  } else {
    console.log("No contacts found in HubSpot.");
  }
}

getHubSpotId();
