// scripts/analyze_lisa_performance.cjs
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Secrets in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzePerformance() {
  console.log("📊 Starting Real-World Performance Analysis...");

  // 1. Total Conversations (Unique Phones in whatsapp_interactions)
  // We fetch booking interactions to counting unique phones manually as .count(distinct) isn't straightforward in simple query
  const { data: interactions, error: chatError } = await supabase
    .from("whatsapp_interactions")
    .select("phone_number");

  if (chatError) {
    console.error("❌ Error fetching chats:", chatError);
    return;
  }

  const uniqueUsers = new Set(interactions.map((i) => i.phone_number));
  const totalLeads = uniqueUsers.size;

  console.log(`\n👥 Total Unique Leads Talked To: ${totalLeads}`);

  // 2. Verified Bookings (Appointments Table)
  const { count: bookingCount, error: bookingError } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true });

  if (bookingError) {
    console.error("❌ Error counting bookings:", bookingError);
  }

  // 3. Conversion Rate
  const conversionRate =
    totalLeads > 0 ? ((bookingCount / totalLeads) * 100).toFixed(2) : "0.00";
  console.log(`✅ Total Verified Bookings: ${bookingCount}`);
  console.log(`📈 Real Conversion Rate: ${conversionRate}%`);

  // 4. "Group Ready" Intelligence Check
  // User asked: "how does she know group is ready" -> Checking Knowledge Base
  const { data: knowledge, error: kError } = await supabase
    .from("agent_knowledge")
    .select("*")
    .ilike("content", "%group%");

  console.log(`\n🧠 Knowledge Check (Group Ready):`);
  if (knowledge && knowledge.length > 0) {
    knowledge.forEach((k) => console.log(`  - [${k.category}] ${k.title}`));
  } else {
    console.log(
      "  ⚠️ No explicit 'Group' knowledge found. She might be hallucinating this or using general training.",
    );
  }
}

analyzePerformance();
