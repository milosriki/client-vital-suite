import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  corsHeaders,
  ErrorCode,
} from "../_shared/error-handler.ts";

const FUNCTION_NAME = "migrate-knowledge";

// DATA TO RESEED
const ELITE_SALES_PATTERNS = [
  // NEPQ (Jeremy Miner)
  {
    category: "Sales Framework",
    question: "How to start discovery?",
    answer:
      "Use the Clarifying Question: 'Help me understand... why are you actively looking for a shift right now? What changed recently?'",
    tags: ["NEPQ", "Discovery", "Opening"],
  },
  {
    category: "Sales Framework",
    question: "How to create urgency?",
    answer:
      "Use the Gap-Widening Question: 'If we don't fix this now, where are you physically in 6 months? Same spot?'",
    tags: ["NEPQ", "Urgency", "Gap"],
  },
  // Straight Line (Jordan Belfort)
  {
    category: "Sales Framework",
    question: "How to handle 'What is the price?' early?",
    answer:
      "Use the Price Deflection: 'totally fair question. pricing depends on what your coach maps out for you — that's why the assessment is free. worst case you walk away with a custom blueprint. can i ask you something quick to see if we're even a fit?'",
    tags: ["Belfort", "Objection", "Price"],
  },
  // Cole Gordon (Setter Framework)
  {
    category: "Sales Framework",
    question: "How to transition to booking?",
    answer:
      "The 'Next Step' Bridge: 'Based on what you've said, you're a perfect fit for our [Specific Program]. The next step is a quick 10-min Blueprint call to see if we can map this out. Are you open to that?'",
    tags: ["Cole Gordon", "Closing", "Booking"],
  },
];

const FITNESS_ARCHETYPES = [
  {
    category: "Archetype",
    question: "Post-Pregnancy Linguistics",
    answer:
      "Focus: Rebuilding strength, reclaiming energy, feeling like yourself. Avoid: 'Baby weight', 'Getting body back'.",
    tags: ["Post-Pregnancy", "Empathy", "Women"],
  },
  {
    category: "Archetype",
    question: "40+ Executive Linguistics",
    answer:
      "Focus: Mobility, pain-free performance, posture, longevity. Avoid: 'Old', 'Weak', 'Bodybuilding'.",
    tags: ["Executive", "40+", "Men"],
  },
  {
    category: "Archetype",
    question: "Skinny-Fat Linguistics",
    answer:
      "Focus: Metabolic fire, athletic physique, body composition. Avoid: 'Skinny-fat', 'Bulking'.",
    tags: ["Physique", "Gen Z", "Millennial"],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    verifyAuth(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔥 STARTING MIGRATION: Wiping incompatible knowledge...");

    // 1. WIPE OLD DATA
    const { error: err1 } = await supabase
      .from("knowledge_base")
      .delete()
      .neq("id", 0);
    const { error: err2 } = await supabase
      .from("knowledge_documents")
      .delete()
      .neq("id", 0);

    if (err1 || err2) throw new Error("Failed to wipe tables");

    console.log("✅ Tables wiped. Starting re-seeding...");

    // 2. RE-SEED
    let processed = 0;
    const allItems = [...ELITE_SALES_PATTERNS, ...FITNESS_ARCHETYPES];

    for (const item of allItems) {
      const content = `[${item.category}] Q: ${item.question}\nA: ${item.answer}`;

      // Generate Gemini Embedding
      const embedding = await unifiedAI.embed(content);

      // Insert
      await supabase.from("knowledge_documents").insert({
        filename: `seed_${item.category}_${Date.now()}.txt`,
        content: content,
        content_chunks: [content], // Simple chunking for seed data
        embedding: embedding,
        metadata: {
          category: item.category,
          tags: item.tags,
          embedding_model: "text-embedding-004",
        },
        uploaded_by: "migration_script",
      });

      processed++;
    }

    return apiSuccess({
        success: true,
        message: `Migration Complete! Wiped old data. Re-seeded ${processed} documents with Gemini Brain.`,
        documents_seeded: processed,
      });
  } catch (error: unknown) {
    console.error("Migration error:", error);
    return handleError(error, FUNCTION_NAME, {
      errorCode: ErrorCode.UNKNOWN_ERROR,
      context: { action: "migrate_knowledge" },
    });
  }
});
