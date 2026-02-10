import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SocialProof {
  client_name: string;
  goal_type: string;
  quote: string;
  rating: number;
  program_type: string;
}

export async function getSocialProof(
  supabaseClient: ReturnType<typeof createClient>,
  goalType?: string | null,
  limit: number = 2,
): Promise<SocialProof[]> {
  try {
    let query = supabaseClient
      .from("social_proof")
      .select("client_name, goal_type, quote, rating, program_type");

    if (goalType) {
      // Basic fuzzy matching for goal types
      if (
        goalType.includes("weight") ||
        goalType.includes("fat") ||
        goalType.includes("lose")
      ) {
        query = query.eq("goal_type", "weight_loss");
      } else if (
        goalType.includes("muscle") ||
        goalType.includes("build") ||
        goalType.includes("strength")
      ) {
        query = query.eq("goal_type", "muscle_gain");
      } else if (
        goalType.includes("pain") ||
        goalType.includes("injury") ||
        goalType.includes("rehab")
      ) {
        query = query.eq("goal_type", "injury_recovery");
      } else {
        // If goal is ambiguous or general, don't filter strictly or fallback to general_fitness
        // query = query.eq("goal_type", "general_fitness"); // Optional: strict fallback
      }
    }

    // Randomize results (Postgres random() requires extension or workaround, using limit/shuffle in app for simplicity with small set)
    // For now, just taking limit. In production, a stored proc for random sample is better.
    const { data, error } = await query.limit(10); // Fetch a few more to shuffle in memory

    if (error) {
      console.error("❌ Failed to fetch social proof:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Simple shuffle
    const shuffled = data.sort(() => 0.5 - Math.random());
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
