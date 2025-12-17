import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        // Get new leads without AI replies
        const { data: newLeads, error: leadsError } = await supabase
            .from('leads')
            .select('*')
            .is('ai_suggested_reply', null)
            .eq('status', 'NEW')
            .limit(10);

        if (leadsError) throw leadsError;

        if (!newLeads || newLeads.length === 0) {
            return new Response(JSON.stringify({ message: 'No new leads to process', processed: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

        if (!ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY not set');
        }

        let processedCount = 0;

        for (const lead of newLeads) {
            try {
                const prompt = `You are a sales consultant for PTD Fitness, Dubai's premium personal training service.

Lead Details:
- Name: ${lead.name || 'Prospect'}
- Goal: ${lead.fitness_goal || 'Not specified'}
- Budget: ${lead.budget_range || 'Not specified'}
- Location: ${lead.location || 'Dubai'}

Write a SHORT (2-3 sentences) personalized initial reply that:
1. Addresses their specific fitness goal
2. Mentions a relevant PTD success story if goal is weight loss/muscle gain
3. Suggests booking a consultation call

Be warm, professional, and specific. No generic templates. Do not use markdown or formatting.`;

                const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": ANTHROPIC_API_KEY,
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
                const suggestedReply = data.content[0]?.text;

                if (suggestedReply) {
                    // Update lead with AI suggestion
                    const { error: updateError } = await supabase
                        .from('leads')
                        .update({ ai_suggested_reply: suggestedReply })
                        .eq('id', lead.id);

                    if (!updateError) {
                        processedCount++;
                    }
                }
            } catch (error: any) {
                console.error(`Failed to generate reply for lead ${lead.id}:`, error);

                // Log error to sync_errors
                await supabase.from('sync_errors').insert({
                    error_type: 'timeout',
                    source: 'internal',
                    object_type: 'lead',
                    object_id: lead.id,
                    error_message: `Lead reply generation failed: ${error.message}`,
                    error_details: { lead_data: { id: lead.id, name: lead.name } }
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            processed: processedCount,
            total: newLeads.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Function error:', error);

        return new Response(JSON.stringify({
            error: error.message,
            processed: 0
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
