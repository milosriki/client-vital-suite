import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars manually
const loadEnv = (filename) => {
  const envPath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(envPath)) {
    console.log(`Loading ${filename}...`);
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '');
        process.env[key] = value;
      }
    });
  }
};

loadEnv('.env');
loadEnv('.env.local');
loadEnv('.env.production.local');
loadEnv('.env.vercel.local');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Supabase environment variables not found.");
  process.exit(1);
}

console.log(`🔌 Connecting to Supabase at: ${SUPABASE_URL}`);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getCoachMarinaClients() {
  console.log("\n🏊‍♀️ Finding Coach Marina's Clients and Their Scores...\n");

  try {
    // First, find clients assigned to coach Marina
    const { data: clients, error: clientsError } = await supabase
      .from('client_health_scores')
      .select('email, first_name, last_name, health_score, health_zone, churn_risk_score, engagement_score, momentum_score, assigned_coach')
      .ilike('assigned_coach', '%marina%')
      .order('health_score', { ascending: true });

    if (clientsError) throw clientsError;

    if (!clients || clients.length === 0) {
      console.log("❌ No clients found for Coach Marina");
      return;
    }

    console.log(`✅ Found ${clients.length} clients for Coach Marina:\n`);

    // Display results in a nice format
    clients.forEach((client, index) => {
      const healthZone = client.health_zone || 'UNKNOWN';
      const zoneEmoji = {
        'RED': '🔴',
        'YELLOW': '🟡',
        'GREEN': '🟢',
        'PURPLE': '🟣'
      }[healthZone] || '⚪';

      console.log(`${index + 1}. ${client.first_name} ${client.last_name} (${client.email})`);
      console.log(`   ${zoneEmoji} Health Zone: ${healthZone}`);
      console.log(`   📊 Health Score: ${client.health_score || 'N/A'}`);
      console.log(`   💔 Churn Risk: ${client.churn_risk_score || 'N/A'}%`);
      console.log(`   🎯 Engagement: ${client.engagement_score || 'N/A'}`);
      console.log(`   📈 Momentum: ${client.momentum_score || 'N/A'}\n`);
    });

    // Summary statistics
    const zones = clients.reduce((acc, client) => {
      const zone = client.health_zone || 'UNKNOWN';
      acc[zone] = (acc[zone] || 0) + 1;
      return acc;
    }, {});

    const avgHealth = clients.reduce((sum, client) => sum + (client.health_score || 0), 0) / clients.length;
    const avgChurn = clients.reduce((sum, client) => sum + (client.churn_risk_score || 0), 0) / clients.length;

    console.log("📈 SUMMARY STATISTICS:");
    console.log(`   Total Clients: ${clients.length}`);
    console.log(`   Average Health Score: ${avgHealth.toFixed(1)}`);
    console.log(`   Average Churn Risk: ${avgChurn.toFixed(1)}%`);
    console.log("   Health Zone Distribution:");
    Object.entries(zones).forEach(([zone, count]) => {
      console.log(`     ${zone}: ${count} clients`);
    });

  } catch (error) {
    console.error(`❌ Error querying coach data: ${error.message}`);
  }
}

getCoachMarinaClients();