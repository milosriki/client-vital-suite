import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

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
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const payload = await req.json().catch(() => ({}));
        const limit = typeof payload?.limit === "number" && payload.limit > 0 ? Math.min(payload.limit, 50) : 10;



        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        // const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

        const missingEnv = [
            !supabaseUrl && "SUPABASE_URL",
            !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
            // !ANTHROPIC_API_KEY && "ANTHROPIC_API_KEY",
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
                const systemPrompt = `You are an expert sales consultant at PTD Fitness Dubai - a premium mobile personal training service.

ROLE: Generate personalized first-contact replies for new fitness leads.

BRAND VOICE:
- Warm yet professional
- Results-focused
- Premium positioning
- Personal, not corporate

SUCCESS STORIES TO REFERENCE:
- Weight loss: "Clients like Ahmed lost 15kg in 3 months with our program"
- Muscle gain: "Our trainers helped Sara transform with strength training"
- General fitness: "Premium coaching that fits your busy Dubai lifestyle"

CONVERSION TACTICS:
- Address their specific goal
- Create curiosity about results
- Make booking consultation feel easy
- Match message length to budget tier`;

                const prompt = `Lead Details:
- Name: ${lead.first_name || lead.last_name ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : (lead as any).name || "Prospect"}
- Goal: ${lead.fitness_goal || lead?.metadata?.fitness_goal || "Not specified"}
- Budget: ${lead.budget_range || lead?.metadata?.budget_range || "Not specified"}
- Location: ${lead.location || lead?.metadata?.location || "Dubai"}

Write a SHORT (2-3 sentences) personalized initial reply. No markdown or formatting.`;

                const response = await unifiedAI.chat([
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ], {
                    max_tokens: 200,
                    temperature: 0.7
                });

                const suggestedReply = response.content;

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
