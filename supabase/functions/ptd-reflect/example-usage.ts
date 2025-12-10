/**
 * PTD Reflection Agent - Example Usage
 *
 * This file shows how to use the PTD Reflection Agent in different scenarios
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// EXAMPLE 1: Full Mode - Get Smart Response
// ============================================

async function example1_FullMode() {
  console.log("\n=== EXAMPLE 1: Full Mode ===\n");

  const { data, error } = await supabase.functions.invoke("ptd-reflect", {
    body: {
      mode: "full",
      query: "Analyze the client with email john@example.com and recommend an intervention strategy",
      context: {
        client_email: "john@example.com",
        session_id: "example_session_1"
      },
      max_iterations: 2,
      quality_threshold: 80
    }
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("📊 Quality Metrics:");
  console.log(`  Initial Score: ${data.metadata.initial_score}%`);
  console.log(`  Final Score: ${data.metadata.final_score}%`);
  console.log(`  Quality Gain: +${data.total_quality_gain}%`);
  console.log(`  Iterations: ${data.iterations}`);
  console.log(`  Response Time: ${data.metadata.total_time_ms}ms\n`);

  console.log("🎯 Final Response:");
  console.log(data.final_response.substring(0, 500) + "...\n");

  console.log("🔍 Fact Checks:");
  data.fact_checks.forEach((fc: any) => {
    console.log(`  ${fc.verified ? '✅' : '❌'} ${fc.claim} (${fc.confidence}% confidence)`);
  });

  console.log("\n📈 Improvement Trace:");
  data.improvement_trace.forEach((trace: string, i: number) => {
    console.log(`  [${i}] ${trace.substring(0, 100)}...`);
  });
}

// ============================================
// EXAMPLE 2: Critique-Only Mode
// ============================================

async function example2_CritiqueOnly() {
  console.log("\n=== EXAMPLE 2: Critique-Only Mode ===\n");

  const poorResponse = `The client is in the yellow zone. They need help.
  You should probably reach out to them soon. Their health score is not good.`;

  const { data, error } = await supabase.functions.invoke("ptd-reflect", {
    body: {
      mode: "critique_only",
      query: "What intervention strategy should we use for this at-risk client?",
      initial_response: poorResponse,
      context: {
        client_email: "sarah@example.com"
      },
      max_iterations: 2,
      quality_threshold: 85
    }
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("📉 Initial Response Quality:");
  const initialCritique = data.critiques[0];
  console.log(`  Completeness: ${initialCritique.completeness}%`);
  console.log(`  Accuracy: ${initialCritique.accuracy}%`);
  console.log(`  Actionability: ${initialCritique.actionability}%`);
  console.log(`  Confidence: ${initialCritique.confidence}%`);
  console.log(`  Overall: ${initialCritique.overall_score}%\n`);

  console.log("❌ Issues Found:");
  initialCritique.issues.forEach((issue: string) => {
    console.log(`  - ${issue}`);
  });

  console.log("\n💡 Suggestions:");
  initialCritique.suggestions.forEach((suggestion: string) => {
    console.log(`  - ${suggestion}`);
  });

  console.log("\n📈 Final Response Quality:");
  const finalCritique = data.critiques[data.critiques.length - 1];
  console.log(`  Overall: ${finalCritique.overall_score}%`);
  console.log(`  Quality Gain: +${data.total_quality_gain}%`);

  console.log("\n✨ Improved Response:");
  console.log(data.final_response.substring(0, 500) + "...");
}

// ============================================
// EXAMPLE 3: High-Threshold (Perfectionist Mode)
// ============================================

async function example3_HighThreshold() {
  console.log("\n=== EXAMPLE 3: High-Threshold Mode ===\n");

  const { data, error } = await supabase.functions.invoke("ptd-reflect", {
    body: {
      mode: "full",
      query: "Provide a complete analysis of our RED zone clients and create an action plan for the next 48 hours",
      context: {
        session_id: "executive_report"
      },
      max_iterations: 3,
      quality_threshold: 90 // Very high bar!
    }
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("🎯 Perfectionist Mode Results:");
  console.log(`  Target Threshold: 90%`);
  console.log(`  Achieved: ${data.metadata.final_score}%`);
  console.log(`  Iterations Used: ${data.iterations}/3`);
  console.log(`  Time Cost: ${data.metadata.total_time_ms}ms\n`);

  if (data.metadata.final_score >= 90) {
    console.log("✅ THRESHOLD MET - Executive-grade response\n");
  } else {
    console.log("⚠️ THRESHOLD NOT MET - Consider manual review\n");
  }

  console.log("📊 Score Progression:");
  data.critiques.forEach((critique: any, i: number) => {
    console.log(`  Iteration ${i}: ${critique.overall_score}%`);
  });
}

// ============================================
// EXAMPLE 4: Batch Analysis with Quality Tracking
// ============================================

async function example4_BatchAnalysis() {
  console.log("\n=== EXAMPLE 4: Batch Analysis ===\n");

  const queries = [
    "Which clients need urgent intervention today?",
    "Analyze coach performance and identify bottlenecks",
    "What's causing the decline in average health scores?",
    "Predict which GREEN zone clients will move to YELLOW next week"
  ];

  const results = [];

  for (const query of queries) {
    const { data, error } = await supabase.functions.invoke("ptd-reflect", {
      body: {
        mode: "full",
        query,
        context: { session_id: `batch_${Date.now()}` },
        max_iterations: 2,
        quality_threshold: 80
      }
    });

    if (!error) {
      results.push({
        query: query.substring(0, 50) + "...",
        qualityGain: data.total_quality_gain,
        finalScore: data.metadata.final_score,
        iterations: data.iterations,
        timeMs: data.metadata.total_time_ms
      });
    }

    // Rate limiting (avoid hammering API)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("📊 Batch Results Summary:");
  console.log("┌─────────────────────────────────────────────────────┬───────┬──────┬──────┬──────┐");
  console.log("│ Query                                               │ Gain  │ Score│ Iters│ Time │");
  console.log("├─────────────────────────────────────────────────────┼───────┼──────┼──────┼──────┤");

  results.forEach(r => {
    console.log(`│ ${r.query.padEnd(51)} │ +${String(r.qualityGain).padStart(3)}% │ ${String(r.finalScore).padStart(3)}% │   ${r.iterations}  │ ${String(Math.round(r.timeMs / 1000)).padStart(2)}s  │`);
  });

  console.log("└─────────────────────────────────────────────────────┴───────┴──────┴──────┴──────┘");

  const avgGain = results.reduce((sum, r) => sum + r.qualityGain, 0) / results.length;
  const avgScore = results.reduce((sum, r) => sum + r.finalScore, 0) / results.length;
  const avgTime = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;

  console.log(`\n📈 Averages: Quality Gain: +${Math.round(avgGain)}% | Final Score: ${Math.round(avgScore)}% | Time: ${Math.round(avgTime / 1000)}s`);
}

// ============================================
// EXAMPLE 5: Chain-of-Thought Extraction
// ============================================

async function example5_ChainOfThought() {
  console.log("\n=== EXAMPLE 5: Chain-of-Thought Reasoning ===\n");

  const { data, error } = await supabase.functions.invoke("ptd-reflect", {
    body: {
      mode: "full",
      query: "Explain why client john@example.com's health score is declining and show your reasoning process",
      context: {
        client_email: "john@example.com"
      },
      max_iterations: 2,
      quality_threshold: 80
    }
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("🧠 Chain-of-Thought Reasoning:\n");

  data.chain_of_thought.forEach((thought: string, i: number) => {
    console.log(`--- Iteration ${i + 1} Reasoning ---`);
    console.log(thought);
    console.log("\n");
  });

  console.log("📊 Final Quality: ", data.metadata.final_score + "%");
}

// ============================================
// EXAMPLE 6: Error Handling & Fallback
// ============================================

async function example6_ErrorHandling() {
  console.log("\n=== EXAMPLE 6: Error Handling ===\n");

  // Test with invalid query
  const { data, error } = await supabase.functions.invoke("ptd-reflect", {
    body: {
      mode: "full",
      query: "", // Empty query
      max_iterations: 2
    }
  });

  if (error) {
    console.log("❌ Expected Error Caught:");
    console.log(`  ${error.message}\n`);
  }

  // Test with missing context
  const { data: data2, error: error2 } = await supabase.functions.invoke("ptd-reflect", {
    body: {
      mode: "critique_only"
      // Missing initial_response
    }
  });

  if (error2) {
    console.log("❌ Expected Error Caught:");
    console.log(`  ${error2.message}\n`);
  }

  console.log("✅ Error handling working correctly");
}

// ============================================
// RUN EXAMPLES
// ============================================

async function runAllExamples() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║  PTD Reflection Agent - Example Usage         ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  try {
    // Uncomment the examples you want to run:

    // await example1_FullMode();
    // await example2_CritiqueOnly();
    // await example3_HighThreshold();
    // await example4_BatchAnalysis();
    // await example5_ChainOfThought();
    await example6_ErrorHandling();

    console.log("\n✅ Examples completed!\n");
  } catch (error) {
    console.error("\n❌ Example failed:", error);
  }
}

// Run if executed directly
if (import.meta.main) {
  runAllExamples();
}

// Export for use in other scripts
export {
  example1_FullMode,
  example2_CritiqueOnly,
  example3_HighThreshold,
  example4_BatchAnalysis,
  example5_ChainOfThought,
  example6_ErrorHandling
};
