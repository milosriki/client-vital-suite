import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditErrors() {
  console.log("🕵️ Auditing Supabase Error Logs...");

  // Check sync_logs
  console.log("\n--- Sync Logs (Last 24h) ---");
  const { data: syncLogs, error: syncError } = await supabase
    .from("sync_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  if (syncError) console.error("Error fetching sync_logs:", syncError.message);
  else if (syncLogs.length === 0) console.log("No recent sync logs found.");
  else {
    syncLogs.forEach((log) => {
      console.log(
        `[${log.platform}] ${log.sync_type} - ${log.status} (${log.started_at})`,
      );
      if (log.error_details)
        console.log(`   Errors: ${JSON.stringify(log.error_details)}`);
    });
  }

  // Check generic error logs table (if exists - usually 'error_logs' or 'app_errors')
  console.log("\n--- Application Errors (Last 24h) ---");
  // Try 'error_logs'
  const { data: appErrors, error: appError } = await supabase
    .from("error_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (appError) {
    console.log(
      "Could not fetch 'error_logs' (Table likely doesn't exist or diff name).",
    );
  } else {
    appErrors.forEach((err) => {
      console.log(`[${err.severity}] ${err.message} (${err.context})`);
    });
  }
}

auditErrors();
