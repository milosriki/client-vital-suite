import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

// SYNC CONTACTS LOCALLY (With Correct Mapping)
async function syncContacts() {
  console.log("📥 Starting Local Contact Sync (Corrected)...");

  // Load Env
  const envPath = join(process.cwd(), ".env.local");
  const content = await readFile(envPath, "utf-8");
  const validKeys = content
    .split("\n")
    .filter((l) => l.includes("="))
    .reduce((acc, line) => {
      const [k, v] = line.split("=");
      acc[k] = v.replace(/"/g, "");
      return acc;
    }, {} as any);

  const supabase = createClient(
    validKeys.SUPABASE_URL,
    validKeys.SUPABASE_SERVICE_ROLE_KEY,
  );
  const HUBSPOT_KEY = validKeys.HUBSPOT_API_KEY;

  async function fetchHubSpotContacts(after?: string) {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,mobilephone,hs_object_id,createdate,lastmodifieddate${after ? `&after=${after}` : ""}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}` },
    });
    return resp.json();
  }

  let after = undefined;
  let total = 0;

  // Process up to 10k contacts to find missing ones
  for (let i = 0; i < 100; i++) {
    const data: any = await fetchHubSpotContacts(after);
    const contacts = data.results || [];
    if (contacts.length === 0) break;

    const upsertData = contacts.map((c: any) => ({
      first_name: c.properties.firstname, // Fixed
      last_name: c.properties.lastname, // Fixed
      email: c.properties.email,
      phone: c.properties.phone || c.properties.mobilephone,
      hubspot_contact_id: c.id,
      created_at: c.properties.createdate,
      updated_at: c.properties.lastmodifieddate,
    }));

    // Search for Marko in this batch
    const marko = contacts.find(
      (c: any) =>
        c.properties.firstname?.toLowerCase().includes("marko") &&
        c.properties.lastname?.toLowerCase().includes("antic"),
    );
    if (marko)
      console.log(`🎯 FOUND MARKO ANTIC in Batch ${i}! ID: ${marko.id}`);

    // Upsert
    const { error } = await supabase
      .from("contacts")
      .upsert(upsertData, { onConflict: "hubspot_contact_id" });

    if (error) {
      console.error("Upsert Error:", error.message);
    } else {
      total += contacts.length;
      process.stdout.write(`+${contacts.length} `);
    }

    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;
  }

  console.log(`\n✅ Synced ${total} contacts.`);
}

syncContacts();
