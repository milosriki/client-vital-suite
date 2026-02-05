import { supabase } from "@/integrations/supabase/client";

/**
 * Robust API Client for invoking Supabase Edge Functions
 * Recreated by Antigravity using 'typescript-scaffold' skill patterns.
 */

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
}

export const apiClient = {
  /**
   * Invoke a Supabase Edge Function with automatic error handling
   */
  async invoke<T = any>(
    functionName: string,
    body: any = {},
  ): Promise<ApiResponse<T>> {
    

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) {
        console.error(`[API] Function ${functionName} failed:`, error);
        return { data: null, error: error.message };
      }

      return { data: data as T, error: null };
    } catch (err: any) {
      console.error(`[API] Unexpected error in ${functionName}:`, err);
      return { data: null, error: err.message || "Unknown error" };
    }
  },

  /**
   * Health check for the API system
   */
  async healthCheck(): Promise<boolean> {
    const { error } = await this.invoke("system-health-check");
    return !error;
  },
};
