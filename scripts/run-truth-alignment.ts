import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!.trim(),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.trim()
);

console.log("🚀 Bootstrapping Truth Alignment...");

try {
  const { data, error } = await supabase.functions.invoke("aws-truth-alignment", {
    body: { force_align: true }
  });

  if (error) {
    console.error("❌ Alignment failed:", error);
  } else {
    console.log("✅ Alignment successful!");
    console.log("Report Summary:", JSON.stringify(data.report, null, 2));
  }
} catch (e) {
  console.error("Fatal error during alignment:", e);
}
