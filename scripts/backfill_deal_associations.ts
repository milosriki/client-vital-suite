import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

// BACKFILL V3: Associations API + Direct UUID Update
// The CORRECT way to sync old deals.

async function backfill() {
  console.log("💉 Starting Association Backfill V3 (Associations API)...");

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

  if (!HUBSPOT_KEY) throw new Error("No HUBSPOT_API_KEY found.");

  // 1. Get Deals checking recent ones first
  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, hubspot_deal_id, deal_name")
    .is("contact_id", null) // Only broken links
    .order("created_at", { ascending: false })
    .limit(200);

  if (!deals || deals.length === 0) {
    console.log("✅ No unlinked deals found.");
    return;
  }

  console.log(`Processing batch of ${deals.length} unlinked deals...`);

  // 2. Prepare Match Inputs
  // Only process valid HS IDs
  const validDeals = deals.filter(
    (d) => d.hubspot_deal_id && /^\d+$/.test(d.hubspot_deal_id),
  );
  const inputs = validDeals.map((d) => ({ id: d.hubspot_deal_id }));

  if (inputs.length === 0) {
    console.log("No valid HS IDs.");
    return;
  }

  // 3. Call HubSpot ASSOCIATIONS API
  console.log("📡 Asking HubSpot for associations (Associations API)...");
  const hsResp = await fetch(
    "https://api.hubapi.com/crm/v3/associations/deals/contacts/batch/read",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: inputs }),
    },
  );

  if (!hsResp.ok) {
    console.error("HubSpot API Error:", await hsResp.text());
    return;
  }

  const hsData = await hsResp.json();
  const results = hsData.results || [];

  // 4. Map Deal -> Contact HS ID
  const dealToContactMap: Record<string, string> = {}; // deal_hs_id -> contact_hs_id
  const hsContactIds = new Set<string>();

  results.forEach((r: any) => {
    const dealId = r.from.id;
    const contactId = r.to?.[0]?.id; // Take first
    if (contactId) {
      hsContactIds.add(contactId);
      dealToContactMap[dealId] = contactId;
    }
  });

  if (hsContactIds.size === 0) {
    console.log(
      "⚠️ HubSpot returned NO associations. These deals might really be orphans.",
    );
    return;
  }
  console.log(`✅ Found ${hsContactIds.size} associated contacts.`);

  // 5. Query Supabase for UUIDs
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, hubspot_contact_id")
    .in("hubspot_contact_id", Array.from(hsContactIds));

  const hsIdToUuid: Record<string, string> = {};
  contacts?.forEach((c) => {
    hsIdToUuid[c.hubspot_contact_id] = c.id;
  });

  // 6. Update Deals
  let updates = 0;
  for (const d of deals) {
    const hsContactId = dealToContactMap[d.hubspot_deal_id];
    if (hsContactId) {
      const uuid = hsIdToUuid[hsContactId];
      if (uuid) {
        const { error: upErr } = await supabase
          .from("deals")
          .update({ contact_id: uuid })
          .eq("id", d.id);

        if (!upErr) {
          updates++;
          process.stdout.write("🔗");
        }
      } else {
        process.stdout.write("❌"); // Contact not in DB
      }
    } else {
      process.stdout.write("."); // No Association
    }
  }

  console.log(
    `\n✅ Backfill Complete. Linked ${updates}/${deals.length} deals.`,
  );
}

backfill();
