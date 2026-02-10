import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// Security Utilities (replicated for now, will consolidate later)
function validateEmail(email: string): string {
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitized = email.trim().toLowerCase().slice(0, 255);
  if (!emailRegex.test(sanitized)) throw new Error("Invalid email format");
  return sanitized;
}

export async function executeHubSpotTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "client_control": {
      const { email, action } = input;
      if (action === "get_all") {
        const validatedEmail = validateEmail(email);
        const [health, calls, deals, activities] = await Promise.all([
          supabase
            .from("client_health_scores")
            .select("*")
            .eq("email", validatedEmail)
            .single(),
          supabase
            .from("call_records")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("deals")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("contact_activities")
            .select("*")
            .order("occurred_at", { ascending: false })
            .limit(20),
        ]);
        return JSON.stringify(
          {
            health: health.data,
            calls: calls.data,
            deals: deals.data,
            activities: activities.data,
          },
          null,
          2,
        );
      }
      if (action === "get_health") {
        const validatedEmail = validateEmail(email);
        const { data } = await supabase
          .from("client_health_scores")
          .select("*")
          .eq("email", validatedEmail)
          .single();
        return JSON.stringify(data);
      }
      return "Unknown action";
    }

    case "lead_control": {
      const { action, query, status, limit = 20 } = input;
      if (action === "get_all") {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        return JSON.stringify({
          count: data?.length || 0,
          leads: data || [],
        });
      }
      if (action === "search" && query) {
        const sanitizedQuery = query
          .replace(/[^a-zA-Z0-9@.\-+\s]/g, "")
          .slice(0, 100);
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .or(
            `email.ilike.%${sanitizedQuery}%,first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`,
          )
          .limit(limit);
        return JSON.stringify({
          count: data?.length || 0,
          leads: data || [],
        });
      }
      return "Unknown action";
    }

    case "hubspot_control": {
      const { action, limit = 50, email, contact_id } = input;

      if (action === "get_contact_history") {
        const { data } = await supabase
          .from("contact_ownership_history")
          .select("*")
          .eq("contact_id", contact_id)
          .order("changed_at", { ascending: false });
        return JSON.stringify(data || []);
      }

      if (action === "get_call_summaries") {
        const { data } = await supabase
          .from("call_records")
          .select(
            "started_at, duration_seconds, call_outcome, transcription, summary",
          )
          .ilike("caller_number", `%${input.phone}%`)
          .order("started_at", { ascending: false })
          .limit(5);
        return JSON.stringify(data || []);
      }

      if (action === "sync_now") {
        try {
          const { data } = await supabase.functions.invoke(
            "sync-hubspot-to-supabase",
            { body: { force: true } },
          );
          return `HubSpot sync triggered: ${JSON.stringify(data)}`;
        } catch (e) {
          return `Sync error: ${e}`;
        }
      }
      if (action === "get_contacts") {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        return JSON.stringify({
          count: data?.length || 0,
          contacts: data || [],
        });
      }
      if (action === "get_activities") {
        const { data } = await supabase
          .from("contact_activities")
          .select("*")
          .order("occurred_at", { ascending: false })
          .limit(limit);
        return JSON.stringify(data || []);
      }
      if (action === "get_lifecycle_stages") {
        const { data } = await supabase
          .from("contacts")
          .select("lifecycle_stage");
        const stages: Record<string, number> = {};
        (data || []).forEach((c: any) => {
          const stage = c.lifecycle_stage || "unknown";
          stages[stage] = (stages[stage] || 0) + 1;
        });
        return JSON.stringify(stages);
      }
      return "Unknown action";
    }

    default:
      return `Tool ${toolName} not handled by HubSpot executor.`;
  }
}
