import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('Verifying PTD Agent System Tables...');
  const tables = ['sync_logs', 'sync_queue', 'system_settings'];
  let allGood = true;

  for (const table of tables) {
    const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error) {
        if (error.code === '42P01') console.error(`❌ Table '${table}' DOES NOT EXIST.`);
        else console.error(`❌ Error '${table}':`, error.message);
        allGood = false;
    } else {
        console.log(`✅ Table '${table}' exists.`);
        
        if (table === 'sync_logs') {
             const { data: logs } = await supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(3);
             console.log('   👀 Recent Sync Logs:', logs);
        }
    }
  }

  const { error: rpcError } = await supabase.rpc('cleanup_old_logs');
  if (rpcError) {
      console.error(`❌ Function 'cleanup_old_logs' check warning:`, rpcError.message);
      // Not critical for verify
  } else {
      console.log(`✅ Function 'cleanup_old_logs' exists.`);
  }
}

verifyTables();
