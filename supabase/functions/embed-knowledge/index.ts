import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";

/**
 * Lightweight function: ONLY generates embeddings for knowledge_base entries with NULL embeddings.
 * Call multiple times — each run processes up to 10 entries.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const batchSize = 10;

    const { data: entries, error: fetchErr } = await supabase
      .from("knowledge_base")
      .select("id, question, answer")
      .is("embedding", null)
      .eq("is_active", true)
      .limit(batchSize);

    if (fetchErr) throw new Error(`Fetch error: ${fetchErr.message}`);
    if (!entries?.length) {
      return apiSuccess({ message: "All entries already have embeddings", remaining: 0 });
    }

    let embedded = 0;
    let errors = 0;

    for (const entry of entries) {
      try {
        const content = `Q: ${entry.question}\nA: ${entry.answer}`;
        const embedding = await unifiedAI.embed(content);

        if (embedding?.length > 0) {
          const { error: updateErr } = await supabase
            .from("knowledge_base")
            .update({ embedding })
            .eq("id", entry.id);

          if (updateErr) {
            console.error(`Update failed for ${entry.id}:`, updateErr.message);
            errors++;
          } else {
            embedded++;
            console.log(`✅ ${entry.question.slice(0, 50)}`);
          }
        } else {
          console.error(`Empty embedding for: ${entry.question.slice(0, 50)}`);
          errors++;
        }
      } catch (e: any) {
        console.error(`Embed error: ${entry.question.slice(0, 50)}:`, e?.message);
        errors++;
      }
    }

    // Check remaining
    const { count } = await supabase
      .from("knowledge_base")
      .select("id", { count: "exact", head: true })
      .is("embedding", null)
      .eq("is_active", true);

    return apiSuccess({
      embedded,
      errors,
      remaining: count || 0,
      message: count ? `${count} entries still need embeddings — call again` : "All done!",
    });
  } catch (error: unknown) {
    return handleError(error, "embed-knowledge", {
      errorCode: ErrorCode.UNKNOWN_ERROR,
    });
  }
});
