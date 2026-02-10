import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  ELITE_SALES_PATTERNS,
  FITNESS_ARCHETYPES,
} from "./supabase/functions/_shared/knowledge-base-overhaul.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-knowledge`;

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function wipeKnowledgeBase() {
  console.log("🔥 WIPING KNOWLEDGE BASE (PREPARING FOR GEMINI MIGRATION)...");

  const { error: err1 } = await supabase
    .from("knowledge_base")
    .delete()
    .neq("id", 0); // Delete all
  const { error: err2 } = await supabase
    .from("knowledge_documents")
    .delete()
    .neq("id", 0); // Delete all

  if (err1 || err2) {
    console.error("Error wiping tables:", err1, err2);
  } else {
    console.log("✅ Tables wiped safely.");
  }
}

async function seedKnowledge() {
  console.log("🌱 SEEDING KNOWLEDGE WITH GEMINI VECTORS...");

  const allKnowledge = [
    ...ELITE_SALES_PATTERNS.map((k) => ({ ...k, type: "Sales DNA" })),
    ...FITNESS_ARCHETYPES.map((k) => ({ ...k, type: "Archetype" })),
  ];

  for (const item of allKnowledge) {
    const content = `[${item.category}] Q: ${item.question}\nA: ${item.answer}`;

    console.log(`Processing: ${item.question}`);

    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          content: content,
          filename: `seed_${item.type.replace(/\s+/g, "_")}_${Date.now()}.txt`,
          metadata: {
            category: item.category,
            tags: item.tags,
            source: "seed_script",
          },
        }),
      });

      if (!res.ok) {
        console.error(`Failed: ${res.status} ${await res.text()}`);
      } else {
        const data = await res.json();
        console.log(`✅ Indexed: ${item.question} (ID: ${data.document_id})`);
      }
    } catch (e) {
      console.error("Error calling function:", e);
    }
  }

  console.log("🚀 MIGRATION COMPLETE: All knowledge is now Gemini-Compatible.");
}

// MAIN EXECUTION
if (import.meta.main) {
  await wipeKnowledgeBase();
  await seedKnowledge();
}
