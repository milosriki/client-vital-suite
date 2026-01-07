
import { checkLangSmithStatus, traceStart, traceEnd } from "../supabase/functions/_shared/langsmith-tracing.ts";

// Mock Deno.env for the local script context if needed, 
// but we will rely on loading .env file or passing vars when running.
// Since we are running with `deno run`, we can pass env vars.

async function testTracing() {
  console.log("🔍 Testing LangSmith Connection...");

  // 1. Check Configuration Status
  const status = await checkLangSmithStatus();
  console.log("Status Check Result:", status);

  if (!status.connected) {
    console.error("❌ Failed to connect to LangSmith API.");
    if (status.error) console.error("Error details:", status.error);
    return;
  }

  console.log("✅ Connection Successful!");
  console.log(`   Project: ${status.projectName}`);
  console.log(`   Endpoint: ${status.endpoint}`);

  // 2. Try to send a real trace
  console.log("\n🚀 Sending Test Trace...");
  const run = await traceStart({
    name: "CLI_Test_Trace",
    runType: "chain",
    tags: ["test", "cli-verification"],
    metadata: {
      source: "local-cli",
      agent: "gemini-debugger"
    }
  }, { input: "Hello from the CLI verification script!" });

  if (run) {
    console.log(`   Trace started with ID: ${run.runId}`);
    
    // Simulate some work
    await new Promise(r => setTimeout(r, 500));

    await traceEnd(run, { output: "Test trace completed successfully." });
    console.log("✅ Test Trace Completed and Sent.");
  } else {
    console.error("❌ Failed to start trace. Check API key and network.");
  }
}

if (import.meta.main) {
  await testTracing();
}
