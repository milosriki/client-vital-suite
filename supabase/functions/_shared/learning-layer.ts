import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class LearningLayer {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Records explicit human feedback to prevent recurring mistakes.
   * "Stop focusing on traffic"
   */
  async recordFeedback(feedback: string, category: string, threadId?: string) {
    const { error } = await this.supabase.from("agent_learnings").insert({
      category,
      content: feedback,
      thread_id: threadId,
      source: "human_feedback",
      is_active: true,
    });

    if (error) {
      // If table doesn't exist, we might need to handle that.
      // For now, assume schema exists or we fail gracefully.
      console.error("Failed to save learning:", error);
      return { success: false, error };
    }
    return {
      success: true,
      message: "Use 'Evolution' has learned this feedback.",
    };
  }

  /**
   * Retrieves active learnings to inject into the system prompt.
   */
  async getActiveLearnings(limit = 5): Promise<string> {
    const { data } = await this.supabase
      .from("agent_learnings")
      .select("content, category")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) return "";

    return `
<evolutionary_memory>
THE USER HAS PREVIOUSLY CORRECTED YOU. DO NOT REPEAT THESE MISTAKES:
${data.map((l: any) => `- [${l.category.toUpperCase()}] ${l.content}`).join("\n")}
</evolutionary_memory>
    `.trim();
  }
}
