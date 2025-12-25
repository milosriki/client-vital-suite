/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.20.0";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required');
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AnalystQuery {
  query: string;
  context?: {
    client_id?: string;
    coach_id?: string;
    date_range?: { start: string; end: string };
  };
  session_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AnalystQuery = await req.json();
    const { query, context, session_id } = body;

    if (!query || !session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: query and session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch relevant data based on context
    let dataContext = '';

    if (context?.client_id) {
      const { data: client } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('email', context.client_id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (client) {
        dataContext = `Client Data:\n${JSON.stringify(client, null, 2)}\n\n`;
      }
    }

    if (context?.coach_id) {
      const { data: coachData } = await supabase
        .from('coach_performance')
        .select('*')
        .eq('coach_name', context.coach_id)
        .order('report_date', { ascending: false })
        .limit(1)
        .single();

      if (coachData) {
        dataContext += `Coach Performance:\n${JSON.stringify(coachData, null, 2)}\n\n`;
      }
    }

    const SYSTEM_PROMPT = buildAgentPrompt('AGENT_ANALYST', {
      additionalContext: `Track: response times, accuracy rates, token usage, error rates

EXPERTISE AREAS:
1. Client Analytics: Churn prediction, engagement patterns, health scores
2. Coach Performance: Productivity, client satisfaction, revenue per trainer
3. Revenue Analysis: Package performance, upsell opportunities, pricing optimization
4. Market Intelligence: Dubai fitness market trends, competitor analysis

ANALYSIS FRAMEWORK:
- Always quantify impacts (% changes, AED amounts, client counts)
- Prioritize recommendations by ROI and implementation effort
- Flag risks with severity (HIGH/MEDIUM/LOW)
- Include confidence levels for predictions`
    });

    // Call Claude for analysis
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${dataContext}

User Query: ${query}

Provide a comprehensive analysis with:
1. Key insights
2. Actionable recommendations
3. Risk factors (if any)
4. Opportunities

Be specific and data-driven.`
      }]
    });

    const analysis = message.content[0].type === 'text' ? message.content[0].text : '';

    // Store analysis in database
    await supabase.from('agent_conversations').insert({
      session_id,
      role: 'analyst',
      message: query,
      response: analysis,
      metadata: { context, model: 'claude-sonnet-4-5' }
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        session_id,
        context
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Analyst error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate analysis',
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
