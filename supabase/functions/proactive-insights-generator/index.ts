import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Try direct Gemini API first, fallback to Lovable
const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const useDirectGemini = !!geminiApiKey;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    const dubaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    const currentHour = dubaiTime.getHours();

    // Get business rules
    const { data: businessRules } = await supabase
      .from('business_rules')
      .select('*')
      .eq('is_active', true);

    const workingHoursRule = businessRules?.find(r => r.rule_name === 'working_hours');
    const isBusinessHours = currentHour >= 10 && currentHour < 20;

    // Get learned patterns for better recommendations
    const { data: learningRules } = await supabase
      .from('ai_learning_rules')
      .select('*')
      .eq('is_active', true)
      .gte('confidence_score', 0.6)
      .order('success_count', { ascending: false })
      .limit(20);

    // Fetch data sources for insights
    const [
      { data: recentLeads },
      { data: recentCalls },
      { data: clientHealth },
      { data: enhancedLeads },
      { data: deals },
      { data: coachPerformance }
    ] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('call_records').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('client_health_scores').select('*').order('health_score', { ascending: true }).limit(50),
      // Using unified schema: contacts table instead of enhanced_leads
      supabase.from('contacts').select('*').eq('lifecycle_stage', 'lead').order('created_at', { ascending: false }).limit(50),
      supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('coach_performance').select('*').order('report_date', { ascending: false }).limit(10)
    ]);

    const insights: any[] = [];

    // INSIGHT 1: Leads without follow-up (SLA breach risk)
    const leadsNeedingFollowUp = enhancedLeads?.filter(lead => {
      const createdAt = new Date(lead.created_at);
      const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / 60000;
      return minutesSinceCreation > 30 && lead.follow_up_status === 'pending' && isBusinessHours;
    }) || [];

    if (leadsNeedingFollowUp.length > 0) {
      insights.push({
        insight_type: 'sla_breach_risk',
        priority: 'critical',
        status: 'active',
        recommended_action: `${leadsNeedingFollowUp.length} leads have exceeded 30-min SLA. Immediate callback required.`,
        reason: 'Leads waiting > 30 minutes during business hours',
        best_call_time: 'Now - During Business Hours',
        call_script: 'Hi [Name], this is [Your Name] from PTD Fitness. I saw you just reached out - perfect timing! What fitness goals are you looking to achieve?'
      });
    }

    // INSIGHT 2: High-value leads to prioritize
    const highValueLeads = enhancedLeads?.filter(lead => 
      (lead.lead_score || 0) >= 70 || 
      lead.budget_range?.includes('15K') ||
      lead.budget_range?.includes('12K')
    ) || [];

    if (highValueLeads.length > 0) {
      insights.push({
        insight_type: 'high_value_lead',
        priority: 'high',
        status: 'active',
        recommended_action: `${highValueLeads.length} high-value leads identified. Prioritize these for senior closer assignment.`,
        reason: 'Lead score ≥70 or premium budget range',
        best_call_time: isBusinessHours ? 'Now' : 'Tomorrow 10:00 AM Dubai',
        call_script: 'Premium approach: Focus on exclusive 1-on-1 training, flexible scheduling, and proven results.'
      });
    }

    // INSIGHT 3: International numbers needing special routing
    const internationalLeads = enhancedLeads?.filter(lead => {
      const phone = lead.phone || '';
      return phone.startsWith('+') && !phone.startsWith('+971');
    }) || [];

    if (internationalLeads.length > 0) {
      insights.push({
        insight_type: 'international_routing',
        priority: 'medium',
        status: 'active',
        recommended_action: `${internationalLeads.length} international leads detected. Route to International Queue per playbook.`,
        reason: 'Non-UAE phone numbers detected',
        best_call_time: 'Verify timezone before calling',
        call_script: 'Adjust for potential relocation to Dubai or remote coaching options.'
      });
    }

    // INSIGHT 4: Clients at churn risk
    const atRiskClients = clientHealth?.filter(client => 
      client.health_zone === 'RED' || 
      (client.churn_risk_score && client.churn_risk_score > 70)
    ) || [];

    if (atRiskClients.length > 0) {
      insights.push({
        insight_type: 'churn_risk',
        priority: 'critical',
        status: 'active',
        recommended_action: `${atRiskClients.length} clients in RED zone. Urgent retention intervention needed.`,
        reason: 'Health score critical or high churn probability',
        best_call_time: isBusinessHours ? 'Today' : 'Tomorrow 10:00 AM',
        call_script: 'Check-in call: "Hi [Name], I noticed we haven\'t connected in a while. I wanted to personally check in and see how your fitness journey is going..."'
      });
    }

    // INSIGHT 5: Missed calls to follow up
    const missedCalls = recentCalls?.filter(call => 
      call.call_status === 'missed' || call.call_status === 'no_answer'
    ) || [];

    if (missedCalls.length > 0 && isBusinessHours) {
      insights.push({
        insight_type: 'missed_call_callback',
        priority: 'high',
        status: 'active',
        recommended_action: `${missedCalls.length} missed calls need callback. Second dial recommended.`,
        reason: 'Unanswered inbound/outbound calls',
        best_call_time: 'Within 2 hours of original call',
        call_script: 'Hi [Name], I noticed we missed connecting earlier. Is now a good time to chat about your fitness goals?'
      });
    }

    // INSIGHT 6: Night freeze reminder
    if (!isBusinessHours) {
      insights.push({
        insight_type: 'working_hours_notice',
        priority: 'info',
        status: 'active',
        recommended_action: 'Off-hours (20:00-10:00 Dubai). No task creation or reassignment per playbook.',
        reason: 'Outside business hours window',
        best_call_time: 'Resume at 10:00 AM Dubai',
        call_script: 'N/A - Queue tasks for next business day'
      });
    }

    // INSIGHT 7: Coach performance alerts
    const underperformingCoaches = coachPerformance?.filter(coach => 
      (coach.clients_red || 0) > 3 || (coach.avg_client_health || 100) < 50
    ) || [];

    if (underperformingCoaches.length > 0) {
      insights.push({
        insight_type: 'coach_performance',
        priority: 'medium',
        status: 'active',
        recommended_action: `${underperformingCoaches.length} coaches have elevated at-risk clients. Review required.`,
        reason: 'Multiple clients in RED zone per coach',
        best_call_time: 'During weekly review',
        call_script: 'Internal: Schedule 1:1 with coach to review client portfolio and intervention strategies.'
      });
    }

    // Use AI to enhance insights if available
    let aiEnhancedInsights = insights;
    const hasAiKey = geminiApiKey || lovableApiKey;
    if (hasAiKey && insights.length > 0) {
      try {
        const learningContext = learningRules?.map(r => 
          `Pattern: ${JSON.stringify(r.condition_pattern)} → ${JSON.stringify(r.action_pattern)} (confidence: ${r.confidence_score})`
        ).join('\n') || 'No learned patterns yet';

        // Use direct Gemini API or Lovable fallback
        const aiUrl = useDirectGemini 
          ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
          : 'https://ai.gateway.lovable.dev/v1/chat/completions';
        const aiKey = useDirectGemini ? geminiApiKey : lovableApiKey;
        const aiModel = useDirectGemini ? 'gemini-2.0-flash' : 'google/gemini-2.5-flash';

        const response = await fetch(aiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              {
                role: 'system',
                content: `You are a PTD Fitness sales intelligence assistant. Enhance insights with specific, actionable call scripts.
                
LEARNED PATTERNS FROM FEEDBACK:
${learningContext}

BUSINESS RULES:
- Working hours: 10:00-20:00 Dubai
- SLA: 30-min callback required
- International numbers: Route to International Queue
- Task minimization: Only high-value tasks

Return a JSON array of enhanced insights with improved call_script and recommended_action fields.`
              },
              {
                role: 'user',
                content: `Enhance these ${insights.length} insights with better call scripts and actions:\n${JSON.stringify(insights, null, 2)}`
              }
            ],
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              aiEnhancedInsights = JSON.parse(jsonMatch[0]);
            }
          } catch (e) {
            console.log('AI response not JSON, using original insights');
          }
        }
      } catch (e) {
        console.log('AI enhancement failed, using original insights:', e);
      }
    }

    // Store insights in proactive_insights table
    if (aiEnhancedInsights.length > 0) {
      // Clear old active insights first
      await supabase
        .from('proactive_insights')
        .update({ status: 'archived' })
        .eq('status', 'active');

      // Insert new insights
      const { error: insertError } = await supabase
        .from('proactive_insights')
        .insert(aiEnhancedInsights.map(insight => ({
          insight_type: insight.insight_type,
          priority: insight.priority,
          status: 'active',
          recommended_action: insight.recommended_action,
          reason: insight.reason,
          best_call_time: insight.best_call_time,
          call_script: insight.call_script
        })));

      if (insertError) {
        console.error('Insert error:', insertError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      insights_generated: aiEnhancedInsights.length,
      is_business_hours: isBusinessHours,
      dubai_time: dubaiTime.toISOString(),
      insights: aiEnhancedInsights
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
