import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class LearningLayer {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Records explicit human feedback to prevent recurring mistakes.
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
  async getActiveLearnings(limit = 5, agentName?: string): Promise<string> {
    let queryBuilder = this.supabase
      .from("agent_learnings")
      .select("content, category, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (agentName) {
      queryBuilder = queryBuilder.or(`agent_name.eq.${agentName},agent_name.eq.shared,agent_name.is.null`);
    }

    const { data } = await queryBuilder;

    if (!data || data.length === 0) return "";

    const items = data.map((l: any) => `- [${l.category}] ${l.content}`).join("\n");
    return `<evolutionary_memory>\nTHE USER HAS PREVIOUSLY CORRECTED YOU. DO NOT REPEAT THESE MISTAKES:\n${items}\n</evolutionary_memory>`;
  }

  /**
   * Auto-cleanup: delete expired agent_memory entries.
   * Call this on each agent run to keep memory lean.
   */
  async cleanupExpiredMemories(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from("agent_memory")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select("id");

      if (error) {
        console.error("Failed to cleanup expired memories:", error);
        return 0;
      }
      const count = data?.length || 0;
      if (count > 0) console.log(`🧹 Cleaned up ${count} expired memories`);
      return count;
    } catch (err) {
      console.error("Memory cleanup error:", err);
      return 0;
    }
  }

  /**
   * Retrieve memories with relevance scoring: prioritize recent + frequently accessed.
   * Returns top 5 memories to save tokens.
   */
  async getRelevantMemories(conversationId: string, limit = 5): Promise<string> {
    try {
      // First, cleanup expired entries
      await this.cleanupExpiredMemories();

      // Check total memory count for this conversation
      const { count } = await this.supabase
        .from("agent_memory")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      // If > 20 memories, summarize older ones
      if (count && count > 20) {
        await this.compressOldMemories(conversationId);
      }

      // Fetch top memories scored by recency + access_count
      // Score = access_count + (1 / days_since_created)
      const { data, error } = await this.supabase
        .from("agent_memory")
        .select("id, key, value, access_count, created_at, updated_at")
        .eq("conversation_id", conversationId)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error || !data || data.length === 0) return "";

      // Bump access counts for retrieved memories
      const ids = data.map((m: any) => m.id);
      await this.supabase.rpc("increment_memory_access", { memory_ids: ids }).catch(() => {
        // If RPC doesn't exist, silently skip — not critical
      });

      return data
        .map((m: any) => `- ${m.key}: ${m.value}`)
        .join("\n");
    } catch (err) {
      console.error("Memory retrieval error:", err);
      return "";
    }
  }

  /**
   * Compress old memories: when count > 20, summarize the oldest entries
   * into a single "summary" memory and delete the originals.
   */
  private async compressOldMemories(conversationId: string): Promise<void> {
    try {
      // Get oldest memories beyond the most recent 15
      const { data: oldMemories } = await this.supabase
        .from("agent_memory")
        .select("id, key, value")
        .eq("conversation_id", conversationId)
        .order("updated_at", { ascending: true })
        .limit(20); // Get oldest 20, we'll compress the bottom ones

      if (!oldMemories || oldMemories.length < 10) return;

      // Take the oldest half to compress
      const toCompress = oldMemories.slice(0, Math.min(oldMemories.length, 10));

      // Build summary
      const summaryText = toCompress
        .map((m: any) => `${m.key}: ${m.value}`)
        .join("; ");

      // Upsert a compressed summary memory
      await this.supabase.from("agent_memory").upsert({
        conversation_id: conversationId,
        key: "_compressed_history",
        value: summaryText.slice(0, 500), // Cap at 500 chars
        updated_at: new Date().toISOString(),
      }, { onConflict: "conversation_id,key" });

      // Delete the originals
      const idsToDelete = toCompress.map((m: any) => m.id);
      await this.supabase
        .from("agent_memory")
        .delete()
        .in("id", idsToDelete);

      console.log(`🗜️ Compressed ${idsToDelete.length} old memories for conversation ${conversationId}`);
    } catch (err) {
      console.error("Memory compression error:", err);
    }
  }
}
