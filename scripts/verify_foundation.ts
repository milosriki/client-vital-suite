import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const env = config({ path: "./.env" });
const SUPABASE_URL = env.VITE_SUPABASE_URL || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY || Deno.env.get("VITE_SUPABASE_ANON_KEY");
// Use PROJECT_REF from URL if possible, or string logic
const PROJECT_REF = "ztjndilxurtsfqdsvfds";
const FUNCTION_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Env Vars");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAgentManager() {
  console.log("🧠 Testing Agent Manager...");
  try {
    const res = await fetch(`${FUNCTION_BASE}/agent-manager`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "check revenue for today" }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(
        "✅ Agent Manager Success:",
        data ? "Response Received" : "Empty",
      );
      // console.log(JSON.stringify(data).slice(0, 100));
    } else {
      console.error("❌ Agent Manager Failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("❌ Agent Manager Error:", e);
  }
}

async function testWhatsAppWebhook() {
  console.log("💬 Testing WhatsApp Webhook (Simulated)...");
  try {
    const payload = [
      {
        subscriptionType: "conversation.newMessage",
        objectId: 12345,
        propertyName: "conversations_thread",
        propertyValue: "sample message",
        eventId: 100,
        appId: 123,
      },
    ];

    const res = await fetch(`${FUNCTION_BASE}/hubspot-webhook-receiver`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log("✅ Webhook Success: 200 OK");
      // We can't easily verify the background trigger without checking logs or side effects,
      // but 200 OK means it processed the specific block we added.
    } else {
      console.error("❌ Webhook Failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("❌ Webhook Error:", e);
  }
}

async function run() {
  await testAgentManager();
  await testWhatsAppWebhook();
}

run();
