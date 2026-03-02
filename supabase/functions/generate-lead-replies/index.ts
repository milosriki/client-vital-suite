import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";

const LeadReplySchema = z.object({
  reply: z.string().min(10).max(500),
  tone: z.enum(["warm", "professional", "urgent", "casual"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return apiSuccess(body);
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
    if (req.method === "OPTIONS") {
        return apiCorsPreFlight();
    }

    try {
        const payload = await req.json().catch(() => ({}));
        const limit = typeof payload?.limit === "number" && payload.limit > 0 ? Math.min(payload.limit, 50) : 10;



        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        const missingEnv = [
            !supabaseUrl && "SUPABASE_URL",
            !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
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

        // All contacts are now in the unified contacts table (leads table deprecated)
        const leadSource = await selectContacts();

        if (leadSource.error) {
            throw leadSource.error;
        }

        const newLeads = leadSource.data || [];
        const sourceTable = "contacts" as const;

        if (!newLeads || newLeads.length === 0) {
            return jsonResponse({ message: "No new leads to process", processed: 0, sourceTable });
        }

        let processedCount = 0;

        for (const lead of newLeads) {
            try {
                const constitutionalPrefix = getConstitutionalSystemMessage();
                const systemPrompt = `${constitutionalPrefix}
You are an expert sales consultant at PTD Fitness Dubai - a premium mobile personal training service.

ROLE: Generate personalized first-contact replies for new fitness leads.

OUTPUT FORMAT (strict JSON):
{
  "reply": "<your personalized 2-3 sentence reply, plain text, no markdown>",
  "tone": "<warm | professional | urgent | casual>",
  "confidence": <0.0 to 1.0>
}

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
- Match message length to budget tier

ERROR RECOVERY:
- If the lead's goal is missing or unclear, write a general fitness-focused reply and set confidence below 0.5.
- If the name is missing, address them as "there" (e.g., "Hi there").
- Never leave the reply empty. Always produce at least a generic warm outreach.`;

                const leadName = lead.first_name || lead.last_name ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : (lead as any).name || "Prospect";
                const prompt = `Lead Details:
- Name: ${leadName}
- Goal: ${lead.fitness_goal || lead?.metadata?.fitness_goal || "Not specified"}
- Budget: ${lead.budget_range || lead?.metadata?.budget_range || "Not specified"}
- Location: ${lead.location || lead?.metadata?.location || "Dubai"}

Return JSON with reply, tone, and confidence.`;

                const response = await unifiedAI.chat([
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ], {
                    jsonMode: true,
                    max_tokens: 250,
                    temperature: 0.7
                });

                let suggestedReply: string;
                try {
                    const parsed = LeadReplySchema.safeParse(JSON.parse(response.content));
                    if (parsed.success) {
                        suggestedReply = parsed.data.reply;
                    } else {
                        console.warn(`[generate-lead-replies] Zod validation failed for lead ${lead.id}:`, parsed.error.issues);
                        suggestedReply = response.content;
                    }
                } catch {
                    suggestedReply = response.content;
                }

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
            } catch (error: unknown) {
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
    } catch (error: unknown) {
        console.error("Function error:", error);

        return jsonResponse({
            error: error.message,
            processed: 0
        }, 500);
    }
});
