// supabase/functions/ptd-proactive-scanner/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        console.log("🔍 Starting Proactive Scan...");

        // 1. Check for Churn Risks (Guardian)
        const { data: atRiskClients } = await supabase
            .from('client_health_scores')
            .select('*')
            .eq('health_zone', 'red')
            .limit(5);

        if (atRiskClients && atRiskClients.length > 0) {
            for (const client of atRiskClients) {
                // Create an insight
                await supabase.from('proactive_insights').insert({
                    insight_type: 'churn_risk',
                    title: `High Churn Risk: ${client.email}`,
                    description: `Client has health score ${client.health_score}. Last session: ${client.days_since_last_session} days ago.`,
                    priority: 'high',
                    data: client,
                    source_agent: 'guardian_scanner'
                });
            }
        }

        // 2. Check for Stale Leads (Hunter) - Using unified schema: contacts table
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: staleLeads } = await supabase
            .from('contacts')
            .select('*')
            .eq('lifecycle_stage', 'lead')
            .lt('created_at', twoDaysAgo)
            .limit(5);

        if (staleLeads && staleLeads.length > 0) {
            for (const lead of staleLeads) {
                await supabase.from('proactive_insights').insert({
                    insight_type: 'stale_lead',
                    title: `Stale Lead Detected: ${lead.email}`,
                    description: `Lead created > 48h ago with no contact logged.`,
                    priority: 'medium',
                    data: lead,
                    source_agent: 'hunter_scanner'
                });
            }
        }

        // 3. Check for Failed Payments (Revenue)
        // (Mock implementation as we don't have direct Stripe access here yet)
        // In a real scenario, this would query Stripe or a synced table

        return new Response(JSON.stringify({ success: true, message: "Scan completed" }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: unknown) {
        console.error('Scanner Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
});
