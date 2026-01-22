import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// --- ENV VAR PARSING ---
function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'" ) && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  });
  return result;
}

const envLocal = parseEnv('.env.local');
const env = parseEnv('.env');
const allEnv = { ...env, ...envLocal, ...process.env };
const SUPABASE_URL = allEnv.VITE_SUPABASE_URL || allEnv.SUPABASE_URL;
const SUPABASE_KEY = allEnv.VITE_SUPABASE_PUBLISHABLE_KEY || allEnv.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase keys.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDataQuality() {
  console.log("🔍 Checking Data Quality & Freshness...\n");

  const today = new Date().toISOString().split('T')[0];
  console.log(`📅 Today's Date: ${today}\n`);

  // 1. Check client_health_scores (Dashboard Clients)
  console.log("--- 1. Client Health Scores ---");
  const { data: latestScore, error: scoreError } = await supabase
    .from('client_health_scores')
    .select('calculated_on, created_at')
    .order('calculated_on', { ascending: false })
    .limit(1);
  
  if (scoreError) console.error("Error:", scoreError.message);
  else if (latestScore?.length) {
    console.log(`✅ Latest Calculation: ${latestScore[0].calculated_on}`);
    console.log(`   Latest Created At: ${latestScore[0].created_at}`);
  } else {
    console.log("⚠️ No health scores found.");
  }

  // 2. Check daily_business_metrics (Executive Briefing)
  console.log("\n--- 2. Daily Business Metrics ---");
  const { data: dailyMetrics, error: metricsError } = await supabase
    .from('daily_business_metrics')
    .select('date, total_revenue_booked')
    .order('date', { ascending: false })
    .limit(1);

  if (metricsError) console.error("Error:", metricsError.message);
  else if (dailyMetrics?.length) {
    console.log(`✅ Latest Metric Date: ${dailyMetrics[0].date}`);
    console.log(`   Revenue Booked: ${dailyMetrics[0].total_revenue_booked}`);
  } else {
    console.log("⚠️ No daily metrics found.");
  }

  // 3. Check deals (Sales Pipeline) - Using 'dealname' or 'deal_name'
  console.log("\n--- 3. Deals (Pipeline) ---");
  let { data: latestDeal, error: dealError } = await supabase
    .from('deals')
    .select('created_at, dealname')
    .order('created_at', { ascending: false })
    .limit(1);

  if (dealError) {
      // Fallback to deal_name or deal_stage
      const { data: latestDeal2, error: dealError2 } = await supabase
        .from('deals')
        .select('created_at, deal_name') // Try deal_name
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (dealError2) console.error("Error (Deals):", dealError.message, "|", dealError2.message);
      else latestDeal = latestDeal2;
  }

  if (latestDeal?.length) {
    console.log(`✅ Newest Deal: ${latestDeal[0].created_at}`);
    // Handle either column name
    const name = latestDeal[0].dealname || latestDeal[0].deal_name || "Unknown";
    console.log(`   Name: ${name}`);
  } else if (!dealError) {
    console.log("⚠️ No deals found.");
  }

  // 4. Check facebook_ads_insights (Marketing) - Using 'date'
  console.log("\n--- 4. Facebook Ads Data ---");
  const { data: fbData, error: fbError } = await supabase
    .from('facebook_ads_insights')
    .select('date, spend')
    .order('date', { ascending: false })
    .limit(1);

  if (fbError) console.error("Error (FB):", fbError.message);
  else if (fbData?.length) {
    console.log(`✅ Latest FB Insight: ${fbData[0].date}`);
    console.log(`   Spend: ${fbData[0].spend}`);
  } else {
    console.log("⚠️ No Facebook insights found.");
  }

  // 5. Agent Memory (AI Readiness)
  console.log("\n--- 5. Agent Memory ---");
  const { data: memoryData, error: memoryError } = await supabase
      .from('agent_memory')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
      
  if (memoryError) console.error("Error:", memoryError.message);
  else if (memoryData?.length) {
      console.log(`✅ Latest Memory: ${memoryData[0].created_at}`);
  } else {
      console.log("⚠️ No agent memories found.");
  }
}

checkDataQuality();
