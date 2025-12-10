import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// FEEDBACK LEARNING SYSTEM
// Continuous improvement from user corrections
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================
// TYPES
// ============================================

interface FeedbackRequest {
  action: "submit_feedback" | "get_stats" | "get_corrections" | "apply_corrections";
  thread_id?: string;
  query?: string;
  response?: string;
  feedback_type?: "positive" | "negative" | "correction";
  correction?: string;
  rating?: number;
  feedback_details?: any;
}

interface CorrectionPattern {
  id: string;
  pattern: string;
  correct_answer: string;
  confidence: number;
  times_applied: number;
  similarity?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize query text for pattern matching
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Extract key terms from a query for pattern creation
 */
function extractPattern(query: string): string {
  const normalized = normalizeQuery(query);
  const words = normalized.split(" ");

  // Remove common stop words
  const stopWords = new Set([
    "what", "how", "why", "when", "where", "who", "which", "the", "a", "an",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "can", "to", "of", "in", "for", "on", "with", "at", "by", "from", "about"
  ]);

  const keyWords = words.filter(w => w.length > 2 && !stopWords.has(w));

  // Return top 5 most relevant words
  return keyWords.slice(0, 5).join(" ");
}

/**
 * Extract context tags from query and correction
 */
function extractTags(query: string, correction?: string): string[] {
  const text = `${query} ${correction || ""}`.toLowerCase();
  const tags: string[] = [];

  // Domain-specific tags
  if (text.includes("health") || text.includes("score")) tags.push("health_score");
  if (text.includes("formula") || text.includes("calculation")) tags.push("formula");
  if (text.includes("client") || text.includes("customer")) tags.push("client_analysis");
  if (text.includes("coach")) tags.push("coach");
  if (text.includes("risk") || text.includes("churn")) tags.push("risk_prediction");
  if (text.includes("intervention") || text.includes("recommend")) tags.push("intervention");
  if (text.includes("zone") || text.includes("red") || text.includes("green")) tags.push("zone_classification");
  if (text.includes("momentum") || text.includes("trend")) tags.push("momentum");
  if (text.includes("engagement")) tags.push("engagement");
  if (text.includes("package")) tags.push("package_health");

  return tags.length > 0 ? tags : ["general"];
}

/**
 * Find relevant corrections for a query
 */
async function findRelevantCorrections(query: string, minConfidence = 0.5): Promise<CorrectionPattern[]> {
  try {
    const { data, error } = await supabase.rpc("find_relevant_corrections", {
      query_text: query,
      min_confidence: minConfidence,
      max_results: 5
    });

    if (error) {
      console.error("[Feedback] Error finding corrections:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("[Feedback] Exception finding corrections:", error);
    return [];
  }
}

/**
 * Create a new correction pattern from user feedback
 */
async function learnFromCorrection(
  query: string,
  wrongAnswer: string,
  correctAnswer: string,
  feedbackId: string
): Promise<void> {
  try {
    const pattern = extractPattern(query);
    const tags = extractTags(query, correctAnswer);

    console.log(`[Feedback] Learning new pattern: "${pattern}"`);

    // Check if similar pattern already exists
    const { data: existing } = await supabase
      .from("agent_corrections")
      .select("*")
      .eq("pattern", pattern)
      .single();

    if (existing) {
      // Update existing correction
      console.log("[Feedback] Updating existing correction");

      await supabase
        .from("agent_corrections")
        .update({
          correct_answer: correctAnswer,
          times_confirmed: existing.times_confirmed + 1,
          confidence: Math.min(1.0, existing.confidence + 0.1),
          feedback_ids: [...(existing.feedback_ids || []), feedbackId],
          context_tags: Array.from(new Set([...(existing.context_tags || []), ...tags])),
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    } else {
      // Create new correction
      console.log("[Feedback] Creating new correction");

      await supabase
        .from("agent_corrections")
        .insert({
          pattern,
          wrong_answer: wrongAnswer,
          correct_answer: correctAnswer,
          confidence: 0.6, // Start with moderate confidence
          times_applied: 0,
          times_confirmed: 1,
          times_rejected: 0,
          context_tags: tags,
          feedback_ids: [feedbackId]
        });
    }

    // Mark feedback as learned
    await supabase
      .from("agent_feedback")
      .update({ learned_at: new Date().toISOString() })
      .eq("id", feedbackId);

    console.log("[Feedback] Successfully learned from correction");
  } catch (error) {
    console.error("[Feedback] Error learning from correction:", error);
    throw error;
  }
}

/**
 * Submit user feedback
 */
async function submitFeedback(request: FeedbackRequest): Promise<any> {
  const {
    thread_id,
    query,
    response,
    feedback_type,
    correction,
    rating,
    feedback_details
  } = request;

  if (!query || !response) {
    throw new Error("Missing required fields: query and response");
  }

  try {
    // Insert feedback record
    const { data: feedbackRecord, error: insertError } = await supabase
      .from("agent_feedback")
      .insert({
        thread_id,
        query,
        response,
        feedback_type,
        correction,
        rating,
        feedback_details
      })
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`[Feedback] Recorded ${feedback_type} feedback for thread ${thread_id}`);

    // If this is a correction, learn from it
    if (feedback_type === "correction" && correction) {
      await learnFromCorrection(query, response, correction, feedbackRecord.id);
    }

    // Update confidence for related corrections if positive/negative feedback
    if (feedback_type === "positive" || feedback_type === "negative") {
      const relevantCorrections = await findRelevantCorrections(query, 0.3);

      for (const corr of relevantCorrections) {
        if (corr.similarity && corr.similarity > 0.5) {
          await supabase.rpc("update_correction_confidence", {
            correction_id: corr.id,
            was_helpful: feedback_type === "positive"
          });

          // Track that this correction was applied
          await supabase
            .from("agent_corrections")
            .update({
              times_applied: corr.times_applied + 1
            })
            .eq("id", corr.id);
        }
      }
    }

    return {
      success: true,
      feedback_id: feedbackRecord.id,
      learned: feedback_type === "correction",
      message: feedback_type === "correction"
        ? "Thank you! I've learned from this correction and will improve future responses."
        : "Thank you for your feedback!"
    };
  } catch (error) {
    console.error("[Feedback] Error submitting feedback:", error);
    throw error;
  }
}

/**
 * Get feedback statistics
 */
async function getFeedbackStats(daysBack = 7): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("get_feedback_stats", {
      days_back: daysBack
    });

    if (error) throw error;

    return {
      success: true,
      stats: data
    };
  } catch (error) {
    console.error("[Feedback] Error getting stats:", error);
    throw error;
  }
}

/**
 * Get top corrections
 */
async function getTopCorrections(limit = 10): Promise<any> {
  try {
    const { data, error } = await supabase.rpc("get_top_corrections", {
      limit_count: limit
    });

    if (error) throw error;

    return {
      success: true,
      corrections: data
    };
  } catch (error) {
    console.error("[Feedback] Error getting corrections:", error);
    throw error;
  }
}

/**
 * Apply learned corrections to a query
 * This is called BEFORE generating a response
 */
async function applyCorrections(query: string, minConfidence = 0.5): Promise<any> {
  try {
    const corrections = await findRelevantCorrections(query, minConfidence);

    if (corrections.length === 0) {
      return {
        success: true,
        has_corrections: false,
        corrections: [],
        guidance: ""
      };
    }

    console.log(`[Feedback] Found ${corrections.length} relevant corrections for query`);

    // Build guidance prompt
    const guidanceLines = corrections.map((c, i) => {
      return `${i + 1}. When answering about "${c.pattern}" (confidence: ${(c.confidence * 100).toFixed(0)}%):
   Previously, you might have said something like what's in your knowledge base.
   However, the CORRECT answer is: ${c.correct_answer}
   This correction has been applied ${c.times_applied} times successfully.`;
    });

    const guidance = `
IMPORTANT - LEARNED CORRECTIONS:
Based on previous user corrections, please note these specific improvements:

${guidanceLines.join("\n\n")}

Please incorporate these corrections into your response. These are proven accurate based on user feedback.
`;

    return {
      success: true,
      has_corrections: true,
      corrections: corrections.map(c => ({
        pattern: c.pattern,
        correct_answer: c.correct_answer,
        confidence: c.confidence
      })),
      guidance,
      should_apply: corrections.some(c => c.confidence >= 0.7), // High confidence corrections
      confidence_level: corrections.length > 0
        ? corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length
        : 0
    };
  } catch (error) {
    console.error("[Feedback] Error applying corrections:", error);
    return {
      success: false,
      has_corrections: false,
      corrections: [],
      guidance: "",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Identify low-confidence areas for active learning
 */
async function identifyLearningOpportunities(): Promise<any> {
  try {
    // Get corrections with low confidence
    const { data: lowConfidence } = await supabase
      .from("agent_corrections")
      .select("*")
      .lt("confidence", 0.6)
      .gt("times_applied", 2)
      .order("times_applied", { ascending: false })
      .limit(10);

    // Get recent negative feedback without corrections
    const { data: negativeNoCorrection } = await supabase
      .from("agent_feedback")
      .select("*")
      .eq("feedback_type", "negative")
      .is("learned_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get patterns with mixed feedback
    const { data: mixedFeedback } = await supabase
      .from("agent_corrections")
      .select("*")
      .gt("times_rejected", 0)
      .gt("times_confirmed", 0)
      .order("times_rejected", { ascending: false })
      .limit(5);

    return {
      success: true,
      opportunities: {
        low_confidence_patterns: lowConfidence || [],
        negative_feedback_without_correction: negativeNoCorrection || [],
        controversial_corrections: mixedFeedback || []
      },
      recommendations: [
        lowConfidence && lowConfidence.length > 0
          ? "Review low-confidence patterns - they may need more user feedback"
          : null,
        negativeNoCorrection && negativeNoCorrection.length > 0
          ? "Ask users for corrections on negative feedback to improve learning"
          : null,
        mixedFeedback && mixedFeedback.length > 0
          ? "Investigate controversial corrections - they may be context-dependent"
          : null
      ].filter(Boolean)
    };
  } catch (error) {
    console.error("[Feedback] Error identifying opportunities:", error);
    throw error;
  }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: FeedbackRequest = await req.json();
    const { action } = request;

    console.log(`[Feedback] Action: ${action}`);

    let result;

    switch (action) {
      case "submit_feedback":
        result = await submitFeedback(request);
        break;

      case "get_stats":
        const daysBack = (request as any).days_back || 7;
        result = await getFeedbackStats(daysBack);
        break;

      case "get_corrections":
        const limit = (request as any).limit || 10;
        result = await getTopCorrections(limit);
        break;

      case "apply_corrections":
        if (!request.query) {
          throw new Error("Missing required field: query");
        }
        const minConfidence = (request as any).min_confidence || 0.5;
        result = await applyCorrections(request.query, minConfidence);
        break;

      case "identify_opportunities":
        result = await identifyLearningOpportunities();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error("[Feedback] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});

// ============================================
// USAGE EXAMPLES
// ============================================

/*

1. SUBMIT POSITIVE FEEDBACK:
POST /ptd-feedback
{
  "action": "submit_feedback",
  "thread_id": "session-123",
  "query": "What is the health score formula?",
  "response": "The health score is calculated as...",
  "feedback_type": "positive",
  "rating": 5
}

2. SUBMIT CORRECTION:
POST /ptd-feedback
{
  "action": "submit_feedback",
  "thread_id": "session-123",
  "query": "What's the engagement score base?",
  "response": "The base is 60 points",
  "feedback_type": "correction",
  "correction": "The base is actually 50 points, not 60"
}

3. APPLY CORRECTIONS BEFORE GENERATING RESPONSE:
POST /ptd-feedback
{
  "action": "apply_corrections",
  "query": "What's the engagement score base?",
  "min_confidence": 0.5
}

Response:
{
  "success": true,
  "has_corrections": true,
  "guidance": "IMPORTANT - LEARNED CORRECTIONS: ...",
  "corrections": [...]
}

4. GET FEEDBACK STATS:
POST /ptd-feedback
{
  "action": "get_stats",
  "days_back": 7
}

5. GET TOP CORRECTIONS:
POST /ptd-feedback
{
  "action": "get_corrections",
  "limit": 10
}

6. IDENTIFY LEARNING OPPORTUNITIES:
POST /ptd-feedback
{
  "action": "identify_opportunities"
}

INTEGRATION WITH PTD-AGENT:

Before calling Claude in ptd-agent/index.ts:

// Check for learned corrections
const { data: correctionData } = await fetch(SUPABASE_URL + '/functions/v1/ptd-feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
  body: JSON.stringify({
    action: 'apply_corrections',
    query: userQuery,
    min_confidence: 0.5
  })
});

if (correctionData.has_corrections) {
  // Prepend corrections to system prompt
  systemPrompt = correctionData.guidance + "\n\n" + systemPrompt;
}

After receiving user feedback:

await fetch(SUPABASE_URL + '/functions/v1/ptd-feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
  body: JSON.stringify({
    action: 'submit_feedback',
    thread_id: sessionId,
    query: userQuery,
    response: agentResponse,
    feedback_type: 'positive', // or 'negative' or 'correction'
    correction: userCorrection, // if feedback_type is 'correction'
    rating: 5
  })
});

*/
