import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { executeSharedTool } from "../supabase/functions/_shared/tool-executor.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAuditTool() {
  console.log("🔍 Verifying 'system_error_audit' tool...");

  const input = {
    action: "analyze_error_patterns",
    days: 1,
  };

  try {
    const result = await executeSharedTool(
      supabase,
      "system_error_audit",
      input,
    );
    console.log("✅ Tool Execution Result:");
    console.log(result.slice(0, 500) + "..."); // Truncate for readability

    if (result.includes("Tool system_error_audit not found")) {
      console.error("❌ Tool Registration Failed!");
      Deno.exit(1);
    }
  } catch (e) {
    console.error("❌ Verification Failed:", e);
    Deno.exit(1);
  }
}

verifyAuditTool();
