
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function audit() {
  console.log("🔍 PROJECT AUDIT: client-vital-suite\n");

  // 1. Marketing Pages Check
  try {
      const stats = await Deno.stat("src/pages/Marketing.tsx");
      console.log(`✅ Marketing Page: Found (${stats.size} bytes)`);
  } catch {
      console.error("❌ Marketing Page: MISSING (src/pages/Marketing.tsx)");
  }

  // 2. GPS Pages Check (CoachLocations.tsx)
  try {
      const stats = await Deno.stat("src/pages/CoachLocations.tsx");
      console.log(`✅ GPS Page: Found (${stats.size} bytes)`);
  } catch {
      console.error("❌ GPS Page: MISSING (src/pages/CoachLocations.tsx)");
  }

  // 3. Agent Independence Check (Telegram Bot)
  // Search for 'telegram' code importing 'supabase'
  // (Assuming Telegram bot is in functions/telegram-bot or similar)
  
  // We'll search text files for imports
  const cmd = new Deno.Command("grep", {
      args: ["-r", "import.*supabase", "supabase/functions/telegram-bot"],
      stdout: "piped",
      stderr: "piped"
  });
  const output = await cmd.output();
  const imports = new TextDecoder().decode(output.stdout);

  if (imports.length > 0) {
      console.warn("⚠️ AGENT DEPENDENCY ALERT: Telegram Bot imports Supabase!");
      console.log(imports);
  } else {
      console.log("✅ AGENT INDEPENDENCE: Telegram Bot seems clean (no direct imports found via grep).");
  }

  console.log("\n--- Audit Complete ---");
}

audit();
