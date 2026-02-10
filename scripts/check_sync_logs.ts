import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "dotenv";
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkSyncLogs() {
  console.log("🕵️ CHECKING SYNC LOGS...");

  const { data: logs, error } = await supabase
    .from("sync_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error fetching logs:", error);
    return;
  }

  console.table(logs);
}

checkSyncLogs();
