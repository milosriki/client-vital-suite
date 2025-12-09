import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let processedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    console.log('[Lead Reply Generator] Starting...');

    // 1. Fetch leads that need AI-generated replies
    // Using a processing timestamp to prevent double-processing
    const processingMarker = new Date().toISOString();

    const { data: leadsToProcess, error: fetchError } = await supabase
      .from('leads')
      .select('id, firstname, first_name, fitness_goal, budget_range, email')
      .is('ai_suggested_reply', null)
      .order('created_at', { ascending: false })
      .limit(10); // Process up to 10 leads at a time

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    if (!leadsToProcess || leadsToProcess.length === 0) {
      console.log('[Lead Reply Generator] No leads to process');

      await supabase.from('sync_logs').insert({
        platform: 'lead-reply',
        status: 'success',
        message: 'No leads requiring AI replies',
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No leads to process',
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Lead Reply Generator] Processing ${leadsToProcess.length} leads...`);

    // 2. Mark leads as processing to prevent double-processing
    // We'll update a metadata field or use optimistic updates
    const leadIds = leadsToProcess.map(l => l.id);

    // Mark as processing by setting a temporary marker
    await supabase
      .from('leads')
      .update({
        updated_at: processingMarker
      })
      .in('id', leadIds);

    // 3. Process each lead with Claude API
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    for (const lead of leadsToProcess) {
      try {
        // Use firstname or first_name (handle both field names)
        const name = lead.firstname || lead.first_name || "there";
        const goal = lead.fitness_goal || "general fitness";
        const budget = lead.budget_range || "not specified";
        const email = lead.email || "unknown";

        console.log(`[Lead Reply Generator] Processing lead ${lead.id}: ${name}`);

        // 4. Generate AI-powered personalized reply using Claude
        const prompt = `You are a sales representative for PTD Fitness, a premium personal training business.

A new lead has just come in with the following details:
- Name: ${name}
- Fitness Goal: ${goal}
- Budget Range: ${budget}

Write a warm, personalized, and engaging initial response message that:
1. Addresses them by name
2. Acknowledges their specific fitness goal
3. Shows enthusiasm about helping them achieve their goal
4. Suggests next steps (like scheduling a call or consultation)
5. Keeps it brief (2-3 sentences maximum)
6. Sounds natural and conversational, not salesy

Do not include any greetings like "Subject:" or "Dear" - just the message body.
Be specific about their goal and make them feel understood.`;

        let aiGeneratedReply = "";

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
              max_tokens: 300,
              messages: [{ role: "user", content: prompt }]
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Lead Reply Generator] Claude API error for lead ${lead.id}:`, errorText);
            throw new Error(`Claude API returned ${response.status}`);
          }

          const data = await response.json();
          aiGeneratedReply = data.content[0]?.text?.trim() || "";

          if (!aiGeneratedReply) {
            throw new Error('Empty response from Claude API');
          }

          console.log(`[Lead Reply Generator] Generated reply for ${name}: ${aiGeneratedReply.substring(0, 50)}...`);

        } catch (aiError) {
          console.error(`[Lead Reply Generator] AI generation failed for lead ${lead.id}:`, aiError);

          // 5. Fallback to rule-based reply if AI fails
          aiGeneratedReply = generateFallbackReply(name, goal, budget);
          console.log(`[Lead Reply Generator] Using fallback reply for ${name}`);
        }

        // 6. Update lead with AI-generated reply
        // Use WHERE clause to ensure we only update if ai_suggested_reply is still null
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            ai_suggested_reply: aiGeneratedReply,
            updated_at: new Date().toISOString()
          })
          .eq('id', lead.id)
          .is('ai_suggested_reply', null); // Only update if still null (prevents race conditions)

        if (updateError) {
          console.error(`[Lead Reply Generator] Update failed for lead ${lead.id}:`, updateError);
          errors.push(`Lead ${lead.id} (${name}): ${updateError.message}`);
          errorCount++;
        } else {
          processedCount++;
          console.log(`[Lead Reply Generator] Successfully updated lead ${lead.id}`);
        }

      } catch (leadError) {
        const errorMsg = leadError instanceof Error ? leadError.message : 'Unknown error';
        console.error(`[Lead Reply Generator] Error processing lead ${lead.id}:`, errorMsg);
        errors.push(`Lead ${lead.id}: ${errorMsg}`);
        errorCount++;

        // Reset processing state on failure for this specific lead
        await supabase
          .from('leads')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', lead.id);
      }
    }

    // 7. Log results to sync_logs
    const finalStatus = errorCount === 0 ? 'success' : (processedCount > 0 ? 'warning' : 'error');
    const duration = Date.now() - startTime;

    await supabase.from('sync_logs').insert({
      platform: 'lead-reply',
      status: finalStatus,
      message: `Processed ${processedCount} leads successfully, ${errorCount} errors`,
      error_details: errors.length > 0 ? { errors } : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration
    });

    console.log(`[Lead Reply Generator] Completed: ${processedCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;

    console.error('[Lead Reply Generator] Fatal error:', errorMsg);

    // Log error to sync_logs
    await supabase.from('sync_logs').insert({
      platform: 'lead-reply',
      status: 'error',
      message: 'Lead reply generation failed',
      error_details: {
        error: errorMsg,
        processed: processedCount,
        failed: errorCount
      },
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
        processed: processedCount,
        errors: errorCount
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

/**
 * Generate a rule-based fallback reply when AI is unavailable
 */
function generateFallbackReply(name: string, goal: string, budget: string): string {
  const goalLower = goal.toLowerCase();
  const budgetNum = parseInt(budget.replace(/[^0-9]/g, "")) || 0;

  // Rule 1: High Budget (>15k)
  if (budgetNum > 15000) {
    return `Hi ${name}, I saw you're interested in our premium coaching options. Given your budget, I have a senior coach opening that would be perfect for your ${goal} goals. Would you be open to a quick call to discuss?`;
  }

  // Rule 2: Weight Loss Goal
  if (goalLower.includes('weight') || goalLower.includes('fat') || goalLower.includes('loss') || goalLower.includes('lose')) {
    return `Hi ${name}, thanks for reaching out! We've helped clients with similar weight loss goals achieve amazing results. I'd love to share how we can help you with ${goal}. Are you free for a chat this week?`;
  }

  // Rule 3: Muscle/Strength Goal
  if (goalLower.includes('muscle') || goalLower.includes('strength') || goalLower.includes('build') || goalLower.includes('gain')) {
    return `Hey ${name}! Awesome that you're looking to build strength. Our hypertrophy program is getting great results right now for ${goal}. When are you looking to get started?`;
  }

  // Rule 4: Athletic Performance
  if (goalLower.includes('athletic') || goalLower.includes('performance') || goalLower.includes('sport')) {
    return `Hi ${name}, great to hear you're focused on ${goal}! We work with athletes at all levels and would love to help you reach your performance goals. Can we schedule a quick call to discuss your training?`;
  }

  // Default Fallback
  return `Hi ${name}, thanks for your interest in PTD Fitness! I'd love to learn more about your ${goal} goals and see how we can help. What's the best time to connect this week?`;
}
