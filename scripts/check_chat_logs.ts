import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

async function run() {
  const envPath = join(process.cwd(), ".env.local");
  try {
    const content = await readFile(envPath, "utf-8");
    const url = content.match(/SUPABASE_URL="([^"]+)"/)![1];
    const key = content.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)![1];
    const supabase = createClient(url, key);

    console.log(`✅ Connected to Supabase logs.\n`);

    console.log(
      "🔍 Fetching last 20 interactions from 'whatsapp_interactions'...",
    );
    const { data: logs, error } = await supabase
      .from("whatsapp_interactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("❌ Error fetching logs:", error.message);
      return;
    }

    if (!logs || logs.length === 0) {
      console.log("⚠️ No logs found in 'whatsapp_interactions'.");
      return;
    }

    console.log(`\nFound ${logs.length} recent messages:\n`);

    logs.reverse().forEach((log) => {
      const time = new Date(log.created_at).toLocaleTimeString();
      console.log(`[${time}] ${log.phone_number}`);
      console.log(`User: ${log.message_text}`);
      console.log(`AI:   ${log.response_text}`);
      console.log(`---------------------------------------------------`);
    });
  } catch (err) {
    console.error("❌ Failed to read .env.local or connect:", err);
  }
}

run();
