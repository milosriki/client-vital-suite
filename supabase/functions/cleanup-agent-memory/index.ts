import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const results: Record<string, number> = {};

  // 1. Archive expired agent_memory (don't delete — mark archived)
  const { count: memoryArchived } = await supabase
    .from("agent_memory")
    .update({ archived: true })
    .eq("archived", false)
    .lt("expires_at", now);
  results.agent_memory_archived = memoryArchived || 0;

  // 2. Delete expired agent_conversations (write-only dead data)
  const { count: convsDeleted } = await supabase
    .from("agent_conversations")
    .delete()
    .lt("expires_at", now);
  results.agent_conversations_deleted = convsDeleted || 0;

  // 3. Delete expired agent_decisions older than 1 year
  const { count: decisionsDeleted } = await supabase
    .from("agent_decisions")
    .delete()
    .lt("expires_at", now);
  results.agent_decisions_deleted = decisionsDeleted || 0;

  // 4. Decay low-confidence patterns not used in 60 days
  // Column is `last_used_at` (NOT `last_confirmed_at`)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { count: patternsDecayed } = await supabase
    .from("agent_patterns")
    .update({ confidence: 0.1 })
    .lt("confidence", 0.5)
    .lt("last_used_at", sixtyDaysAgo);
  results.agent_patterns_decayed = patternsDecayed || 0;

  console.log("[cleanup-agent-memory] Results:", JSON.stringify(results));

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
