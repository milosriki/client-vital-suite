import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export async function executeForensicTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "forensic_control": {
      const { target_identity, limit = 50 } = input;
      try {
        const { data, error } = await supabase.functions.invoke(
          "fetch-forensic-data",
          {
            body: { target_identity, limit },
          },
        );
        if (error) return `Forensic Audit Error: ${error.message}`;
        if (!data.success)
          return `Forensic Audit Failed: ${data.message || "Unknown error"}`;
        return JSON.stringify({
          target: data.contact,
          audit_log: data.audit_log,
        });
      } catch (e) {
        return `Forensic integration error: ${e}`;
      }
    }

    case "validate_truth": {
      const { fromDate } = input;
      try {
        console.log("🦅 Executing Universal Truth Validation...");
        const { data, error } = await supabase.functions.invoke(
          "validate-truth",
          {
            body: { fromDate },
          },
        );

        if (error) throw new Error(error.message);
        return JSON.stringify(data, null, 2);
      } catch (e) {
        return `Validation error: ${e}`;
      }
    }

    case "get_proactive_insights": {
      const { priority = "all", limit = 10 } = input;
      let query = supabase.from("proactive_insights").select("*");
      if (priority !== "all") {
        query = query.eq("priority", priority);
      }
      const { data } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      return JSON.stringify({
        insights_count: data?.length || 0,
        insights: data || [],
      });
    }

    default:
      return `Tool ${toolName} not handled by Forensic executor.`;
  }
}
