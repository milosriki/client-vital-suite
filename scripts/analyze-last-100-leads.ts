
import { HubSpotManager } from "../supabase/functions/_shared/hubspot-manager.ts";

const HUBSPOT_API_KEY = "pat-na1-7dc3217b-65d8-41c8-9281-730818836a5a";
const SUPABASE_URL = "https://ztjndilxurtsfqdsvfds.supabase.co";
const SUPABASE_KEY = "dummy"; // Not needed for this local fetch

async function main() {
  console.log("🚀 Starting HubSpot Deep Intelligence Extraction...");
  const hubspot = new HubSpotManager(HUBSPOT_API_KEY, SUPABASE_URL, SUPABASE_KEY);

  try {
    // 1. Fetch last 100 contacts
    console.log("📥 Fetching last 100 contacts...");
    const contactsRes = await hubspot.fetchContacts(100);
    const contacts = contactsRes.results || [];
    console.log(`✅ Found ${contacts.length} contacts.`);

    const enrichedData = [];

    // 2. Fetch notes and calls for each contact
    for (const contact of contacts) {
      const name = `${contact.properties.firstname || ""} ${contact.properties.lastname || ""}`.trim();
      console.log(`🔍 Processing: ${name || contact.id}...`);

      const [notes, calls] = await Promise.all([
        hubspot.fetchContactNotes(contact.id),
        hubspot.fetchContactCalls(contact.id)
      ]);

      enrichedData.push({
        id: contact.id,
        name,
        email: contact.properties.email,
        stage: contact.properties.lifecyclestage,
        notes: notes.map((n: any) => n.properties.hs_note_body),
        calls: calls.map((c: any) => ({
          title: c.properties.hs_call_title,
          body: c.properties.hs_call_body
        }))
      });
    }

    // 3. Save to artifact
    const outputPath = "./LEAD_INTELLIGENCE_RAW.json";
    await Deno.writeTextFile(outputPath, JSON.stringify(enrichedData, null, 2));
    console.log(`
🎉 EXTRACTION COMPLETE! Data saved to ${outputPath}`);
    console.log("Next step: Run 'gemini criticalthink analyze LEAD_INTELLIGENCE_RAW.json'");

  } catch (error) {
    console.error("❌ Extraction Failed:", error);
  }
}

main();
