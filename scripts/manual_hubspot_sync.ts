import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import * as dotenv from "dotenv";
import path from "path";

// Load env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const HUBSPOT_KEY = process.env.HUBSPOT_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !HUBSPOT_KEY) {
  console.error(
    "❌ Missing credentials (SUPABASE_URL, SUPABASE_KEY, or HUBSPOT_API_KEY)",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function searchHubSpot(query: string) {
  console.log(`🔎 Searching HubSpot for: "${query}"...`);
  try {
    const response = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "firstname",
                operator: "CONTAINS_TOKEN",
                value: query,
              },
            ],
          },
          {
            filters: [
              {
                propertyName: "lastname",
                operator: "CONTAINS_TOKEN",
                value: query,
              },
            ],
          },
        ],
        properties: [
          "email",
          "firstname",
          "lastname",
          "phone",
          "lifecyclestage",
        ],
        limit: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.results;
  } catch (error: any) {
    console.error(
      "❌ HubSpot Search Error:",
      error?.response?.data || error.message,
    );
    return [];
  }
}

async function syncToSupabase(contacts: any[]) {
  if (contacts.length === 0) {
    console.log("⚠️ No contacts found in HubSpot.");
    return;
  }

  console.log(`🔄 Syncing ${contacts.length} contacts to Supabase...`);

  for (const contact of contacts) {
    const { id, properties } = contact;
    const name =
      `${properties.firstname || ""} ${properties.lastname || ""}`.trim();
    const email = properties.email;

    console.log(`   Processing: ${name} (${email})`);

    // Upsert into clients table (assuming 'email' or 'hubspot_contact_id' is unique/key)
    // Adjust column names based on actual schema if known, guessing standard fields
    const payload = {
      hubspot_contact_id: id,
      name: name,
      email: email,
      status: properties.lifecyclestage,
      last_synced_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("clients")
      .upsert(payload, { onConflict: "email" }); // Assuming email is unique constraint

    if (error) {
      console.error(`   ❌ Failed to sync ${name}:`, error.message);
    } else {
      console.log(`   ✅ Synced ${name}`);
    }
  }
}

async function main() {
  const query = "Phil Dunn";
  const contacts = await searchHubSpot(query);
  await syncToSupabase(contacts);
}

main();
