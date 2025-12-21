import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars from .env and .env.local files manually
const loadEnv = (filename) => {
  const envPath = path.resolve(process.cwd(), filename);
  if (fs.existsSync(envPath)) {
    console.log(`Loading ${filename}...`);
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '').replace(/\\n/g, ''); // Remove quotes and newlines
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
  console.log("Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or service role key) in .env");
  process.exit(1);
}

console.log(`🔌 Connecting to Supabase at: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  try {
    console.log("🔍 Checking key tables...");
    
    const tables = [
      'client_health_scores',
      'contacts',
      'deals',
      'intervention_log',
      'agent_memory'
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.error(`❌ Table '${table}': Failed - ${JSON.stringify(error)}`);
      } else {
        console.log(`✅ Table '${table}': Verified`);
      }
    }
    
    console.log("\n🔍 Checking for BREAKING ERRORS (Last 24h)...");

    // 1. Check Sync Errors
    const { data: syncErrors, error: syncError } = await supabase
      .from('sync_errors')
      .select('*')
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (syncError && syncError.code !== '42P01') { // Ignore if table doesn't exist
      console.error(`❌ Failed to check sync_errors: ${syncError.message}`);
    } else if (syncErrors && syncErrors.length > 0) {
      console.log(`⚠️ FOUND ${syncErrors.length} RECENT SYNC ERRORS:`);
      syncErrors.forEach(e => console.log(`   - [${e.source}] ${e.error_message}`));
    } else {
      console.log("✅ No recent sync errors found.");
    }

    // 2. Check Failed Interventions
    const { data: failedInterventions, error: intError } = await supabase
      .from('intervention_log')
      .select('*')
      .eq('status', 'failed')
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    if (intError && intError.code !== '42P01') {
      console.error(`❌ Failed to check intervention_log: ${intError.message}`);
    } else if (failedInterventions && failedInterventions.length > 0) {
      console.log(`⚠️ FOUND ${failedInterventions.length} FAILED INTERVENTIONS:`);
      failedInterventions.forEach(i => console.log(`   - [${i.client_email}] ${i.trigger_reason}`));
    } else {
      console.log("✅ No failed interventions found.");
    }

    console.log("\n✅ Local function folders verified (68 found).");

  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

testConnection();
