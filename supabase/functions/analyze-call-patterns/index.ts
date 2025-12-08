import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CALL PATTERN ANALYSIS AGENT
// Analyzes client call frequency and detects pattern breaks
// Triggers interventions for clients below their usual pattern
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CallPatternResult {
  client_email: string;
  client_name: string;
  calls_this_week: number;
  avg_calls_per_week: number;
  deviation_pct: number;
  pattern_status: string;
  health_zone?: string;
}

// Get start of current week (Monday)
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Calculate pattern status based on deviation
function calculatePatternStatus(avgPerWeek: number, thisWeekCalls: number): string {
  if (avgPerWeek === 0) return 'NORMAL';

  const deviation = ((thisWeekCalls - avgPerWeek) / avgPerWeek) * 100;

  if (deviation < -50) return 'PATTERN_BREAK'; // 50% drop
  if (deviation < -25) return 'BELOW_PATTERN';   // 25-50% drop
  if (deviation > 50) return 'ABOVE_PATTERN';    // 50% increase

  return 'NORMAL';
}

async function analyzeClientPattern(client: any): Promise<CallPatternResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const weekStart = getWeekStart();
  weekStart.setHours(0, 0, 0, 0);

  // Get call records for this client (last 30 days)
  const { data: calls, error: callsError } = await supabase
    .from('call_records')
    .select('*')
    .eq('client_email', client.email)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (callsError) {
    console.error(`Error fetching calls for ${client.email}:`, callsError);
    return {
      client_email: client.email,
      client_name: `${client.firstname || ''} ${client.lastname || ''}`.trim(),
      calls_this_week: 0,
      avg_calls_per_week: 0,
      deviation_pct: 0,
      pattern_status: 'NORMAL',
      health_zone: client.health_zone
    };
  }

  const totalCalls = calls?.length || 0;
  const avgPerWeek = totalCalls / 4.3; // 30 days ≈ 4.3 weeks

  // Get this week's calls
  const thisWeekCalls = calls?.filter((call: any) =>
    new Date(call.created_at) >= weekStart
  ).length || 0;

  // Calculate deviation
  const deviation = avgPerWeek > 0
    ? ((thisWeekCalls - avgPerWeek) / avgPerWeek) * 100
    : 0;

  // Determine status
  const status = calculatePatternStatus(avgPerWeek, thisWeekCalls);

  return {
    client_email: client.email,
    client_name: `${client.firstname || ''} ${client.lastname || ''}`.trim(),
    calls_this_week: thisWeekCalls,
    avg_calls_per_week: Math.round(avgPerWeek * 10) / 10, // Round to 1 decimal
    deviation_pct: Math.round(deviation * 10) / 10,
    pattern_status: status,
    health_zone: client.health_zone
  };
}

async function savePatternAnalysis(result: CallPatternResult): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Save to call_pattern_analysis table
  const { error: insertError } = await supabase
    .from('call_pattern_analysis')
    .insert({
      client_email: result.client_email,
      analysis_date: today,
      calls_this_week: result.calls_this_week,
      avg_calls_per_week: result.avg_calls_per_week,
      pattern_status: result.pattern_status,
      deviation_pct: result.deviation_pct
    });

  if (insertError) {
    console.error(`Error saving pattern analysis for ${result.client_email}:`, insertError);
  }

  // Update client_health_scores
  const { error: updateError } = await supabase
    .from('client_health_scores')
    .update({
      avg_calls_per_week: result.avg_calls_per_week,
      calls_this_week: result.calls_this_week,
      pattern_status: result.pattern_status,
      last_pattern_check: new Date().toISOString()
    })
    .eq('email', result.client_email);

  if (updateError) {
    console.error(`Error updating client health scores for ${result.client_email}:`, updateError);
  }
}

async function createInterventionForPatternBreak(result: CallPatternResult): Promise<void> {
  if (result.pattern_status !== 'PATTERN_BREAK') return;

  const message = `Usually books ${result.avg_calls_per_week.toFixed(1)}x/week, only ${result.calls_this_week} this week`;

  try {
    // Invoke intervention-recommender
    const { data, error } = await supabase.functions.invoke('intervention-recommender', {
      body: {
        client_email: result.client_email,
        trigger: 'pattern_break',
        zones: [result.health_zone],
        limit: 1,
        generate_messages: true,
        save_to_db: true,
        context: {
          usual: result.avg_calls_per_week,
          current: result.calls_this_week,
          message: message
        }
      }
    });

    if (error) {
      console.error(`Error creating intervention for ${result.client_email}:`, error);
    } else {
      console.log(`✅ Intervention created for ${result.client_email} - ${message}`);
    }
  } catch (err) {
    console.error(`Failed to invoke intervention-recommender for ${result.client_email}:`, err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { client_email, limit = 100 } = await req.json().catch(() => ({}));

    console.log("[Call Pattern Analysis] Starting analysis...");

    // Get active clients from client_health_scores
    let query = supabase
      .from("client_health_scores")
      .select("email, firstname, lastname, health_zone, assigned_coach")
      .order("email");

    if (client_email) {
      query = query.eq("email", client_email);
    } else {
      query = query.limit(limit);
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      console.log("[Call Pattern Analysis] No clients found");
      return new Response(JSON.stringify({
        success: true,
        duration_ms: Date.now() - startTime,
        analyzed: 0,
        pattern_breaks: 0,
        results: []
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    console.log(`[Call Pattern Analysis] Analyzing ${clients.length} clients...`);

    const results: CallPatternResult[] = [];
    let patternBreakCount = 0;

    // Analyze each client
    for (const client of clients) {
      try {
        const result = await analyzeClientPattern(client);
        results.push(result);

        // Save analysis
        await savePatternAnalysis(result);

        // Create intervention if pattern break detected
        if (result.pattern_status === 'PATTERN_BREAK') {
          patternBreakCount++;
          await createInterventionForPatternBreak(result);
        }
      } catch (err) {
        console.error(`Error analyzing ${client.email}:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Call Pattern Analysis] Complete in ${duration}ms - ${results.length} analyzed, ${patternBreakCount} pattern breaks`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      analyzed: results.length,
      pattern_breaks: patternBreakCount,
      results: results,
      summary: {
        normal: results.filter(r => r.pattern_status === 'NORMAL').length,
        below_pattern: results.filter(r => r.pattern_status === 'BELOW_PATTERN').length,
        above_pattern: results.filter(r => r.pattern_status === 'ABOVE_PATTERN').length,
        pattern_break: results.filter(r => r.pattern_status === 'PATTERN_BREAK').length
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Call Pattern Analysis] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
