import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

// SYNC RECENT CONTACTS LOCALLY (Using Search)
async function syncContacts() {
  console.log("📥 Starting Local Contact Sync (Recent - Search API)...");

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

  async function searchHubSpotContacts(after?: string) {
    const url = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
    const body = {
      filterGroups: [],
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "mobilephone",
        "createdate",
        "lastmodifieddate",
      ],
      limit: 100,
      after: after,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return resp.json();
  }

  let after = undefined;
  let total = 0;

  // Sync 50 batches (5000 recent contacts)
  for (let i = 0; i < 50; i++) {
    const data: any = await searchHubSpotContacts(after);
    const contacts = data.results || [];
    if (contacts.length === 0) break;

    const upsertData = contacts.map((c: any) => ({
      first_name: c.properties.firstname,
      last_name: c.properties.lastname,
      email: c.properties.email,
      phone: c.properties.phone || c.properties.mobilephone,
      hubspot_contact_id: c.id,
      created_at: c.properties.createdate,
      updated_at: c.properties.lastmodifieddate,
    }));

    const { error } = await supabase
      .from("contacts")
      .upsert(upsertData, { onConflict: "hubspot_contact_id" });

    if (error) {
      // Ignore email unique constraint errors, just log count
      if (!error.message.includes("contacts_email_unique"))
        console.error("Upsert Error:", error.message);
    } else {
      total += contacts.length;
      process.stdout.write(`+${contacts.length} `);
    }

    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;
  }

  console.log(`\n✅ Synced ${total} RECENT contacts.`);
}

syncContacts();
