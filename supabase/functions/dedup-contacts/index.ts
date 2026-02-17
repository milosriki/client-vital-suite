import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";

/**
 * Contact Deduplication Engine
 * 
 * Finds duplicate contacts by phone number (same person, multiple HubSpot entries).
 * Keeps the "canonical" contact (richest data) and merges data from duplicates.
 * 
 * Uses Postgres function `dedup_phone_contacts(mode, limit)` for atomic merge.
 * 
 * Modes:
 * - preview: Show what would be merged, no changes
 * - merge: Actually merge duplicates and soft-delete extras
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token.split(".").length !== 3) {
      return apiError("UNAUTHORIZED", "Missing authentication", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || "preview";
    const limit: number = body.limit || 500;

    console.log(`[dedup] Mode: ${mode}, limit: ${limit}`);

    // Call the Postgres function
    const { data, error } = await supabase.rpc("dedup_phone_contacts", {
      p_mode: mode,
      p_limit: limit,
    });

    if (error) throw error;

    console.log(`[dedup] Result:`, JSON.stringify(data));

    // Log to sync_logs
    try {
      await supabase.from("sync_logs").insert({
        sync_type: "dedup_contacts",
        status: mode === "merge" ? "success" : "preview",
        details: data,
        created_at: new Date().toISOString(),
      });
    } catch { /* ignore log errors */ }

    return apiSuccess({
      mode,
      summary: {
        duplicate_groups: data.groups_processed,
        contacts_merged: data.contacts_merged,
        deals_reassigned: data.deals_reassigned,
      },
      plans: data.plans || [],
    });
  } catch (err: any) {
    console.error("[dedup] Error:", err);
    return apiError("INTERNAL_ERROR", err.message, 500);
  }
});
