import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This Agent answers: "How is my business actually doing today?"
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. GET THE HARD DATA (The "Sensors")
    const today = new Date().toISOString().split('T')[0];

    // A. Operational: Utilization (Sessions Delivered / Capacity)
    // Note: Adjust table name if 'trainer_performance' doesn't exist or use 'coach_performance'
    const { data: opsData } = await supabase
        .from('coach_performance')
        .select('total_clients, coach_id') // Using available columns as proxy if sessions_conducted not available
        .limit(100);

    // B. Growth: Leads & Follow-ups
    // Note: Using 'leads' table if 'enhanced_leads' doesn't exist
    const { data: leadData } = await supabase
        .from('leads') // Fallback to standard leads table
        .select('id, status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h

    // C. System Health: Errors (The "Errors" requirement)
    // Check intervention log for errors or create a sync_logs check
    const { data: errorLogs } = await supabase
        .from('intervention_log') // Using intervention log as proxy for system activity/errors
        .select('trigger_reason, status')
        .eq('status', 'FAILED')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // D. Financials: Deals Closed (from HubSpot synced data)
    const { data: revenueData } = await supabase
        .from('hubspot_deals') // Assuming this table exists from sync
        .select('amount, dealstage')
        .gte('createdate', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // E. Sync Health: Check HubSpot sync status
    const { data: syncLogs } = await supabase
        .from('sync_logs')
        .select('platform, operation_type, status, synced_at, record_count, error_message')
        .eq('platform', 'hubspot')
        .order('synced_at', { ascending: false })
        .limit(10);

    // Analyze sync health
    const lastSync = syncLogs?.[0];
    const failedSyncs = syncLogs?.filter(log => log.status === 'error').length || 0;
    const lastSyncAge = lastSync
        ? Math.round((Date.now() - new Date(lastSync.synced_at).getTime()) / (1000 * 60 * 60))
        : null;
    const syncHealthy = lastSync?.status === 'success' && (lastSyncAge || 999) < 2;

    // 2. CALCULATE METRICS
    // Proxy calculation for utilization based on client load
    const totalClients = opsData?.reduce((sum, t) => sum + (t.total_clients || 0), 0) || 0;
    const activeTrainers = new Set(opsData?.map(t => t.coach_id)).size || 1;
    const THEORETICAL_CAPACITY = activeTrainers * 20; // Assuming 20 clients max per trainer
    const utilizationRate = Math.round((totalClients / THEORETICAL_CAPACITY) * 100);

    const newLeads = leadData?.length || 0;
    const missedFollowUps = leadData?.filter(l => l.status === 'NEW').length || 0;

    // 3. THE "BRAIN" (AI Analysis)
    // We send this context to the AI (Claude)
    const prompt = `
    You are the COO of PTD Fitness. Analyze yesterday's business performance.

    DATA CONTEXT:
    - Utilization: ${utilizationRate}% (${totalClients} active clients managed).
    - Growth: ${newLeads} new leads. ${missedFollowUps} are potentially waiting for follow-up.
    - Revenue: ${revenueData?.length || 0} deals processed recently.
    - System Health: ${errorLogs?.length || 0} failed interventions found.
    - HubSpot Sync: ${lastSync ? `Last sync ${lastSyncAge}h ago (${lastSync.status}), ${failedSyncs} recent failures` : 'No recent sync data'}.

    SYSTEM ERRORS DETAILS:
    ${JSON.stringify(errorLogs?.slice(0, 3))}

    SYNC STATUS:
    ${!syncHealthy ? `WARNING: Sync issues detected - ${failedSyncs} failures or stale data (${lastSyncAge}h old)` : 'Sync healthy'}

    OUTPUT FORMAT (JSON):
    {
      "executive_summary": "A 3-sentence summary of the business health. Be direct.",
      "system_status": "Summary of technical errors or 'Healthy'",
      "action_plan": ["Action 1", "Action 2", "Action 3"]
    }
  `;

    // Call Claude
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    let aiResponse;

    if (ANTHROPIC_API_KEY) {
        try {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01"
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 500,
                    messages: [{ role: "user", content: prompt }]
                })
            });
            const data = await response.json();
            const text = data.content[0]?.text;
            // Extract JSON from text if needed (handling markdown code blocks)
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                const jsonString = jsonMatch ? jsonMatch[0] : text;
                aiResponse = JSON.parse(jsonString);
            } catch {
                // Simple fallback parsing or mock
                aiResponse = {
                    executive_summary: text.replace(/```json|```/g, '').trim(),
                    system_status: "See summary",
                    action_plan: ["Review full report"]
                };
            };
        } catch (e) {
            console.error("AI Call failed", e);
        }
    }

    // Fallback if AI fails or no key
    if (!aiResponse) {
        const statusWarnings = [];
        if (errorLogs?.length) statusWarnings.push(`${errorLogs.length} failed interventions`);
        if (!syncHealthy) statusWarnings.push('HubSpot sync issues');

        aiResponse = {
            executive_summary: `Utilization is at ${utilizationRate}%. You have ${missedFollowUps} new leads to review.`,
            system_status: statusWarnings.length ? `WARNING: ${statusWarnings.join(', ')}.` : "All systems operational.",
            action_plan: [
                missedFollowUps > 0 ? `Review ${missedFollowUps} new leads` : "Monitor lead flow",
                utilizationRate < 70 ? "Focus on client acquisition" : "Maintain service quality",
                !syncHealthy ? "Check HubSpot sync status" : errorLogs?.length ? "Check intervention logs" : "Review weekly goals"
            ]
        };
    }

    // 4. SAVE TO DASHBOARD
    await supabase.from('daily_summary').upsert({
        summary_date: today,
        executive_briefing: aiResponse.executive_summary,
        system_health_status: aiResponse.system_status,
        max_utilization_rate: utilizationRate,
        action_plan: aiResponse.action_plan,
        // Ensure we don't overwrite other fields if they exist, but upsert requires all non-nulls or conflict handling
    }, { onConflict: 'summary_date' });

    // 5. PHASE 3: SMART LEAD FOLLOW-UP
    // Fetch recent leads that don't have an AI reply yet
    const { data: leadsToProcess } = await supabase
        .from('leads')
        .select('id, firstname, fitness_goal, budget_range')
        .is('ai_suggested_reply', null)
        .order('created_at', { ascending: false })
        .limit(5);

    if (leadsToProcess && leadsToProcess.length > 0) {
        console.log(`[Smart Lead Follow-up] Processing ${leadsToProcess.length} leads...`);

        for (const lead of leadsToProcess) {
            let suggestedReply = "";
            const name = lead.firstname || "there";
            const goal = (lead.fitness_goal || "").toLowerCase();
            const budget = parseInt((lead.budget_range || "0").replace(/[^0-9]/g, "")) || 0;

            // Rule 1: High Budget (>15k)
            if (budget > 15000) {
                suggestedReply = `Hi ${name}, I saw you're interested in our premium coaching options. Given your budget, I have a senior coach opening that would be perfect for you. Would you be open to a quick call to discuss?`;
            }
            // Rule 2: Weight Loss Goal
            else if (goal.includes('weight') || goal.includes('fat') || goal.includes('loss')) {
                suggestedReply = `Hi ${name}, thanks for reaching out! We helped a client with similar weight loss goals lose 10kg just last month. I'd love to share how they did it. Are you free for a chat this week?`;
            }
            // Rule 3: Muscle/Strength Goal
            else if (goal.includes('muscle') || goal.includes('strength') || goal.includes('build')) {
                suggestedReply = `Hey ${name}! Awesome that you're looking to build strength. Our hypertrophy program is getting great results right now. When are you looking to get started?`;
            }
            // Default Fallback
            else {
                suggestedReply = `Hi ${name}, thanks for your interest in PTD Fitness! I'd love to learn more about your goals and see if we're a good fit. What's the best time to connect?`;
            }

            // Update the lead with the suggestion
            await supabase
                .from('leads')
                .update({ ai_suggested_reply: suggestedReply })
                .eq('id', lead.id);
        }
    }

    // 6. LOG THIS BI RUN TO SYNC_LOGS
    await supabase.from('sync_logs').insert({
        platform: 'system',
        operation_type: 'business-intelligence',
        status: 'success',
        record_count: 1,
        synced_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
        success: true,
        analysis: aiResponse,
        sync_status: {
            last_sync: lastSync?.synced_at || null,
            last_sync_age_hours: lastSyncAge,
            sync_healthy: syncHealthy,
            recent_failures: failedSyncs
        }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
