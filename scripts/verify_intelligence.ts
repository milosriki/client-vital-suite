import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await readFile(envPath, "utf-8");
  } catch (e) {
    console.error("Could not read .env.local");
    return;
  }
  const url = content.match(/SUPABASE_URL="([^"]+)"/)?.[1];
  const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)?.[1];

  if (!url || !key) {
    console.error("Missing keys");
    return;
  }

  const supabase = createClient(url, key);

  console.log("1. Checking deals link for Marko Antic...");
  // Find contact linked to 'Marko Antic'
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, hubspot_contact_id")
    .ilike("last_name", "Antic");

  console.log("Contacts found:", contacts);

  if (!contacts || contacts.length === 0) {
    console.log("Marko found? NO");
    return;
  }

  const marko = contacts[0];
  console.log("Marko's ID:", marko.id);

  // Check deals
  const { data: deals } = await supabase
    .from("deals")
    .select("deal_name, stage, deal_value")
    .eq("contact_id", marko.id);

  console.log("Deals found linked to Marko:", deals);

  // 1.5 PROACTIVE SYNC (The "Smart Sync" Test)
  console.log("Triggering Smart Sync for Marko (ID: 1859301)...");
  const { error: syncError } = await supabase.functions.invoke(
    "sync-single-contact",
    {
      body: { objectId: "1859301" }, // Marko's HubSpot ID
    },
  );
  if (syncError) console.error("Sync Error:", syncError);
  else console.log("Sync triggered successfully.");

  // Simulate AI Agent query
  console.log(
    "\n2. Invoking AI Agent with query 'How is Marko Antic performing?'...",
  );

  const { data: agentResponse, error: agentError } =
    await supabase.functions.invoke("ptd-agent-gemini", {
      body: {
        message: "How is performance for Marko Antic? Any deals?", // CHANGED 'query' to 'message'
        context: { mode: "sales_manager" }, // properly passed context
      },
    });

  if (agentError) {
    console.error("Agent Error:", agentError);
  } else {
    console.log("Agent Response:", agentResponse);
  }
}

run();
