import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "dotenv";
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function testUpsert() {
  console.log("🧪 TESTING DB UPSERT...");

  const payload = {
    email: "test_upsert_check@example.com",
    hubspot_id: "999999",
    source: "test_script",
  };

  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "hubspot_id" })
    .select();

  if (error) {
    console.error("❌ UPSERT FAILED:", error);
  } else {
    console.log("✅ UPSERT SUCCESS:", data);
    // Cleanup
    await supabase.from("leads").delete().eq("hubspot_id", "999999");
  }
}

testUpsert();
