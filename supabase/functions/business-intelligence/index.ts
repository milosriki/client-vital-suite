/// <reference lib="deno.ns" />
import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
// Note: LangSmith/LangGraph not used in Deno edge functions - use direct AI calls instead

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to log errors to sync_errors table
async function logError(supabase: any, platform: string, errorType: string, message: string, details: any = {}) {
    console.error(`[BI Agent Error] ${platform}: ${message}`, details);
    await supabase.from('sync_errors').insert({
        platform,
        error_type: errorType,
        error_message: message,
        error_details: details,
        severity: errorType === 'ai_failure' ? 'high' : 'medium',
        source_function: 'business-intelligence'
    });
}

// This Agent answers: "How is my business actually doing today?"
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        // 0. CHECK FOR STALE DATA (Task 9 requirement)
        const { data: lastSuccessSync } = await supabase
            .from('sync_logs')
            .select('started_at')
            .eq('status', 'success')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const hoursSinceLastSync = lastSuccessSync
            ? (Date.now() - new Date(lastSuccessSync.started_at).getTime()) / (1000 * 60 * 60)
            : 999;

        const dataIsStale = hoursSinceLastSync > 24;
        const staleWarning = dataIsStale
            ? `⚠️ CRITICAL WARNING: Data is ${Math.round(hoursSinceLastSync)}h stale! Last sync: ${lastSuccessSync?.started_at || 'Never'}. Analysis may be inaccurate.`
            : null;

        // 1. GET THE HARD DATA (The "Sensors")
        const today = new Date().toISOString().split('T')[0];

        // A. Operational: Utilization (Sessions Delivered / Capacity)
        const { data: opsData, error: opsError } = await supabase
            .from('coach_performance')
            .select('total_clients, coach_name')
            .limit(100);

        if (opsError) {
            await logError(supabase, 'supabase', 'query_error', 'Failed to fetch coach_performance', { error: opsError });
        }

        // B. Growth: Leads & Follow-ups
        const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .select('id, status, created_at')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (leadError) {
            await logError(supabase, 'supabase', 'query_error', 'Failed to fetch leads', { error: leadError });
        }

        // C. System Health: Check sync_errors table
        const { data: recentErrors } = await supabase
            .from('sync_errors')
            .select('platform, error_message, severity, created_at')
            .eq('resolved', false)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(10);

        // D. Financials: Deals Closed (from deals table synced from HubSpot)
        const { data: revenueData, error: revenueError } = await supabase
            .from('deals')
            .select('amount, stage')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (revenueError) {
            await logError(supabase, 'hubspot', 'query_error', 'Failed to fetch deals', { error: revenueError });
        }

        // 2. CALCULATE METRICS
        const totalClients = opsData?.reduce((sum, t) => sum + (t.total_clients || 0), 0) || 0;
        const activeTrainers = new Set(opsData?.map(t => t.coach_name)).size || 1;
        const THEORETICAL_CAPACITY = activeTrainers * 20;
        const utilizationRate = Math.round((totalClients / THEORETICAL_CAPACITY) * 100);

        const newLeads = leadData?.length || 0;
        const missedFollowUps = leadData?.filter(l => l.status === 'NEW').length || 0;

        const criticalErrors = recentErrors?.filter(e => e.severity === 'critical').length || 0;
        const highErrors = recentErrors?.filter(e => e.severity === 'high').length || 0;

        // 3. THE "BRAIN" (AI Analysis)
        const basePrompt = buildAgentPrompt('BUSINESS_INTELLIGENCE', {
            includeROI: true,
            outputFormat: 'EXECUTIVE_SUMMARY'
        });
        
        const prompt = `${basePrompt}

${staleWarning ? `\n${staleWarning}\n` : ''}

DATA CONTEXT:
- Utilization: ${utilizationRate}% (${totalClients} active clients managed by ${activeTrainers} coaches).
- Growth: ${newLeads} new leads. ${missedFollowUps} are potentially waiting for follow-up.
- Revenue: ${revenueData?.length || 0} deals processed recently.
- System Health: ${criticalErrors} critical errors, ${highErrors} high-priority errors.

RECENT SYSTEM ERRORS:
${JSON.stringify(recentErrors?.slice(0, 5) || [])}

OUTPUT FORMAT (JSON):
{
  "executive_summary": "A 3-sentence summary of the business health. Be direct. ${staleWarning ? 'MENTION THE STALE DATA WARNING!' : ''}",
  "system_status": "${staleWarning ? 'STALE DATA WARNING - ' : ''}${(criticalErrors + highErrors) > 0 ? `${criticalErrors} critical, ${highErrors} high errors` : 'Healthy'}",
  "data_freshness": "${dataIsStale ? 'STALE' : 'FRESH'}",
  "action_plan": ["Action 1", "Action 2", "Action 3"]
}`;

        // Call Claude
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        let aiResponse;

        if (ANTHROPIC_API_KEY) {
            try {
                console.log("[BI Agent] Calling Claude for analysis...");
                
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

                if (data.error) {
                    console.error("[BI Agent] Claude API error:", data.error);
                    throw new Error(data.error.message || 'API error');
                }

                const text = data.content[0]?.text;
                console.log("[BI Agent] Claude response received");
                
                try {
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    const jsonString = jsonMatch ? jsonMatch[0] : text;
                    aiResponse = JSON.parse(jsonString);
                } catch {
                    aiResponse = {
                        executive_summary: text.replace(/```json|```/g, '').trim(),
                        system_status: "See summary",
                        data_freshness: dataIsStale ? 'STALE' : 'FRESH',
                        action_plan: ["Review full report"]
                    };
                }
            } catch (e) {
                console.error("[BI Agent] AI Call failed", e);
                await logError(supabase, 'anthropic', 'ai_failure', 'Claude API call failed', { error: String(e) });
            }
        }

        // Fallback if AI fails or no key
        if (!aiResponse) {
            aiResponse = {
                executive_summary: `${staleWarning ? '⚠️ STALE DATA WARNING. ' : ''}Utilization is at ${utilizationRate}%. You have ${missedFollowUps} new leads to review. ${(criticalErrors + highErrors) > 0 ? `Alert: ${criticalErrors + highErrors} unresolved system errors.` : ''}`,
                system_status: dataIsStale ? 'STALE DATA' : ((criticalErrors + highErrors) > 0 ? `${criticalErrors} critical, ${highErrors} high errors` : 'All systems operational'),
                data_freshness: dataIsStale ? 'STALE' : 'FRESH',
                action_plan: [
                    dataIsStale ? 'URGENT: Investigate why syncs are failing' : null,
                    missedFollowUps > 0 ? `Review ${missedFollowUps} new leads` : "Monitor lead flow",
                    utilizationRate < 70 ? "Focus on client acquisition" : "Maintain service quality",
                    (criticalErrors + highErrors) > 0 ? "Resolve system errors" : "Review weekly goals"
                ].filter(Boolean)
            };
        }

        // 4. SAVE TO DASHBOARD
        await supabase.from('daily_summary').upsert({
            summary_date: today,
            executive_briefing: aiResponse.executive_summary,
            system_health_status: aiResponse.system_status,
            max_utilization_rate: utilizationRate,
            action_plan: aiResponse.action_plan,
        }, { onConflict: 'summary_date' });

        // Log success
        await supabase.from('sync_logs').insert({
            platform: 'business-intelligence',
            sync_type: 'daily_analysis',
            status: 'success',
            records_synced: 1,
            started_at: new Date().toISOString()
        });

        console.log(`[BI Agent] Analysis complete. Data freshness: ${aiResponse.data_freshness}`);

        return new Response(JSON.stringify({
            success: true,
            analysis: aiResponse,
            dataFreshness: aiResponse.data_freshness,
            staleWarning: staleWarning || null
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await logError(supabase, 'business-intelligence', 'function_error', message, { stack: String(error) });

        return new Response(JSON.stringify({
            success: false,
            error: message
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
