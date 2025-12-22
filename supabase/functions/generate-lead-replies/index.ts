import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const payload = await req.json().catch(() => ({}));
        const limit = typeof payload?.limit === "number" && payload.limit > 0 ? Math.min(payload.limit, 50) : 10;

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

        const missingEnv = [
            !supabaseUrl && "SUPABASE_URL",
            !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
            !ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY",
        ].filter(Boolean) as string[];

        if (missingEnv.length > 0) {
            return jsonResponse({ error: "Missing required environment variables", missing: missingEnv }, 400);
        }

        const supabase = createClient(supabaseUrl!, serviceRoleKey!);

        const selectContacts = async () => {
            const { data, error } = await supabase
                .from("contacts")
                .select("id,email,first_name,last_name,lead_status,ai_suggested_reply,fitness_goal,budget_range,location,metadata")
                .is("ai_suggested_reply", null)
                .eq("lead_status", "NEW")
                .limit(limit);

            if (error) {
                if (error.message?.includes("ai_suggested_reply")) {
                    return { data: null, error: null };
                }
                return { data: null, error };
            }

            return { data: data || [], error: null, table: "contacts" as const };
        };

        const selectLeads = async () => {
            const { data, error } = await supabase
                .from("leads")
                .select("id,email,first_name,last_name,name,fitness_goal,budget_range,location,ai_suggested_reply,status,metadata")
                .is("ai_suggested_reply", null)
                .eq("status", "NEW")
                .limit(limit);

            if (error) return { data: null, error, table: undefined };
            // Map leads fields to match contacts schema
            const mappedData = (data || []).map((lead: any) => ({
                ...lead,
                lead_status: lead.status,
            }));
            return { data: mappedData, error: null, table: "leads" as const };
        };

        // Prefer unified contacts schema; fallback to legacy leads table
        let leadSource: { data: any[] | null; error: any; table?: "contacts" | "leads" } = await selectContacts();
        if (!leadSource.table) {
            leadSource = await selectLeads();
        }

        if (leadSource.error) {
            throw leadSource.error;
        }

        const newLeads = leadSource.data || [];
        const sourceTable = leadSource.table || "leads";

        if (!newLeads || newLeads.length === 0) {
            return jsonResponse({ message: "No new leads to process", processed: 0, sourceTable });
        }

        let processedCount = 0;

        for (const lead of newLeads) {
            try {
                const prompt = `You are a sales consultant for PTD Fitness, Dubai's premium personal training service.

Lead Details:
- Name: ${lead.first_name || lead.last_name ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : (lead as any).name || "Prospect"}
- Goal: ${lead.fitness_goal || lead?.metadata?.fitness_goal || "Not specified"}
- Budget: ${lead.budget_range || lead?.metadata?.budget_range || "Not specified"}
- Location: ${lead.location || lead?.metadata?.location || "Dubai"}

Write a SHORT (2-3 sentences) personalized initial reply that:
1. Addresses their specific fitness goal
2. Mentions a relevant PTD success story if goal is weight loss/muscle gain
3. Suggests booking a consultation call

Be warm, professional, and specific. No generic templates. Do not use markdown or formatting.`;

                const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": ANTHROPIC_API_KEY!,
                        "anthropic-version": "2023-06-01"
                    },
                    body: JSON.stringify({
                        model: "claude-sonnet-4-5-20250929",
                        max_tokens: 200,
                        messages: [{ role: "user", content: prompt }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`Claude API returned ${response.status}`);
                }

                const data = await response.json();
                const suggestedReply = data.content?.[0]?.text;

                if (suggestedReply) {
                    const updatePayload: Record<string, any> = { ai_suggested_reply: suggestedReply };
                    if ("ai_reply_generated_at" in lead) {
                        updatePayload.ai_reply_generated_at = new Date().toISOString();
                    }

                    const { error: updateError } = await supabase
                        .from(sourceTable)
                        .update(updatePayload)
                        .eq("id", lead.id);

                    if (updateError) {
                        console.error(`Failed to update ${sourceTable} record ${lead.id}:`, updateError);
                    } else {
                        processedCount++;
                    }
                }
            } catch (error: any) {
                console.error(`Failed to generate reply for lead ${lead.id}:`, error);

                await supabase.from("sync_errors").insert({
                    error_type: "timeout",
                    source: "internal",
                    object_type: "lead",
                    object_id: lead.id,
                    error_message: `Lead reply generation failed: ${error.message}`,
                    error_details: { lead_data: { id: lead.id, name: (lead as any).name || lead.email } }
                });
            }
        }

        return jsonResponse({
            success: true,
            processed: processedCount,
            total: newLeads.length,
            sourceTable,
        });
    } catch (error: any) {
        console.error("Function error:", error);

        return jsonResponse({
            error: error.message,
            processed: 0
        }, 500);
    }
});
