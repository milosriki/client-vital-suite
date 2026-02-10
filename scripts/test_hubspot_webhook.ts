import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "dotenv";
config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testWebhook() {
  console.log("⚡️ SIMULATING HUBSPOT WEBHOOK (Contact Creation)...");

  const payload = [
    {
      eventId: "100",
      subscriptionType: "contact.creation", // This is what HubSpot sends for new leads
      objectId: 1, // Real HubSpot ID found via script
      propertyName: "email",
      propertyValue: "coolrobot@hubspot.com",
      occurredAt: Date.now(),
      attemptNumber: 0,
    },
  ];

  const functionUrl = `${SUPABASE_URL}/functions/v1/hubspot-webhook`;

  console.log(`POST ${functionUrl}`);

  const res = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, // Simulating auth if needed, or bypass
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log("Response Status:", res.status);
  console.log("Response Body:", text);
}

testWebhook();
