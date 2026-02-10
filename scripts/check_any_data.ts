import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { config } from "dotenv";
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function checkAnyData() {
  console.log("🕵️ CHECKING FOR ANY LEADS/DEALS...");

  const { data: leads } = await supabase
    .from("leads")
    .select("created_at, status, source")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: deals } = await supabase
    .from("deals")
    .select("created_at, amount, stage")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("Latest Leads:", leads);
  console.log("Latest Deals:", deals);
}

checkAnyData();
