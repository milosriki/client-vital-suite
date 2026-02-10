import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "dotenv";
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyLead() {
  console.log("🕵️ VERIFYING LEAD INSERTION...");

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("email", "coolrobot@hubspot.com")
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching lead:", error);
    return;
  }

  if (data) {
    console.log(
      "✅ LEAD FOUND:",
      data.email,
      "| Source:",
      data.source,
      "| Status:",
      data.status,
    );
    console.log("Full Record:", data);
  } else {
    console.error("❌ LEAD NOT FOUND");
  }
}

verifyLead();
