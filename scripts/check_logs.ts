import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🔍 Fetching last 10 Dialogflow -> Supabase interactions...");

  const { data, error } = await supabase
    .from("whatsapp_interactions")
    .select("created_at, phone_number, message_text, response_text")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error fetching logs:", error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("⚠️ No interactions found in the logs yet.");
    console.log(
      "Tip: Ensure you have deployed the function and updated the Webhook URL in Dialogflow.",
    );
    return;
  }

  data.forEach((log) => {
    console.log("------------------------------------------------");
    console.log(`⏰ Time: ${new Date(log.created_at).toLocaleString()}`);
    console.log(`👤 User: ${log.phone_number}`);
    console.log(`📥 In:   ${log.message_text}`);
    console.log(`📤 Out:  ${log.response_text}`);
  });
  console.log("------------------------------------------------");
}

main();
