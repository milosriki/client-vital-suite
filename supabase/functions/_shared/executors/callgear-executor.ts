import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

export async function executeCallGearTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "call_control": {
      const { action, limit = 20 } = input;
      if (action === "get_all") {
        const { data } = await supabase
          .from("call_records")
          .select("id, caller_number, started_at, duration_seconds, call_outcome, call_status, call_direction, transcription, summary, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        return JSON.stringify({
          count: data?.length || 0,
          calls: data || [],
        });
      }
      if (action === "get_transcripts") {
        const { data } = await supabase
          .from("call_records")
          .select(
            "id, caller_number, transcription, call_outcome, duration_seconds, created_at",
          )
          .not("transcription", "is", null)
          .order("created_at", { ascending: false })
          .limit(limit);
        return JSON.stringify(data || []);
      }
      if (action === "get_analytics") {
        const { data } = await supabase
          .from("call_analytics")
          .select("id, date, total_calls, connected_calls, missed_calls, avg_duration, conversion_rate, created_at")
          .order("date", { ascending: false })
          .limit(30);
        return JSON.stringify(data || []);
      }
      if (action === "find_patterns" || action === "analyze_objections") {
        const { data } = await supabase
          .from("call_records")
          .select("transcription, call_outcome, caller_number")
          .not("transcription", "is", null)
          .limit(50);

        const objections = {
          pricing: data?.filter((c: any) =>
            /price|expensive|cost|budget|discount/i.test(c.transcription),
          ).length,
          timing: data?.filter((c: any) =>
            /later|next month|busy|wait/i.test(c.transcription),
          ).length,
          competitor: data?.filter((c: any) =>
            /enhance|other gym|trainer at home/i.test(c.transcription),
          ).length,
        };

        return JSON.stringify({
          analysis_period: "Last 50 calls with transcripts",
          objection_counts: objections,
          recommendation:
            objections.pricing > 10
              ? "Consider introducing more flexible installment plans."
              : "Sales flow is healthy.",
        });
      }
      return "Unknown action";
    }

    case "callgear_control": {
      const { date_from, date_to, limit = 50 } = input;
      try {
        const { data, error } = await supabase.functions.invoke(
          "fetch-callgear-data",
          {
            body: { date_from, date_to, limit },
          },
        );
        if (error) return `CallGear Error: ${error.message}`;
        if (!data.success)
          return `CallGear API Error: ${data.error || "Unknown error"}`;
        return JSON.stringify({
          count: data.count,
          calls: data.data?.map((c: any) => ({
            start_time: c.start_time,
            duration: c.duration,
            caller: c.calling_phone,
            called: c.called_phone,
            employee: c.employee_full_name || "Unknown",
            status: c.status,
            outcome: c.finish_reason,
            recording: c.record_url,
          })),
        });
      } catch (e) {
        return `CallGear integration error: ${e}`;
      }
    }

    case "callgear_supervisor": {
      const { action, call_session_id, mode, coach_sip_uri } = input;
      try {
        const { data, error } = await supabase.functions.invoke(
          "callgear-supervisor",
          {
            body: { action, call_session_id, mode, coach_sip_uri },
          },
        );
        if (error) return `CallGear Supervisor Error: ${error.message}`;
        return JSON.stringify(data);
      } catch (e) {
        return `CallGear Supervisor error: ${e}`;
      }
    }

    case "callgear_live_monitor": {
      const { action } = input;
      try {
        const { data, error } = await supabase.functions.invoke(
          "callgear-live-monitor",
          { body: { action } },
        );
        if (error) return `CallGear Monitor Error: ${error.message}`;
        return JSON.stringify(data);
      } catch (e) {
        return `CallGear Monitor error: ${e}`;
      }
    }

    case "callgear_icp_router": {
      const { action, test_caller } = input;
      try {
        const { data, error } = await supabase.functions.invoke(
          "callgear-icp-router",
          { body: { action, test_caller } },
        );
        if (error) return `CallGear ICP Error: ${error.message}`;
        return JSON.stringify(data);
      } catch (e) {
        return `CallGear ICP error: ${e}`;
      }
    }

    default:
      return `Tool ${toolName} not handled by CallGear executor.`;
  }
}
