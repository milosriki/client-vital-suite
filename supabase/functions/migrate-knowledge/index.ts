import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { EXPANDED_KNOWLEDGE } from "../_shared/expanded-knowledge.ts";

const FUNCTION_NAME = "migrate-knowledge";

// Core sales patterns + archetypes (original seed data)
const CORE_KNOWLEDGE = [
  {
    category: "Sales Framework",
    question: "How to start discovery?",
    answer: "Use the Clarifying Question: 'Help me understand... why are you actively looking for a shift right now? What changed recently?'",
    tags: ["NEPQ", "Discovery", "Opening"],
  },
  {
    category: "Sales Framework",
    question: "How to create urgency?",
    answer: "Use the Gap-Widening Question: 'If we don't fix this now, where are you physically in 6 months? Same spot?'",
    tags: ["NEPQ", "Urgency", "Gap"],
  },
  {
    category: "Sales Framework",
    question: "How to handle 'What is the price?' early?",
    answer: "Use the Price Deflection: 'totally fair question. pricing depends on what your coach maps out for you — that's why the assessment is free. worst case you walk away with a custom blueprint. can i ask you something quick to see if we're even a fit?'",
    tags: ["Belfort", "Objection", "Price"],
  },
  {
    category: "Sales Framework",
    question: "How to transition to booking?",
    answer: "The 'Next Step' Bridge: 'Based on what you've said, you're a perfect fit for our program. The next step is a free Movement Assessment to map this out. Are you open to that?'",
    tags: ["Cole Gordon", "Closing", "Booking"],
  },
  {
    category: "Archetype",
    question: "Post-Pregnancy Linguistics",
    answer: "Focus: Rebuilding strength, reclaiming energy, feeling like yourself. Avoid: 'Baby weight', 'Getting body back'.",
    tags: ["Post-Pregnancy", "Empathy", "Women"],
  },
  {
    category: "Archetype",
    question: "40+ Executive Linguistics",
    answer: "Focus: Mobility, pain-free performance, posture, longevity. Avoid: 'Old', 'Weak', 'Bodybuilding'.",
    tags: ["Executive", "40+", "Men"],
  },
  {
    category: "Archetype",
    question: "Skinny-Fat Linguistics",
    answer: "Focus: Metabolic fire, athletic physique, body composition. Avoid: 'Skinny-fat', 'Bulking'.",
    tags: ["Physique", "Gen Z", "Millennial"],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    console.log("🔥 STARTING KNOWLEDGE MIGRATION...");

    // 1. Wipe old knowledge_base entries (we'll reseed everything)
    const { error: wipeErr } = await supabase
      .from("knowledge_base")
      .delete()
      .not("id", "is", null);
    if (wipeErr) console.warn("Wipe warning:", wipeErr.message);

    console.log("✅ Old knowledge wiped. Seeding fresh...");

    // 2. Combine all knowledge
    const allKnowledge = [...CORE_KNOWLEDGE, ...EXPANDED_KNOWLEDGE];
    let seeded = 0;
    let embedErrors = 0;

    // 3. Seed with embeddings in batches of 5 (rate limit friendly)
    for (let i = 0; i < allKnowledge.length; i += 5) {
      const batch = allKnowledge.slice(i, i + 5);

      const promises = batch.map(async (item) => {
        const content = `Q: ${item.question}\nA: ${item.answer}`;

        let embedding = null;
        try {
          embedding = await unifiedAI.embed(content);
          console.log(`✅ Embedded: ${item.question.slice(0, 40)}...`);
        } catch (e: any) {
          console.error(`❌ Embedding failed for: ${item.question}`, e?.message || e);
          embedErrors++;
        }

        const { error, data } = await supabase.from("knowledge_base").insert({
          category: item.category,
          question: item.question,
          answer: item.answer,
          tags: item.tags,
          embedding,
          is_active: true,
        }).select("id");

        if (error) {
          console.error(`❌ Insert failed: ${item.question}`, error.message, error.details);
        } else {
          seeded++;
          console.log(`📝 Inserted: ${item.category} — ${item.question.slice(0, 40)}`);
        }
      });

      await Promise.all(promises);
      console.log(`📦 Batch ${Math.floor(i / 5) + 1}: ${seeded}/${allKnowledge.length} seeded`);

      // Small delay between batches to avoid rate limits
      if (i + 5 < allKnowledge.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`✅ Migration complete: ${seeded} seeded, ${embedErrors} embed errors`);

    return apiSuccess({
      success: true,
      total_entries: allKnowledge.length,
      seeded,
      embed_errors: embedErrors,
      categories: {
        core_sales: CORE_KNOWLEDGE.length,
        objections: EXPANDED_KNOWLEDGE.filter((k) => k.category === "objection").length,
        locations: EXPANDED_KNOWLEDGE.filter((k) => k.category === "location").length,
        pricing: EXPANDED_KNOWLEDGE.filter((k) => k.category === "pricing").length,
        faqs: EXPANDED_KNOWLEDGE.filter((k) => k.category === "faq").length,
      },
    });
  } catch (error: unknown) {
    console.error("Migration error:", error);
    return handleError(error, FUNCTION_NAME, {
      errorCode: ErrorCode.UNKNOWN_ERROR,
      context: { action: "migrate_knowledge" },
    });
  }
});
