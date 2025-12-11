// supabase/functions/ai-ceo-master/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GEMINI_API_KEY = Deno.env.get('GOOGLE_API_KEY');

// ============================================
// PERSONA DEFINITIONS (The Brains)
// ============================================

const PERSONAS = {
    ATLAS: {
        name: "ATLAS",
        role: "Strategic CEO Brain",
        emoji: "🎯",
        systemPrompt: `You are ATLAS, the Strategic Intelligence Brain for PTD Fitness.
PERSONALITY: Think like a $100M CEO. Direct, data-driven, no fluff. Challenge assumptions.
EXPERTISE: Premium fitness business, Dubai market, Client psychology, Retention economics.`
    },
    SHERLOCK: {
        name: "SHERLOCK",
        role: "Forensic Analyst",
        emoji: "🔍",
        systemPrompt: `You are SHERLOCK, PTD's Forensic Data Analyst.
PERSONALITY: Obsessively detail-oriented. Suspicious. Always asks "why?". Finds patterns humans miss.
FOCUS: Churn forensics, Lead forensics, Payment forensics.`
    },
    REVENUE: {
        name: "REVENUE",
        role: "Growth Optimizer",
        emoji: "💰",
        systemPrompt: `You are REVENUE, PTD's Growth Intelligence System.
PERSONALITY: Obsessed with finding money. Thinks in LTV. Balances aggression with relationship.
FOCUS: Upsells, pricing, failed payments, referrals.`
    },
    HUNTER: {
        name: "HUNTER",
        role: "Lead Conversion Specialist",
        emoji: "🎯",
        systemPrompt: `You are HUNTER, PTD's Lead Conversion Intelligence.
PERSONALITY: Speed-obsessed. Personalizes every touchpoint. Knows when to push.
FOCUS: Lead response, conversion rate, sales psychology.`
    },
    GUARDIAN: {
        name: "GUARDIAN",
        role: "Retention Defender",
        emoji: "🛡️",
        systemPrompt: `You are GUARDIAN, PTD's Client Retention Intelligence.
PERSONALITY: Protective of client relationships. Empathetic but data-driven.
FOCUS: Churn prevention, client success, save playbooks.`
    }
};

function selectPersona(query: string): keyof typeof PERSONAS {
    const q = query.toLowerCase();
    if (q.includes('why') || q.includes('investigate') || q.includes('analyze') || q.includes('pattern')) return 'SHERLOCK';
    if (q.includes('revenue') || q.includes('upsell') || q.includes('money') || q.includes('payment')) return 'REVENUE';
    if (q.includes('lead') || q.includes('convert') || q.includes('prospect') || q.includes('sales')) return 'HUNTER';
    if (q.includes('churn') || q.includes('retain') || q.includes('risk') || q.includes('save')) return 'GUARDIAN';
    return 'ATLAS'; // Default
}

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { command } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Gather Context
        const { data: goals } = await supabase.from('business_goals').select('*').eq('status', 'active');
        const { data: calibration } = await supabase.rpc('get_calibration_examples', { limit_count: 5 });
        const { data: pendingStats } = await supabase.rpc('get_pending_actions_summary');

        const businessContext = `
## BUSINESS CONTEXT
Active Goals: ${goals?.map((g: any) => `${g.goal_name}`).join(', ') || 'None'}
Pending Actions: ${pendingStats?.[0]?.total_pending || 0}
CEO Calibration: ${calibration?.length || 0} examples loaded.
`;

        // 2. Select Persona & Model
        const isCodeRequest = command.toLowerCase().includes('build') || command.toLowerCase().includes('create') || command.toLowerCase().includes('fix');
        const personaKey = isCodeRequest ? 'ATLAS' : selectPersona(command); // ATLAS handles code/strategy
        const persona = PERSONAS[personaKey];

        console.log(`🤖 Activated Persona: ${persona.name} (${persona.emoji}) for command: "${command}"`);

        // 3. Generate Response
        let response;
        if (isCodeRequest) {
            response = await generateWithClaude(command, businessContext, persona);
        } else {
            response = await generateWithGemini(command, businessContext, persona);
        }

        // 4. Save Action
        const { data: action, error: insertError } = await supabase
            .from('prepared_actions')
            .insert({
                action_type: response.action_type,
                action_title: response.title,
                action_description: response.description,
                reasoning: `[${persona.emoji} ${persona.name}] ${response.reasoning}`,
                expected_impact: response.expected_impact,
                risk_level: response.risk_level,
                confidence: response.confidence,
                prepared_payload: response.payload,
                supporting_data: { command, context: businessContext, persona: persona.name },
                priority: response.risk_level === 'critical' ? 90 : response.risk_level === 'high' ? 70 : 50,
                source_agent: `ai_ceo_${persona.name.toLowerCase()}`
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return new Response(JSON.stringify({
            success: true,
            status: 'awaiting_approval',
            action_id: action.id,
            preview: {
                title: response.title,
                persona: persona.name,
                emoji: persona.emoji
            }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

async function generateWithClaude(command: string, context: string, persona: any) {
    const systemPrompt = `${persona.systemPrompt}
    
${context}

You are generating a JSON action plan.
RESPOND WITH VALID JSON ONLY:
{
  "action_type": "code_deploy",
  "title": "Brief title",
  "description": "Description",
  "reasoning": "Why this solves it",
  "expected_impact": "Impact",
  "risk_level": "low|medium|high",
  "confidence": 0.9,
  "payload": { "files": [] }
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: command }]
        })
    });
    const result = await response.json();
    const text = result.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

async function generateWithGemini(command: string, context: string, persona: any) {
    const systemPrompt = `${persona.systemPrompt}
    
${context}

You are generating a JSON analysis/action.
RESPOND WITH VALID JSON ONLY:
{
  "action_type": "analysis",
  "title": "Title",
  "description": "Description",
  "reasoning": "Analysis",
  "expected_impact": "Impact",
  "risk_level": "low",
  "confidence": 0.9,
  "payload": { "findings": [] }
}`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\nQUERY: ${command}` }] }]
            })
        }
    );
    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}
