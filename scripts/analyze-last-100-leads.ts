import { HubSpotManager } from "../supabase/functions/_shared/hubspot-manager.ts";

const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "dummy";

async function main() {
  console.log("🚀 Starting HubSpot Deep Intelligence Extraction...");
  const hubspot = new HubSpotManager(
    HUBSPOT_API_KEY,
    SUPABASE_URL,
    SUPABASE_KEY,
  );

  try {
    // 1. Fetch last 100 contacts
    console.log("📥 Fetching last 100 contacts...");
    const contactsRes = await hubspot.fetchContacts(100);
    const contacts = contactsRes.results || [];
    console.log(`✅ Found ${contacts.length} contacts.`);

    const enrichedData = [];

    // 2. Fetch notes and calls for each contact
    for (const contact of contacts) {
      const name =
        `${contact.properties.firstname || ""} ${contact.properties.lastname || ""}`.trim();
      console.log(`🔍 Processing: ${name || contact.id}...`);

      const [notes, calls] = await Promise.all([
        hubspot.fetchContactNotes(contact.id),
        hubspot.fetchContactCalls(contact.id),
      ]);

      enrichedData.push({
        id: contact.id,
        name,
        email: contact.properties.email,
        stage: contact.properties.lifecyclestage,
        notes: notes.map((n: any) => n.properties.hs_note_body),
        calls: calls.map((c: any) => ({
          title: c.properties.hs_call_title,
          body: c.properties.hs_call_body,
        })),
      });
    }

    // 3. Save to artifact
    const outputPath = "./LEAD_INTELLIGENCE_RAW.json";
    await Deno.writeTextFile(outputPath, JSON.stringify(enrichedData, null, 2));
    console.log(`
🎉 EXTRACTION COMPLETE! Data saved to ${outputPath}`);
    console.log(
      "Next step: Run 'gemini criticalthink analyze LEAD_INTELLIGENCE_RAW.json'",
    );
  } catch (error) {
    console.error("❌ Extraction Failed:", error);
  }
}

main();
