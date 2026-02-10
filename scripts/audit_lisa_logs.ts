import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditLisaLogs() {
  console.log("🔍 AUDITING LISA'S MEMORY LOGS...\n");

  const { data: logs, error } = await supabase
    .from("agent_memory")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ Error fetching logs:", error);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("⚠️ No logs found in 'agent_memory'.");
    return;
  }

  console.log(`Found ${logs.length} recent interactions.\n`);

  logs.forEach((log: any, index: number) => {
    console.log(`--- [INTERACTION ${index + 1}] ---`);
    console.log(`🕒 Time: ${new Date(log.created_at).toLocaleString()}`);
    console.log(`👤 User: "${log.query}"`);
    console.log(
      `👩‍💼 Lisa: "${log.response.slice(0, 300)}${log.response.length > 300 ? "..." : ""}"`,
    );
    console.log(
      `🧠 Intent: ${JSON.stringify(log.knowledge_extracted?.detected_patterns || [])}`,
    );
    console.log("----------------------------------\n");
  });
}

auditLisaLogs();
