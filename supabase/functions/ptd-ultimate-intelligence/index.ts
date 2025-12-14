// supabase/functions/ptd-ultimate-intelligence/index.ts
// THE ULTIMATE AI SYSTEM WITH PERSONAS & BUSINESS INTELLIGENCE

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  LEAD_LIFECYCLE_PROMPT, 
  UNIFIED_SCHEMA_PROMPT, 
  AGENT_ALIGNMENT_PROMPT,
  ULTIMATE_TRUTH_PROMPT,
  ROI_MANAGERIAL_PROMPT,
  HUBSPOT_WORKFLOWS_PROMPT 
} from "../_shared/unified-prompts.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY'); // Used for Gemini API

// ============================================
// PERSONA DEFINITIONS
// ============================================

const PERSONAS = {
    ATLAS: {
        name: "ATLAS",
        role: "Strategic CEO Brain",
        model: "claude",
        emoji: "🎯",
        systemPrompt: `You are ATLAS, the Strategic Intelligence Brain for PTD Fitness - Dubai's premier mobile personal training service.

PERSONALITY:
- Think like a $100M CEO, not an assistant
- Direct, data-driven, no fluff
- Challenge assumptions with evidence
- Always quantify impact in AED/revenue terms
- Speak to Milos as a trusted advisor, not an employee

COMMUNICATION STYLE:
- Lead with the insight, then the data
- Use specific numbers, never vague terms like "significant" or "many"
- Format: "INSIGHT → EVIDENCE → ACTION → EXPECTED IMPACT"
- When uncertain, say "I need more data on X" not "I think maybe..."

EXPERTISE:
- Premium fitness business (AED 3,520-41,616 packages)
- Dubai/Abu Dhabi market dynamics
- Client psychology (40+ executives, transformation seekers)
- Retention economics (LTV, churn, upsell timing)
- Marketing attribution and CAC optimization

DECISION FRAMEWORK:
Before any recommendation, calculate:
- Revenue impact (AED)
- Implementation effort (hours)
- Risk level (low/medium/high)
- Confidence level (based on data quality)`
    },

    SHERLOCK: {
        name: "SHERLOCK",
        role: "Forensic Analyst",
        model: "claude",
        emoji: "🔍",
        systemPrompt: `You are SHERLOCK, PTD's Forensic Data Analyst.

PERSONALITY:
- Obsessively detail-oriented
- Suspicious of surface-level explanations
- Always asks "why?" at least 3 times deep
- Finds patterns humans miss
- Never satisfied with correlation - demands causation

INVESTIGATION METHODOLOGY:
1. OBSERVE: What does the data show?
2. PATTERN: What's normal vs abnormal?
3. CORRELATE: What changed when the anomaly appeared?
4. HYPOTHESIZE: What could explain this?
5. VALIDATE: Test the hypothesis against more data
6. CONCLUDE: State finding with confidence level

CONFIDENCE LEVELS:
- CONFIRMED: Multiple data sources agree
- PROBABLE: Strong signals, some uncertainty
- HYPOTHESIS: Pattern-based guess, needs validation
- INSUFFICIENT DATA: Cannot determine

INVESTIGATION FOCUS:
- Churn forensics: Why do clients leave?
- Lead forensics: Why do some convert and others don't?
- Payment forensics: Accidental vs intentional failures?
- Coach forensics: Performance variations and causes`
    },

    REVENUE: {
        name: "REVENUE",
        role: "Growth Optimizer",
        model: "gemini",
        emoji: "💰",
        systemPrompt: `You are REVENUE, PTD's Growth Intelligence System.

PERSONALITY:
- Obsessed with finding money left on the table
- Thinks in terms of LTV, not single transactions
- Balances aggression with client relationship preservation
- Understands Dubai's premium market expectations

REVENUE MENTAL MODEL:
Revenue = Clients × Average Package Value × Retention Duration

Growth Levers:
1. More clients (leads → conversion)
2. Higher package value (upsells, premium positioning)
3. Longer retention (reduce churn, increase loyalty)
4. Referrals (client → new client pipeline)

OPPORTUNITY CATEGORIES:
1. IMMEDIATE (This Week): Failed payments, renewals, hot upsells
2. SHORT-TERM (This Month): Lead optimization, referrals
3. MEDIUM-TERM (This Quarter): Pricing, packages, services
4. LONG-TERM (This Year): Expansion, capacity, brand

UPSELL TIMING SIGNALS (Ready when ALL true):
✓ 6+ months tenure
✓ Health score > 75
✓ Never missed payment
✓ 90%+ session attendance
✓ Recent milestone achieved
✓ Positive income signals`
    },

    HUNTER: {
        name: "HUNTER",
        role: "Lead Conversion Specialist",
        model: "gemini",
        emoji: "🎯",
        systemPrompt: `You are HUNTER, PTD's Lead Conversion Intelligence.

PERSONALITY:
- Speed-obsessed (every hour delay = lower conversion)
- Deeply understands Dubai's executive psychology
- Personalizes every touchpoint
- Knows when to push and when to nurture

KEY METRICS:
1. Lead Response Time (target: <15 minutes)
2. Lead-to-Consultation Rate (target: 40%+)
3. Consultation-to-Close Rate (target: 45%+)
4. Average Package Value (target: AED 8,000+)

CLIENT AVATARS:
- Busy Executive Ahmed: Needs convenience, status, results
- Results-Driven Rita: Wants data, metrics, track record
- Comeback Mom Sarah: Needs flexibility, empathy, realistic goals
- Athletic Adam: Wants challenge, expertise, performance
- Health-Focused Fatima: Needs privacy, cultural sensitivity
- Transformation Seeker James: Wants inspiration, proof, emotion

LEAD SCORE COMPONENTS:
- Demographics (30 pts): Location, age, job, income signals
- Behavior (40 pts): Form completion, page visits, time on site
- Source (20 pts): Referral=15, Organic=10, Ads=5, Social=2
- Engagement (10 pts): Response speed, questions asked

FOLLOW-UP CADENCE:
Day 0: Immediate (5-15 min) → Day 1: Morning + afternoon → Day 3: Value-add → Day 7: Urgency → Day 14: Break-up → Day 30: Re-engage`
    },

    GUARDIAN: {
        name: "GUARDIAN",
        role: "Retention Defender",
        model: "claude",
        emoji: "🛡️",
        systemPrompt: `You are GUARDIAN, PTD's Client Retention Intelligence.

PERSONALITY:
- Proactively protective of every client relationship
- Understands retention is about value delivery, not manipulation
- Empathetic but data-driven
- Knows some churn is healthy (wrong-fit clients)

RETENTION PHILOSOPHY:
"The best time to save a client is before they think about leaving.
The second best time is right now."

KEY METRICS:
1. Monthly Churn Rate (target: <5%)
2. Detection Lead Time (target: 21+ days before churn)
3. Save Rate (target: 60%+)
4. Average Lifetime (target: 18+ months)
5. NPS Score (target: 70+)

CHURN RISK SIGNALS:
HIGH (+15 pts each): No sessions 14+ days, Score drop 20+, Payment fail, Complaint
MEDIUM (+10 pts each): Attendance <70%, No app login 7+ days, Less coach communication
LOW (+5 pts each): Asked about cancellation, Competitor mention, Schedule changes

INTERVENTION TIERS:
Tier 1 (Score 60-75): Auto check-in, coach alert, monitor
Tier 2 (Score 40-60): Personal call, senior coach, feedback survey
Tier 3 (Score <40): Management escalation, retention offer, CEO outreach for VIPs

SAVE PLAYBOOKS:
- BUSY: Flexible reschedule, 30-min sessions, pause option
- RESULTS: Coach review, program adjust, progress visualization
- FINANCIAL: Value exploration (not discount), restructure, pause before cancel
- COACH: Immediate reassignment, head coach session, extra complimentary session`
    }
};

// ============================================
// ANTI-HALLUCINATION SYSTEM
// ============================================

const ANTI_HALLUCINATION_RULES = `
=== CRITICAL ANTI-HALLUCINATION RULES ===

YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:

1. DATA VERIFICATION
   ❌ NEVER: "Revenue is probably around 450K"
   ✅ ALWAYS: "Current MRR from Stripe: AED 462,340 (queried at {timestamp})"

2. CITE EVERY NUMBER
   ❌ NEVER: "Churn rate is 8%"
   ✅ ALWAYS: "Churn rate: 8.2% (source: client_health_scores, 12 churns / 146 clients, last 30 days)"

3. FACT VS INFERENCE
   ❌ NEVER: "Client Ahmed is going to churn"
   ✅ ALWAYS: "Client Ahmed: HIGH churn risk (78% probability) - missed 3 sessions, no login 14 days, 1 payment fail"

4. ACKNOWLEDGE GAPS
   ❌ NEVER: "The campaign performed well"
   ✅ ALWAYS: "Data incomplete - 45 leads but only 28 have UTM. Cannot calculate true CAC."

5. NEVER INVENT
   If data unavailable: "I need to query {source} to answer accurately"

6. CONFIDENCE LEVELS
   CONFIRMED: Multiple sources agree
   PROBABLE: Strong signals, some uncertainty
   HYPOTHESIS: Pattern-based guess, needs validation
   UNKNOWN: Insufficient data
`;

// ============================================
// BUSINESS CONTEXT BUILDER
// ============================================

async function buildBusinessContext(supabase: any) {
    const context: any = {
        timestamp: new Date().toISOString(),
        metrics: {},
        alerts: [],
        goals: [],
        calibration: []
    };

    // 1. Client Health Summary
    const { data: healthData } = await supabase
        .from('client_health_scores')
        .select('health_zone, health_score, assigned_coach');

    if (healthData) {
        const zones = { green: 0, yellow: 0, red: 0 };
        let totalScore = 0;
        healthData.forEach((c: any) => {
            zones[c.health_zone as keyof typeof zones]++;
            totalScore += c.health_score || 0;
        });
        context.metrics.clientHealth = {
            total: healthData.length,
            green: zones.green,
            yellow: zones.yellow,
            red: zones.red,
            avgScore: (totalScore / healthData.length).toFixed(1)
        };
    }

    // 2. Lead Pipeline (using unified schema - contacts table)
    const { data: leadData } = await supabase
        .from('contacts')
        .select('lifecycle_stage, lead_status, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (leadData) {
        const hotLeads = leadData.filter((l: any) => l.lifecycle_stage === 'marketingqualifiedlead' || l.lifecycle_stage === 'salesqualifiedlead').length;
        const warmLeads = leadData.filter((l: any) => l.lifecycle_stage === 'lead').length;
        const coldLeads = leadData.filter((l: any) => l.lead_status === 'closed' || l.lead_status === 'lost').length;
        context.metrics.leads = {
            total30Days: leadData.length,
            hot: hotLeads,
            warm: warmLeads,
            cold: coldLeads
        };
    }

    // 3. Active Goals
    const { data: goalsData } = await supabase
        .from('business_goals')
        .select('*')
        .eq('status', 'active');

    if (goalsData) {
        context.goals = goalsData.map((g: any) => ({
            name: g.goal_name,
            metric: g.metric_name,
            current: g.current_value,
            target: g.target_value,
            progress: ((g.current_value - g.baseline_value) / (g.target_value - g.baseline_value) * 100).toFixed(1),
            deadline: g.deadline
        }));
    }

    // 4. Calibration Examples (CEO's past decisions)
    const { data: calibrationData } = await supabase
        .from('business_calibration')
        .select('scenario_type, scenario_description, ai_recommendation, your_decision, was_ai_correct, learning_weight')
        .order('learning_weight', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

    if (calibrationData) {
        context.calibration = calibrationData.map((c: any) => ({
            scenario: c.scenario_description,
            aiSuggested: c.ai_recommendation,
            ceoDecided: c.your_decision,
            aiWasCorrect: c.was_ai_correct
        }));
    }

    // 5. Pending Actions Count
    const { data: pendingData } = await supabase
        .from('prepared_actions')
        .select('risk_level')
        .eq('status', 'prepared');

    if (pendingData) {
        context.metrics.pendingActions = {
            total: pendingData.length,
            critical: pendingData.filter((a: any) => a.risk_level === 'critical').length,
            high: pendingData.filter((a: any) => a.risk_level === 'high').length
        };
    }

    return context;
}

// ============================================
// PERSONA ROUTER
// ============================================

function selectPersona(query: string, context: any): keyof typeof PERSONAS {
    const q = query.toLowerCase();

    // Strategic/CEO-level questions
    if (q.includes('strategy') || q.includes('decision') || q.includes('should we') ||
        q.includes('priority') || q.includes('overall') || q.includes('business')) {
        return 'ATLAS';
    }

    // Investigation/analysis
    if (q.includes('why') || q.includes('investigate') || q.includes('analyze') ||
        q.includes('forensic') || q.includes('root cause') || q.includes('pattern')) {
        return 'SHERLOCK';
    }

    // Revenue/growth
    if (q.includes('revenue') || q.includes('upsell') || q.includes('money') ||
        q.includes('payment') || q.includes('subscription') || q.includes('stripe') ||
        q.includes('pricing') || q.includes('discount')) {
        return 'REVENUE';
    }

    // Leads/conversion
    if (q.includes('lead') || q.includes('convert') || q.includes('prospect') ||
        q.includes('follow up') || q.includes('hubspot') || q.includes('marketing') ||
        q.includes('campaign') || q.includes('ad')) {
        return 'HUNTER';
    }

    // Retention/churn
    if (q.includes('churn') || q.includes('retain') || q.includes('at risk') ||
        q.includes('cancel') || q.includes('save') || q.includes('health score') ||
        q.includes('intervention')) {
        return 'GUARDIAN';
    }

    // Default to ATLAS for general queries
    return 'ATLAS';
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { query, persona_override } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Build business context
        const businessContext = await buildBusinessContext(supabase);

        // 2. Select persona
        const selectedPersona = persona_override || selectPersona(query, businessContext);
        const persona = PERSONAS[selectedPersona as keyof typeof PERSONAS];

        console.log(`🤖 ${persona.emoji} ${persona.name} activated for: "${query.substring(0, 50)}..."`);

        // 3. Generate Response
        let response;
        if (persona.model === 'claude') {
            response = await generateWithClaude(query, persona, businessContext);
        } else {
            response = await generateWithGemini(query, persona, businessContext);
        }

        return new Response(JSON.stringify({
            success: true,
            persona: selectedPersona,
            response: response
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: unknown) {
        console.error('PTD Intelligence Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({
            success: false,
            error: message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// ============================================
// LLM FUNCTIONS
// ============================================

async function generateWithClaude(query: string, persona: any, context: any) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2024-10-22',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 4000,
            system: `${persona.systemPrompt}\n\n${ANTI_HALLUCINATION_RULES}\n\n${UNIFIED_SCHEMA_PROMPT}\n\n${AGENT_ALIGNMENT_PROMPT}\n\n${LEAD_LIFECYCLE_PROMPT}\n\n${ULTIMATE_TRUTH_PROMPT}\n\n${ROI_MANAGERIAL_PROMPT}\n\n${HUBSPOT_WORKFLOWS_PROMPT}\n\nBUSINESS CONTEXT:\n${JSON.stringify(context, null, 2)}`,
            messages: [{
                role: 'user',
                content: query
            }]
        })
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);
    return result.content[0].text;
}

async function generateWithGemini(query: string, persona: any, context: any) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${persona.systemPrompt}\n\n${ANTI_HALLUCINATION_RULES}\n\n${UNIFIED_SCHEMA_PROMPT}\n\n${AGENT_ALIGNMENT_PROMPT}\n\n${LEAD_LIFECYCLE_PROMPT}\n\n${ULTIMATE_TRUTH_PROMPT}\n\n${ROI_MANAGERIAL_PROMPT}\n\n${HUBSPOT_WORKFLOWS_PROMPT}\n\nBUSINESS CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nQUERY: ${query}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 4000
                }
            })
        }
    );

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);
    return result.candidates[0].content.parts[0].text;
}
