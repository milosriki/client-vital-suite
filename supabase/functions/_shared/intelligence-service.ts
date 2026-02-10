import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class IntelligenceService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Analyzes Coach Retention Rates.
   * "Which coach keeps clients the longest?"
   */
  async analyzeCoachRetention(months = 6) {
    const { data, error } = await this.supabase.rpc("analyze_coach_retention", {
      lookback_months: months,
    });

    if (error) {
      console.error("RPC analyze_coach_retention failed:", error);
      return {
        error: "Failed to analyze retention. Database function missing?",
      };
    }
    return data;
  }

  /**
   * Analyzes Conversion by Fitness Goal.
   * "What goals convert best?"
   */
  async analyzeGoalConversion() {
    const { data, error } = await this.supabase.rpc("analyze_goal_conversion");

    if (error) {
      console.error("RPC analyze_goal_conversion failed:", error);
      return {
        error: "Failed to analyze conversion. Database function missing?",
      };
    }
    return data;
  }
}
