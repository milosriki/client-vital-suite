import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SocialProof {
  client_name: string;
  goal_type: string;
  quote: string;
  rating: number;
  program_type: string;
}

/**
 * Fetches social proof from both the social_proof table and agent_knowledge (success_story category).
 * Merges results and returns a shuffled subset.
 */
export async function getSocialProof(
  supabaseClient: ReturnType<typeof createClient>,
  goalType?: string | null,
  limit: number = 2,
): Promise<SocialProof[]> {
  try {
    // Source 1: social_proof table (legacy)
    let query = supabaseClient
      .from("social_proof")
      .select("client_name, goal_type, quote, rating, program_type");

    if (goalType) {
      if (goalType.includes("weight") || goalType.includes("fat") || goalType.includes("lose")) {
        query = query.eq("goal_type", "weight_loss");
      } else if (goalType.includes("muscle") || goalType.includes("build") || goalType.includes("strength")) {
        query = query.eq("goal_type", "muscle_gain");
      } else if (goalType.includes("pain") || goalType.includes("injury") || goalType.includes("rehab")) {
        query = query.eq("goal_type", "injury_recovery");
      }
    }

    const { data: legacyData } = await query.limit(10);

    // Source 2: agent_knowledge success stories (real data)
    const { data: knowledgeData } = await supabaseClient
      .from("agent_knowledge")
      .select("title, content, structured_data")
      .eq("category", "success_story")
      .limit(10);

    // Merge: convert knowledge entries to SocialProof format
    const knowledgeProofs: SocialProof[] = (knowledgeData || []).map((k: any) => ({
      client_name: k.structured_data?.client_name || "PTD Client",
      goal_type: k.structured_data?.goal_type || "general_fitness",
      quote: k.content || k.title,
      rating: k.structured_data?.rating || 5,
      program_type: k.structured_data?.program_type || "personal_training",
    }));

    const allProofs = [...(legacyData || []), ...knowledgeProofs];

    if (allProofs.length === 0) return [];

    // Shuffle and return
    const shuffled = allProofs.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  } catch (err) {
    console.error("❌ Social proof fetch error:", err);
    return [];
  }
}

export function formatSocialProof(proofs: SocialProof[]): string {
  if (!proofs || proofs.length === 0) return "";

  return proofs
    .map((p) => `- "Client Result (${p.program_type}): ${p.quote}"`)
    .join("\n");
}
