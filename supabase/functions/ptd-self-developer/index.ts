import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Command: ${command}\n\nAdditional Context: ${JSON.stringify(context || {})}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const responseText = aiResponse.content?.[0]?.text || '';

    console.log('🤖 AI Response received, length:', responseText.length);

    // Parse the JSON from AI response
    let parsedAction;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, responseText];
      parsedAction = JSON.parse(jsonMatch[1] || responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Create a fallback action for analysis type
      parsedAction = {
        action_type: 'analysis',
        action_title: 'AI Response',
        action_description: responseText.substring(0, 500),
        reasoning: 'Raw AI response (not JSON formatted)',
        expected_impact: 'Review required',
        risk_level: 'low',
        confidence: 0.5,
        prepared_payload: { analysis: responseText }
      };
    }

    // Insert the prepared action into the database
    const { data: insertedAction, error: insertError } = await supabase
      .from('prepared_actions')
      .insert({
        action_type: parsedAction.action_type || 'analysis',
        action_title: parsedAction.action_title || 'Untitled Action',
        action_description: parsedAction.action_description || '',
        reasoning: parsedAction.reasoning || '',
        expected_impact: parsedAction.expected_impact || '',
        risk_level: parsedAction.risk_level || 'medium',
        confidence: parsedAction.confidence || 0.5,
        prepared_payload: parsedAction.prepared_payload || {},
        status: 'prepared',
        priority: parsedAction.risk_level === 'high' ? 1 : parsedAction.risk_level === 'medium' ? 2 : 3,
        source_agent: 'ptd-self-developer'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert action:', insertError);
      throw insertError;
    }

    console.log('✅ Action prepared:', insertedAction?.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Action prepared successfully',
      action: insertedAction
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('PTD Self-Developer error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
