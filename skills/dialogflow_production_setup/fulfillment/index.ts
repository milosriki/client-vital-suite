import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export async function webhookHandler(req: Request) {
  const startTime = Date.now();
  
  // 1. FAIL-FAST LOOKUP (Must be < 1.5s)
  const userContext = await fetchContextWithTimeout(req, 1500);
  
  // 2. BACKGROUND PROCESSING (Async)
  // Don't await this! Let EdgeRuntime keep it alive.
  EdgeRuntime.waitUntil(
    heavyBackgroundSync(userContext)
  );
  
  // 3. IMMEDIATE RESPONSE
  return new Response(JSON.stringify({
    fulfillmentText: \`Hello \${userContext.name}, how can I help?\`
  }), { headers: { "Content-Type": "application/json" } });
}

async function fetchContextWithTimeout(req: any, ms: number) {
  // Simulate fast DB lookup with strict timeout
  return Promise.race([
    db.lookup(req.body.session),
    new Promise((_, reject) => setTimeout(() => reject("Timeout"), ms))
  ]).catch(() => ({ name: "Friend" })); // Fallback
}

async function heavyBackgroundSync(context: any) {
  // Heavy Sync Logic (HubSpot, Email, Analytics)
  // Can take 10s+ without blocking user
  console.log("Syncing to HubSpot...", context);
}
