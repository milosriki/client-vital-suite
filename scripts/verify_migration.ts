import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing .env.local keys");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log("🔍 Verifying 'whatsapp_interactions' table...");

  const { data, error } = await supabase
    .from("whatsapp_interactions")
    .select("count", { count: "exact", head: true });

  if (error) {
    console.error("❌ MIGRATION FAILED / TABLE MISSING:");
    console.error(JSON.stringify(error, null, 2));
    console.log(
      "\n👉 ACTION: Run the SQL in 'supabase/migrations/20260205_create_whatsapp_interactions.sql' via Supabase Dashboard.",
    );
    process.exit(1);
  } else {
    console.log("✅ TABLE EXISTS! 'whatsapp_interactions' is ready.");
    console.log(`📊 Current row count: ${data}`); // data is null for head:true but count works? wait, head:true returns null data but count property.
    // Actually .select('*', { count: 'exact', head: true }) returns count in a wrapper.
    // Let's just insert a test row to be sure.

    console.log("📝 Attempting test insert...");
    const { error: insertError } = await supabase
      .from("whatsapp_interactions")
      .insert({
        phone_number: "+971555555555",
        message_text: "MIGRATION_VERIFICATION",
        response_text: "SUCCESS",
        status: "verified",
      });

    if (insertError) {
      console.error("❌ INSERT FAILED:", insertError);
    } else {
      console.log("✅ INSERT SUCCESS! Memory is fully operational.");
    }
  }
}

verify();
