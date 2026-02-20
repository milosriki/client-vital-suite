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

    // 3. Seed entries (without embeddings first — fast)
    for (const item of allKnowledge) {
      try {
        const { error } = await supabase.from("knowledge_base").insert({
          category: item.category,
          question: item.question,
          answer: item.answer,
          tags: item.tags,
          is_active: true,
        });

        if (error) {
          console.error(`❌ Insert failed: ${item.question}`, error.message);
        } else {
          seeded++;
        }
      } catch (e: any) {
        console.error(`❌ Exception inserting: ${item.question}`, e?.message);
      }
    }
    console.log(`📝 Seeded ${seeded}/${allKnowledge.length} entries`);

    // 4. Now generate embeddings for all entries
    const { data: entries } = await supabase
      .from("knowledge_base")
      .select("id, question, answer")
      .is("embedding", null)
      .eq("is_active", true);

    if (entries?.length) {
      console.log(`🧠 Generating embeddings for ${entries.length} entries...`);
      for (const entry of entries) {
        try {
          const content = `Q: ${entry.question}\nA: ${entry.answer}`;
          const embedding = await unifiedAI.embed(content);
          if (embedding?.length > 0) {
            await supabase
              .from("knowledge_base")
              .update({ embedding })
              .eq("id", entry.id);
            console.log(`✅ Embedded: ${entry.question.slice(0, 40)}`);
          }
        } catch (e: any) {
          console.error(`❌ Embed failed: ${entry.question.slice(0, 40)}`, e?.message);
          embedErrors++;
        }
        // Rate limit: 100ms between embeds
        await new Promise((r) => setTimeout(r, 100));
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
