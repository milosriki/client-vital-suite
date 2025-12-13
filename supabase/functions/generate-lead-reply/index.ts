import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to log errors to sync_errors table
async function logError(supabase: any, errorType: string, message: string, details: any = {}) {
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

serve(async (req) => {
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

        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

        // Process all leads in parallel
        const processPromises = leadsToProcess.map(async (lead) => {
            try {
                let suggestedReply = "";

                if (ANTHROPIC_API_KEY) {
                    const prompt = `
                    You are a senior fitness consultant at PTD Fitness. Draft a short, personalized, and high-converting SMS reply for a new lead.
                    
                    LEAD DETAILS:
                    Name: ${lead.firstname || 'there'}
                    Goal: ${lead.fitness_goal || 'fitness goals'}
                    Budget: ${lead.budget_range || 'not specified'}

                    RULES:
                    - Keep it under 160 characters if possible.
                    - End with a question to encourage response.
                    - Be friendly but professional.
                    - If budget is high (>15k), mention premium/exclusive coaching.
                    - If budget is not specified, keep it general.
                    
                    Reply with ONLY the SMS text, no quotes or explanation.
                    `;

                    const response = await fetch("https://api.anthropic.com/v1/messages", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": ANTHROPIC_API_KEY,
                            "anthropic-version": "2024-10-22"
                        },
                        body: JSON.stringify({
                            model: "claude-sonnet-4-20250514",
                            max_tokens: 200,
                            messages: [{ role: "user", content: prompt }]
                        })
                    });

                    const data = await response.json();
                    
                    if (data.error) {
                        throw new Error(data.error.message || 'API error');
                    }
                    
                    suggestedReply = data.content?.[0]?.text?.trim() || "";
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
