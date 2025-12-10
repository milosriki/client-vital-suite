/**
 * PTD REASONING SYSTEM - TEST SUITE
 *
 * Run this to test the multi-step reasoning system
 * Usage: deno run --allow-net --allow-env test.ts
 */

import { EXAMPLE_QUERIES } from "./examples.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  Deno.exit(1);
}

const REASONING_ENDPOINT = `${SUPABASE_URL}/functions/v1/ptd-reasoning`;

interface TestResult {
  query: string;
  success: boolean;
  chain_type?: string;
  steps_completed?: number;
  total_time_ms?: number;
  final_answer?: string;
  error?: string;
}

async function testQuery(query: string, mode: 'full' | 'compact' = 'full'): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${query}`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    const response = await fetch(REASONING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, mode })
    });

    const data = await response.json();
    const executionTime = Date.now() - startTime;

    if (!data.success) {
      console.error(`❌ Failed: ${data.error}`);
      return {
        query,
        success: false,
        error: data.error,
        total_time_ms: executionTime
      };
    }

    if (mode === 'full') {
      console.log(`\n✅ Success! Chain Type: ${data.chain_type}`);
      console.log(`\nSteps Executed (${data.execution_summary.completed}/${data.execution_summary.total_steps}):`);

      data.steps.forEach((step: any) => {
        const status = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
        console.log(`\n  ${status} Step ${step.step_number}: ${step.question}`);
        console.log(`     Tool: ${step.tool_to_use}`);
        console.log(`     Args: ${JSON.stringify(step.tool_args)}`);
        console.log(`     Time: ${step.execution_time_ms}ms`);
        console.log(`     Conclusion: ${step.conclusion}`);

        if (step.status === 'failed') {
          console.log(`     ❌ Error: ${step.error}`);
        }
      });

      console.log(`\n${'─'.repeat(80)}`);
      console.log('FINAL ANSWER:');
      console.log('─'.repeat(80));
      console.log(data.final_answer);
      console.log('─'.repeat(80));

      console.log(`\n⏱️  Total Execution Time: ${executionTime}ms`);

      return {
        query,
        success: true,
        chain_type: data.chain_type,
        steps_completed: data.execution_summary.completed,
        total_time_ms: executionTime,
        final_answer: data.final_answer
      };
    } else {
      // Compact mode
      console.log(`\n✅ Success!`);
      console.log('─'.repeat(80));
      console.log(data.answer);
      console.log('─'.repeat(80));
      console.log(`\n⏱️  Total Time: ${executionTime}ms`);

      return {
        query,
        success: true,
        total_time_ms: executionTime,
        final_answer: data.answer
      };
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`);

    return {
      query,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      total_time_ms: executionTime
    };
  }
}

async function runAllTests() {
  console.log('\n🧪 PTD REASONING SYSTEM - TEST SUITE');
  console.log('='.repeat(80));

  const tests = [
    {
      name: "Revenue Analysis (Sequential)",
      query: "Why is revenue down this month compared to last month?",
      mode: 'full' as const
    },
    {
      name: "Coach Comparison (Parallel)",
      query: "Compare Coach A vs Coach B performance and explain the differences",
      mode: 'full' as const
    },
    {
      name: "Red Zone Analysis (Conditional)",
      query: "What's causing the increase in red zone clients?",
      mode: 'full' as const
    },
    {
      name: "Customer Journey (Sequential)",
      query: "Analyze the full journey of the most recent lead from first touch to current status",
      mode: 'full' as const
    },
    {
      name: "Business Health Check (Parallel)",
      query: "Give me a complete health check of the business - operations, revenue, client satisfaction, and team performance",
      mode: 'full' as const
    },
    {
      name: "Churn Prediction (Sequential)",
      query: "Which clients are most likely to churn in the next 30 days and why?",
      mode: 'full' as const
    },
    {
      name: "Simple Query (Compact Mode)",
      query: "How many clients do we have in each health zone?",
      mode: 'compact' as const
    }
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`TEST: ${test.name}`);
    console.log('='.repeat(80));

    const result = await testQuery(test.query, test.mode);
    results.push(result);

    // Wait a bit between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgTime = results.reduce((sum, r) => sum + (r.total_time_ms || 0), 0) / results.length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Average Time: ${avgTime.toFixed(0)}ms`);

  console.log('\n\nDetailed Results:');
  results.forEach((result, i) => {
    const status = result.success ? '✅' : '❌';
    const time = result.total_time_ms ? `${result.total_time_ms}ms` : 'N/A';
    const chainType = result.chain_type ? `[${result.chain_type}]` : '';
    const steps = result.steps_completed ? `(${result.steps_completed} steps)` : '';

    console.log(`\n${i + 1}. ${status} ${result.query}`);
    console.log(`   ${chainType} ${steps} - ${time}`);

    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));
}

// Run specific test
async function runSpecificTest(testName: string) {
  const testMap: Record<string, string> = {
    'revenue': "Why is revenue down this month compared to last month?",
    'coach': "Compare Coach A vs Coach B performance and explain the differences",
    'redzone': "What's causing the increase in red zone clients?",
    'journey': "Analyze the full journey of the most recent lead from first touch to current status",
    'health': "Give me a complete health check of the business",
    'churn': "Which clients are most likely to churn in the next 30 days and why?"
  };

  const query = testMap[testName.toLowerCase()];

  if (!query) {
    console.error(`❌ Unknown test: ${testName}`);
    console.log(`\nAvailable tests: ${Object.keys(testMap).join(', ')}`);
    return;
  }

  await testQuery(query, 'full');
}

// Main execution
const args = Deno.args;

if (args.length === 0) {
  console.log('\nRunning all tests...\n');
  await runAllTests();
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
PTD Reasoning System Test Suite

Usage:
  deno run --allow-net --allow-env test.ts              Run all tests
  deno run --allow-net --allow-env test.ts [test-name]  Run specific test
  deno run --allow-net --allow-env test.ts --help       Show this help

Available tests:
  revenue   - Revenue analysis (sequential chain)
  coach     - Coach comparison (parallel chain)
  redzone   - Red zone analysis (conditional chain)
  journey   - Customer journey analysis
  health    - Complete business health check
  churn     - Churn prediction analysis

Examples:
  deno run --allow-net --allow-env test.ts
  deno run --allow-net --allow-env test.ts revenue
  deno run --allow-net --allow-env test.ts coach
  `);
} else {
  await runSpecificTest(args[0]);
}
