import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { traceStart, traceEnd } from "../_shared/langsmith-tracing.ts";

// const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { command, context } = await req.json();

    if (!command) {
      throw new Error('Command is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`🤖 PTD Self-Developer received command: ${command}`);

    // Fetch existing context from database
    const { data: existingPatterns } = await supabase
      .from('agent_patterns')
      .select('pattern_name, description, examples')
      .order('usage_count', { ascending: false })
      .limit(10);

    const { data: recentActions } = await supabase
      .from('prepared_actions')
      .select('action_title, action_type, status, confidence')
      .order('created_at', { ascending: false })
      .limit(5);

    // Build the AI prompt
    const systemPrompt = `You are PTD Self-Developer, an autonomous AI agent that builds and modifies the PTD Fitness application.

## Your Capabilities:
1. **Code Generation**: Create React components, TypeScript files, and Edge Functions
2. **Database Changes**: Design SQL migrations for Supabase
3. **Analysis**: Analyze existing code patterns and suggest improvements
4. **Documentation**: Generate README files and inline documentation

## Project Context:
- Stack: React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase
- Database: Supabase PostgreSQL with RLS policies
- Edge Functions: Deno runtime with TypeScript

## Recent Actions:
${JSON.stringify(recentActions || [], null, 2)}

## Learned Patterns:
${JSON.stringify(existingPatterns || [], null, 2)}

## Response Format:
Always respond with a JSON object containing:
{
  "action_type": "code_deploy" | "database" | "analysis" | "documentation",
  "action_title": "Brief title for the action",
  "action_description": "Detailed description of what this does",
  "reasoning": "Why this is the right approach",
  "expected_impact": "What changes when this is deployed",
  "risk_level": "low" | "medium" | "high",
  "confidence": 0.0-1.0,
  "prepared_payload": {
    "files": [{ "path": "src/...", "content": "..." }], // for code_deploy
    "sql": "...", // for database
    "analysis": "..." // for analysis
  }
}

## Guidelines:
- Always use semantic Tailwind tokens from the design system
- Use shadcn/ui components where appropriate
- Follow existing code patterns in the project
- Include proper error handling and loading states
- Add proper TypeScript types
- Use lucide-react for icons`;

    // Call UnifiedAIClient
    const runId = await traceStart("ptd_self_developer", { command, context });

    const response = await unifiedAI.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Command: ${command}\nContext: ${JSON.stringify(context || {})}` }
    ], {
      max_tokens: 2000,
      temperature: 0.2, // Low temperature for precise code generation
      response_format: { type: "json_object" }
    });

    let result;
    try {
      result = JSON.parse(response.content);
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      // Fallback if JSON parsing fails
      result = {
        action_type: "analysis",
        action_title: "Error parsing AI response",
        action_description: "The AI generated a response that could not be parsed as JSON.",
        reasoning: "JSON parse error",
        expected_impact: "None",
        risk_level: "low",
        confidence: 0,
        prepared_payload: { analysis: response.content }
      };
    }

    await traceEnd(runId, { result });

    // Store the prepared action in the database
    const { data: actionRecord, error: dbError } = await supabase
      .from('prepared_actions')
      .insert({
        action_type: result.action_type,
        action_title: result.action_title,
        description: result.action_description,
        reasoning: result.reasoning,
        impact_analysis: result.expected_impact,
        risk_level: result.risk_level,
        confidence_score: result.confidence,
        payload: result.prepared_payload,
        status: 'pending_approval',
        source_agent: 'ptd-self-developer',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error("Failed to store prepared action:", dbError);
    }

    return new Response(JSON.stringify({
      success: true,
      action: result,
      action_id: actionRecord?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error in PTD Self-Developer:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});


