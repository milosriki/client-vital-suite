import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistory() {
  console.log("🔍 Auditing Recent Lisa Interactions...");

  const { data, error } = await supabase
    .from("whatsapp_interactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error fetching history:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("⚠️ No recent interactions found.");
    return;
  }

  console.log(`✅ Found ${data.length} recent interactions:`);
  data.forEach((row: any) => {
    console.log(
      `\n[${new Date(row.created_at).toLocaleString()}] ${row.phone_number}`,
    );
    console.log(`USER: ${row.message_text}`);
    console.log(`LISA: ${row.response_text}`);
    if (row.metadata) {
      console.log(`METADATA: ${JSON.stringify(row.metadata)}`);
    }
  });
}

checkHistory();
