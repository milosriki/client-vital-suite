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

async function runDiagnostics() {
  console.log("\n🏥 Running Chat Doctor Diagnostics...\n");

  // 1. Check Agent Conversations Table
  try {
    const { count, error } = await supabase.from('agent_conversations').select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`✅ 'agent_conversations' table accessible. Total conversations: ${count}`);
  } catch (e) {
    console.error(`❌ 'agent_conversations' check failed: ${e.message}`);
  }

  // 2. Check Agent Memory (Vector Store)
  try {
    const { count, error } = await supabase.from('agent_memory').select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`✅ 'agent_memory' table accessible. Total memories: ${count}`);
  } catch (e) {
    console.error(`❌ 'agent_memory' check failed: ${e.message}`);
  }

  // 3. Check Edge Function Reachability (ptd-agent-gemini)
  console.log("\n🤖 Testing 'ptd-agent-gemini' connectivity...");
  try {
    const { data, error } = await supabase.functions.invoke('ptd-agent-gemini', {
      body: { 
        message: "Ping. This is a health check.", 
        thread_id: "health-check-123",
        dry_run: true // If your agent supports this, otherwise it might generate a real reply
      }
    });
    
    if (error) {
        console.error(`❌ Agent invocation failed: ${error.message}`);
        // Often 500 errors here mean the function crashed or env vars are missing on the server
        if (error.context) console.error(`   Context: ${JSON.stringify(error.context)}`);
    } else {
        console.log(`✅ Agent responded successfully.`);
        // console.log(`   Response preview: ${JSON.stringify(data).substring(0, 100)}...`);
    }
  } catch (e) {
    console.error(`❌ Unexpected error invoking agent: ${e.message}`);
  }

  console.log("\n✅ Diagnostics complete.");
}

runDiagnostics();
