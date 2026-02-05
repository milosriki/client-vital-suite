import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  try {
    const content = await readFile(envPath, "utf-8");
    const hubspotKey = content.match(/HUBSPOT_API_KEY="([^"]+)"/)![1];

    console.log(`✅ Found HubSpot Key. Querying CRM Logs...\n`);

    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/notes/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hubspotKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "hs_note_body",
                  operator: "CONTAINS_TOKEN",
                  value: "WhatsApp Chat",
                },
              ],
            },
          ],
          sorts: [
            {
              propertyName: "hs_createdate",
              direction: "DESCENDING",
            },
          ],
          limit: 5,
          properties: ["hs_note_body", "hs_createdate"],
        }),
      },
    );

    if (!response.ok) {
      console.error(`❌ HubSpot Search Failed: ${await response.text()}`);
      return;
    }

    const result = await response.json();
    const notes = result.results;

    if (!notes || notes.length === 0) {
      console.log("⚠️ No WhatsApp logs found in HubSpot.");
      return;
    }

    console.log(`Found ${notes.length} recent synced messages:\n`);

    notes.forEach((note: any) => {
      const time = new Date(note.properties.hs_createdate).toLocaleTimeString();
      const body = note.properties.hs_note_body || "";
      // Clean up the formatting for display
      const cleanBody = body
        .replace("📲 **WhatsApp Chat (Direct Path)**", "")
        .replace(/\*\*/g, "") // remove bold markers
        .trim();

      console.log(`[${time}] HubSpot Note Log`);
      console.log(cleanBody);
      console.log(`---------------------------------------------------`);
    });
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

run();
