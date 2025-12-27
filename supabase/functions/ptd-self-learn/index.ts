import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('🧠 Starting self-learning cycle...');

    // 1. Discover system structure
    const { data: tables } = await supabase.rpc('get_all_tables');
    const { data: functions } = await supabase.rpc('get_all_functions');

    const systemStructure = {
      type: 'system_structure',
      discovered_at: new Date().toISOString(),
      tables: tables?.map((t: any) => ({
        name: t.table_name,
        columns: t.column_count,
        rows: t.row_estimate
      })) || [],
      functions: functions?.map((f: any) => ({
        name: f.function_name,
        params: f.parameter_count,
        returns: f.return_type
      })) || [],
      summary: `${tables?.length || 0} tables, ${functions?.length || 0} functions`
    };

    await supabase.from('agent_context').upsert({
      key: 'system_structure',
      value: systemStructure,
      agent_type: 'auto_discovery',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    console.log('✅ System structure discovered:', systemStructure.summary);

    // 2. Learn recent data patterns
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const [healthData, eventsData, callsData, dealsData] = await Promise.all([
      supabase.from('client_health_scores')
        .select('health_zone, health_score, assigned_coach')
        .gte('calculated_at', sevenDaysAgo).limit(200),
      supabase.from('events')
        .select('event_name, source, status')
        .gte('event_time', sevenDaysAgo).limit(200),
      supabase.from('call_records')
        .select('call_status, call_outcome, lead_quality')
        .gte('created_at', sevenDaysAgo).limit(200),
      supabase.from('deals')
        .select('stage, status, deal_value')
        .gte('created_at', sevenDaysAgo).limit(200)
    ]);

    const countBy = (data: any[] | null, key: string) => {
      if (!data) return {};
      return data.reduce((acc, item) => {
        const val = item[key] || 'unknown';
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    };

    const avgOf = (data: any[] | null, key: string) => {
      if (!data || data.length === 0) return null;
      const vals = data.map(d => d[key]).filter(v => typeof v === 'number');
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : null;
    };

    const dataPatterns = {
      type: 'data_patterns',
      analyzed_at: new Date().toISOString(),
      health_zones: countBy(healthData.data, 'health_zone'),
      coaches: countBy(healthData.data, 'assigned_coach'),
      event_types: countBy(eventsData.data, 'event_name'),
      event_sources: countBy(eventsData.data, 'source'),
      call_outcomes: countBy(callsData.data, 'call_outcome'),
      call_quality: countBy(callsData.data, 'lead_quality'),
      deal_stages: countBy(dealsData.data, 'stage'),
      deal_statuses: countBy(dealsData.data, 'status'),
      avg_health: avgOf(healthData.data, 'health_score'),
      avg_deal_value: avgOf(dealsData.data, 'deal_value'),
      sample_sizes: {
        health: healthData.data?.length || 0,
        events: eventsData.data?.length || 0,
        calls: callsData.data?.length || 0,
        deals: dealsData.data?.length || 0
      }
    };

    await supabase.from('agent_context').upsert({
      key: 'data_patterns',
      value: dataPatterns,
      agent_type: 'auto_learning',
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    });

    console.log('✅ Data patterns analyzed');

    // 3. Analyze recent agent interactions for meta-learning
    const { data: recentMemories } = await supabase
      .from('agent_memory')
      .select('query, knowledge_extracted')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    const queryTypes: Record<string, number> = {};
    recentMemories?.forEach((m: any) => {
      const type = m.knowledge_extracted?.pattern_type || 'unknown';
      queryTypes[type] = (queryTypes[type] || 0) + 1;
    });

    await supabase.from('agent_context').upsert({
      key: 'interaction_patterns',
      value: {
        type: 'interaction_patterns',
        analyzed_at: new Date().toISOString(),
        query_types: queryTypes,
        total_interactions: recentMemories?.length || 0
      },
      agent_type: 'meta_learning',
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    });

    console.log('✅ Interaction patterns analyzed');

    // 4. Cleanup old data
    await supabase.from('agent_context')
      .delete()
      .lt('expires_at', new Date().toISOString());

    console.log('🧹 Cleaned up expired context');

    return new Response(JSON.stringify({
      success: true,
      learned: {
        tables: tables?.length || 0,
        functions: functions?.length || 0,
        health_samples: healthData.data?.length || 0,
        event_samples: eventsData.data?.length || 0,
        call_samples: callsData.data?.length || 0,
        deal_samples: dealsData.data?.length || 0,
        interactions: recentMemories?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Self-learning error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
