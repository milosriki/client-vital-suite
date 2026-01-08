import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to parse .env file
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

async function run() {
  console.log("🔍 Scanning environment...");

  // Load env vars (simulating Vite/Next.js precedence)
  const envLocal = parseEnv('.env.local');
  const env = parseEnv('.env');
  const allEnv = { ...env, ...envLocal, ...process.env };

  let SUPABASE_URL = allEnv.VITE_SUPABASE_URL || allEnv.SUPABASE_URL || "https://ztjndilxurtsfqdsvfds.supabase.co";
  let SUPABASE_KEY = allEnv.VITE_SUPABASE_PUBLISHABLE_KEY || allEnv.VITE_SUPABASE_ANON_KEY || allEnv.SUPABASE_ANON_KEY || allEnv.SUPABASE_SERVICE_ROLE_KEY;

  // Extra sanitization
  if (SUPABASE_URL) SUPABASE_URL = SUPABASE_URL.replace(/[\r\n"']/g, '').trim();
  if (SUPABASE_KEY) SUPABASE_KEY = SUPABASE_KEY.replace(/[\r\n"']/g, '').trim();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env or .env.local");
    process.exit(1);
  }

  console.log(`🔌 Connecting to: '${SUPABASE_URL}'`);
  console.log(`🔑 Key found: '${SUPABASE_KEY.slice(0, 10)}...'`);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const tables = [
      'client_health_scores',
      'contacts',
      'deals',
      'intervention_log',
      'agent_memory'
    ];

    console.log("\n📊 Verifying Tables...");
    for (const table of tables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.error(`❌ ${table}: Error`);
        console.error(JSON.stringify(error, null, 2));
      } else {
        console.log(`✅ ${table}: Accessible (Count: ${count})`);
      }
    }
  } catch (err) {
    console.error("CRITICAL CLIENT ERROR:", err);
  }
}

run().catch(err => console.error("Fatal Error:", err));
