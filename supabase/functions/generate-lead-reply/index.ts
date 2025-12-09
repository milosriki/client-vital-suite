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
        // Fetch recent leads that don't have an AI reply yet
        const { data: leadsToProcess } = await supabase
            .from('leads')
            .select('id, firstname, fitness_goal, budget_range')
            .is('ai_suggested_reply', null)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!leadsToProcess || leadsToProcess.length === 0) {
            return new Response(JSON.stringify({ message: "No new leads to process" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const lead = leadsToProcess[0];
        console.log(`[Lead Reply Agent] Processing lead: ${lead.id}`);

        // Generate Reply using Claude
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        let suggestedReply = "";

        if (ANTHROPIC_API_KEY) {
            const prompt = `
        You are a senior fitness consultant at PTD Fitness. Draft a short, personalized, and high-converting SMS reply for a new lead.
        
        LEAD DETAILS:
        Name: ${lead.firstname}
        Goal: ${lead.fitness_goal}
        Budget: ${lead.budget_range}

        RULES:
        - Keep it under 160 characters if possible.
        - End with a question.
        - Be friendly but professional.
        - If budget is high (>15k), mention premium coaching.
        `;

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514", // Or latest available
                    max_tokens: 200,
                    messages: [{ role: "user", content: prompt }]
                })
            });

            const data = await response.json();
            suggestedReply = data.content?.[0]?.text || "";
        }

        // Fallback if AI fails
        if (!suggestedReply) {
            suggestedReply = `Hi ${lead.firstname}, thanks for your interest! I'd love to chat about your goal to ${lead.fitness_goal}. When are you free?`;
        }

        // Update Lead
        await supabase
            .from('leads')
            .update({ ai_suggested_reply: suggestedReply })
            .eq('id', lead.id);

        return new Response(JSON.stringify({ success: true, leadId: lead.id, reply: suggestedReply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: unknown) {
        console.error("Error generating reply:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
