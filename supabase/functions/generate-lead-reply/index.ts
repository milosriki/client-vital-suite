import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
/**
 * @deprecated This function is deprecated. Use `generate-lead-replies` (plural) instead.
 * This version is kept for backward compatibility only.
 * 
 * The advanced version (`generate-lead-replies`) provides:
 * - Better Anthropic API integration
 * - More sophisticated lead analysis
 * - Enhanced error handling
 * 
 * Migration: Update all references from `generate-lead-reply` to `generate-lead-replies`
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to log errors to sync_errors table
async function logError(supabase: any, errorType: string, message: string, details: Record<string, any> = {}) {
    console.error(`[Lead Reply Agent Error] ${message}`, details);
    await supabase.from('sync_errors').insert({
        platform: 'lead-reply-agent',
        error_type: errorType,
        error_message: message,
        error_details: details,
        severity: 'medium',
        source_function: 'generate-lead-reply'
    });
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const batchSize = 10; // Process up to 10 leads per invocation
    const results: { leadId: string; success: boolean; reply?: string; error?: string }[] = [];

    try {
        // Fetch leads that don't have an AI reply yet
        const { data: leadsToProcess, error: fetchError } = await supabase
            .from('leads')
            .select('id, firstname, fitness_goal, budget_range, created_at')
            .is('ai_suggested_reply', null)
            .order('created_at', { ascending: false })
            .limit(batchSize);

        if (fetchError) {
            await logError(supabase, 'query_error', 'Failed to fetch leads', { error: fetchError });
            throw fetchError;
        }

        if (!leadsToProcess || leadsToProcess.length === 0) {
            return new Response(JSON.stringify({ 
                message: "No new leads to process",
                processed: 0 
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log(`[Lead Reply Agent] Processing ${leadsToProcess.length} leads`);

        // const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

        // Process all leads in parallel
        const processPromises = leadsToProcess.map(async (lead: any) => {
            try {
                let suggestedReply = "";

                try {
                    const systemPrompt = `You are an expert sales consultant at PTD Fitness Dubai - a premium mobile personal training service.

ROLE: Generate high-converting SMS responses for new fitness leads.

CONVERSION PSYCHOLOGY:
- Create urgency without pressure
- Match energy to their stated goals
- Premium clients respond to exclusivity
- Budget-conscious clients respond to value

PRICING CONTEXT:
- Budget >15k AED = Premium tier (mention exclusive/VIP)
- Budget 8-15k AED = Standard tier
- Budget <8k AED = Focus on value and results

SMS BEST PRACTICES:
- Keep under 160 characters when possible
- Always end with an engaging question
- Use their name naturally
- Sound human, not templated`;

                    const prompt = `
                    LEAD DETAILS:
                    Name: ${lead.firstname || 'there'}
                    Goal: ${lead.fitness_goal || 'fitness goals'}
                    Budget: ${lead.budget_range || 'not specified'}

                    Write an SMS reply. Output ONLY the message text, nothing else.
                    `;

                    const response = await unifiedAI.chat([
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ], {
                        max_tokens: 200,
                        temperature: 0.7
                    });

                    suggestedReply = response.content?.trim() || "";
                } catch (err) {
                    console.error(`[Lead Reply Agent] AI generation failed for lead ${lead.id}:`, err);
                    // Fallback will handle it
                }

                // Fallback if AI fails or no key
                if (!suggestedReply) {
                    const name = lead.firstname || 'there';
                    const goal = lead.fitness_goal || 'your fitness goals';
                    suggestedReply = `Hi ${name}! Thanks for reaching out about ${goal}. I'd love to help you get started. When are you free for a quick call?`;
                }

                // Update Lead
                const { error: updateError } = await supabase
                    .from('leads')
                    .update({ ai_suggested_reply: suggestedReply })
                    .eq('id', lead.id);

                if (updateError) {
                    throw updateError;
                }

                console.log(`[Lead Reply Agent] Generated reply for lead ${lead.id}`);
                return { leadId: lead.id, success: true, reply: suggestedReply };

            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[Lead Reply Agent] Failed for lead ${lead.id}:`, message);
                
                // Log individual lead failures but don't throw - continue with others
                await logError(supabase, 'lead_processing_error', `Failed to process lead ${lead.id}`, { 
                    leadId: lead.id, 
                    error: message 
                });
                
                return { leadId: lead.id, success: false, error: message };
            }
        });

        const processedResults = await Promise.all(processPromises);
        results.push(...processedResults);

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        // Log batch completion
        await supabase.from('sync_logs').insert({
            platform: 'lead-reply-agent',
            sync_type: 'batch_reply_generation',
            status: failCount === 0 ? 'success' : 'partial',
            records_synced: successCount,
            started_at: new Date().toISOString(),
            message: `Processed ${successCount}/${leadsToProcess.length} leads`
        });

        console.log(`[Lead Reply Agent] Batch complete: ${successCount} success, ${failCount} failed`);

        return new Response(JSON.stringify({ 
            success: true, 
            processed: successCount,
            failed: failCount,
            results 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await logError(supabase, 'function_error', message, { stack: String(error) });
        
        return new Response(JSON.stringify({ 
            error: message,
            processed: results.filter(r => r.success).length,
            results 
        }), { 
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
});
