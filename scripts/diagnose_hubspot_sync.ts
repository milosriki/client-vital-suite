
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSyncErrors() {
  console.log("--- Checking Recent Sync Errors ---");
  const { data: errors, error } = await supabase
    .from('sync_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching sync_errors:", error);
  } else {
    if (errors.length === 0) {
      console.log("No recent sync errors found.");
    } else {
      errors.forEach(e => {
        console.log(`[${e.created_at}] ${e.source} -> ${e.error_type}: ${e.error_message}`);
      });
    }
  }
}

async function checkCronLogs() {
  console.log("\n--- Checking Cron Job Runs (via SQL) ---");
  // We can't access cron schema directly via JS client usually, unless we use rpc
  // Trying to use a raw SQL query via an RPC function if available, or just skipping if not.
  // We'll check if there's an RPC for executing SQL or inspecting logs.
  
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10"
  });

  if (error) {
    console.log("Could not fetch cron logs (RPC 'execute_sql' might be missing or restricted).");
    console.log("Error:", error.message);
  } else {
    console.log(data);
  }
}

async function checkBatchJobStatus() {
    console.log("\n--- Checking Batch Job Status ---");
    const { data, error } = await supabase
        .from('batch_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
    if (error) {
        console.log("Error fetching batch_jobs:", error.message);
    } else {
        if (data.length === 0) console.log("No recent batch jobs.");
        data.forEach(job => {
            console.log(`[${job.created_at}] ${job.batch_name}: ${job.status} (Events: ${job.events_count})`);
        });
    }
}

async function main() {
  await checkSyncErrors();
  await checkBatchJobStatus();
  // await checkCronLogs(); // Often fails due to permissions, can try if needed
}

main();
