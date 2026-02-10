import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditDialogflowLogs() {
  console.log("🔍 AUDITING DIALOGFLOW (whatsapp_interactions)...\n");

  const { data: logs, error } = await supabase
    .from("whatsapp_interactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ Error fetching logs:", error);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("⚠️ No logs found in 'whatsapp_interactions'.");
    return;
  }

  console.log(`Found ${logs.length} interactions.\n`);

  logs.forEach((log: any, index: number) => {
    console.log(`--- [INTERACTION ${index + 1}] ---`);
    console.log(`🕒 Time: ${new Date(log.created_at).toLocaleString()}`);
    console.log(`📱 Phone: ${log.phone_number}`);
    console.log(`👤 User: "${log.message_text}"`);
    console.log(`🤖 Bot: "${log.response_text.slice(0, 300)}..."`);
    console.log("----------------------------------\n");
  });
}

auditDialogflowLogs();
