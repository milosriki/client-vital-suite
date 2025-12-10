/**
 * PTD Orchestrator - Usage Examples
 *
 * This file contains example queries and expected behaviors for testing
 * the orchestrator's routing capabilities.
 */

// ============= EXAMPLE 1: SALES QUERY =============

export const salesExample = {
  request: {
    query: "Show me all new leads from the past week with their conversion status and deal values",
    maxAgents: 2
  },
  expectedIntent: "sales",
  expectedAgents: ["Sales Agent"],
  description: "Single-agent sales query routed to ptd-agent-gemini"
};

// ============= EXAMPLE 2: HEALTH & CHURN (MULTI-AGENT) =============

export const healthChurnExample = {
  request: {
    query: "Comprehensive analysis of client health scores and churn risk with intervention recommendations",
    maxAgents: 3
  },
  expectedIntent: "health",
  expectedAgents: ["Health Agent", "Churn Predictor Agent", "Intervention Agent"],
  description: "Multi-agent query combining health analysis, churn prediction, and interventions"
};

// ============= EXAMPLE 3: FRAUD DETECTION =============

export const fraudExample = {
  request: {
    query: "Scan for suspicious payment patterns and fraud in Stripe transactions",
    forceRefresh: true
  },
  expectedIntent: "fraud",
  expectedAgents: ["Fraud Agent"],
  description: "Fraud detection query routed to stripe-forensics"
};

// ============= EXAMPLE 4: BUSINESS ANALYTICS =============

export const analyticsExample = {
  request: {
    query: "Give me a business intelligence report with revenue metrics and KPIs",
    maxAgents: 2
  },
  expectedIntent: "analytics",
  expectedAgents: ["Business Intelligence Agent"],
  description: "Analytics query for BI dashboard"
};

// ============= EXAMPLE 5: COACH PERFORMANCE =============

export const coachExample = {
  request: {
    query: "Show me coach performance metrics and client satisfaction for all trainers",
    maxAgents: 2
  },
  expectedIntent: "coach_performance",
  expectedAgents: ["Coach Performance Agent"],
  description: "Coach analytics query"
};

// ============= EXAMPLE 6: AT-RISK CLIENTS =============

export const atRiskExample = {
  request: {
    query: "Which clients are in the red zone or yellow zone and at risk of churning?",
    maxAgents: 2
  },
  expectedIntent: "churn_risk",
  expectedAgents: ["Churn Predictor Agent", "Health Agent"],
  description: "At-risk client identification"
};

// ============= EXAMPLE 7: LEAD MANAGEMENT =============

export const leadManagementExample = {
  request: {
    query: "Get all high-quality leads that need follow-up with their lead scores",
    maxAgents: 1
  },
  expectedIntent: "lead_management",
  expectedAgents: ["Sales Agent"],
  description: "Lead management and follow-up tracking"
};

// ============= EXAMPLE 8: GENERAL SUPPORT =============

export const supportExample = {
  request: {
    query: "How do I check if a specific client has completed their assessment?",
    maxAgents: 1
  },
  expectedIntent: "support",
  expectedAgents: ["General Agent"],
  description: "General help and support query"
};

// ============= EXAMPLE 9: COMPREHENSIVE REPORT =============

export const comprehensiveExample = {
  request: {
    query: "Full business report: sales pipeline, client health, coach performance, and payment analytics",
    maxAgents: 3,
    forceRefresh: true
  },
  expectedIntent: "analytics",
  expectedAgents: ["Business Intelligence Agent", "Sales Agent", "Coach Performance Agent"],
  description: "Comprehensive multi-domain analysis"
};

// ============= EXAMPLE 10: CACHED QUERY =============

export const cachedExample = {
  request: {
    query: "Show me today's business metrics",
    forceRefresh: false // Will use cache if available
  },
  expectedIntent: "analytics",
  expectedAgents: ["Business Intelligence Agent"],
  description: "Cacheable daily metrics query"
};

// ============= TESTING UTILITIES =============

/**
 * Test a single example against the orchestrator
 */
export async function testExample(
  example: any,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  console.log(`\n=== Testing: ${example.description} ===`);
  console.log(`Query: "${example.request.query}"`);
  console.log(`Expected intent: ${example.expectedIntent}`);
  console.log(`Expected agents: ${example.expectedAgents.join(", ")}`);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ptd-orchestrator`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(example.request),
    });

    const result = await response.json();

    console.log(`\n✅ Response received:`);
    console.log(`   Intent: ${result.intent} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
    console.log(`   Agents invoked: ${result.agentsInvoked.join(", ")}`);
    console.log(`   Execution time: ${result.totalExecutionTime}ms`);
    console.log(`   Cached: ${result.metadata.cached ? "Yes" : "No"}`);
    console.log(`\n📝 Synthesized response:`);
    console.log(result.synthesizedResponse.slice(0, 300) + "...");

    // Validation
    const intentMatch = result.intent === example.expectedIntent;
    const agentsMatch = example.expectedAgents.some((expected: string) =>
      result.agentsInvoked.includes(expected)
    );

    if (!intentMatch) {
      console.warn(`⚠️ Intent mismatch! Expected: ${example.expectedIntent}, Got: ${result.intent}`);
    }
    if (!agentsMatch) {
      console.warn(`⚠️ Agent mismatch! Expected one of: ${example.expectedAgents.join(", ")}`);
    }

    if (intentMatch && agentsMatch) {
      console.log(`\n✅ Test PASSED`);
    } else {
      console.log(`\n❌ Test FAILED`);
    }

  } catch (error) {
    console.error(`\n❌ Test ERROR:`, error);
  }
}

/**
 * Run all examples
 */
export async function testAll(supabaseUrl: string, supabaseAnonKey: string): Promise<void> {
  const examples = [
    salesExample,
    healthChurnExample,
    fraudExample,
    analyticsExample,
    coachExample,
    atRiskExample,
    leadManagementExample,
    supportExample,
    comprehensiveExample,
    cachedExample,
  ];

  console.log(`\n🚀 Running ${examples.length} orchestrator tests...\n`);

  for (const example of examples) {
    await testExample(example, supabaseUrl, supabaseAnonKey);
    // Wait 1 second between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ All tests completed!`);
}

// ============= CURL EXAMPLES =============

export const curlExamples = `
# Example 1: Sales Query
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Show me all new leads from the past week"}'

# Example 2: Health & Churn (Multi-Agent)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Comprehensive analysis of client health and churn risk",
    "maxAgents": 3
  }'

# Example 3: Fraud Detection
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Scan for suspicious payment patterns in Stripe",
    "forceRefresh": true
  }'

# Example 4: Coach Performance
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Show coach performance metrics"}'

# Example 5: Cached Query (will be faster on second call)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Show me today business metrics"}'

# Example 6: Force Refresh (bypass cache)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/ptd-orchestrator \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Show me today business metrics",
    "forceRefresh": true
  }'
`;

// ============= JAVASCRIPT/TYPESCRIPT EXAMPLES =============

export const jsExamples = `
// Example 1: Basic query with Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase.functions.invoke('ptd-orchestrator', {
  body: {
    query: "Show me all new leads from the past week"
  }
});

console.log(data.synthesizedResponse);

// Example 2: Multi-agent query with options
const { data: multiAgentData } = await supabase.functions.invoke('ptd-orchestrator', {
  body: {
    query: "Comprehensive health and churn analysis",
    maxAgents: 3,
    forceRefresh: true,
    threadId: "session_12345"
  }
});

console.log(\`Intent: \${multiAgentData.intent}\`);
console.log(\`Confidence: \${multiAgentData.confidence * 100}%\`);
console.log(\`Agents: \${multiAgentData.agentsInvoked.join(', ')}\`);
console.log(\`Time: \${multiAgentData.totalExecutionTime}ms\`);

// Example 3: React component integration
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

function OrchestratorQuery() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const supabase = useSupabaseClient();

  const handleSubmit = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('ptd-orchestrator', {
      body: { query }
    });
    setResponse(data);
    setLoading(false);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask anything..."
      />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Processing...' : 'Ask Orchestrator'}
      </button>
      {response && (
        <div>
          <p><strong>Intent:</strong> {response.intent}</p>
          <p><strong>Confidence:</strong> {(response.confidence * 100).toFixed(1)}%</p>
          <p><strong>Agents:</strong> {response.agentsInvoked.join(', ')}</p>
          <div>{response.synthesizedResponse}</div>
        </div>
      )}
    </div>
  );
}
`;

// ============= PYTHON EXAMPLES =============

export const pythonExamples = `
# Example 1: Basic Python integration
import requests
import json

SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
ANON_KEY = "YOUR_ANON_KEY"

def query_orchestrator(query: str, max_agents: int = 3, force_refresh: bool = False):
    url = f"{SUPABASE_URL}/functions/v1/ptd-orchestrator"
    headers = {
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "query": query,
        "maxAgents": max_agents,
        "forceRefresh": force_refresh
    }

    response = requests.post(url, headers=headers, json=payload)
    return response.json()

# Example usage
result = query_orchestrator("Show me all at-risk clients")
print(f"Intent: {result['intent']}")
print(f"Response: {result['synthesizedResponse']}")

# Example 2: Batch queries
queries = [
    "Show sales pipeline",
    "Scan for fraud",
    "Coach performance metrics",
    "Health score distribution"
]

for query in queries:
    result = query_orchestrator(query)
    print(f"\\nQuery: {query}")
    print(f"Intent: {result['intent']} ({result['confidence'] * 100:.1f}%)")
    print(f"Agents: {', '.join(result['agentsInvoked'])}")
`;

// ============= EXPORT ALL EXAMPLES =============

export const allExamples = {
  sales: salesExample,
  healthChurn: healthChurnExample,
  fraud: fraudExample,
  analytics: analyticsExample,
  coach: coachExample,
  atRisk: atRiskExample,
  leadManagement: leadManagementExample,
  support: supportExample,
  comprehensive: comprehensiveExample,
  cached: cachedExample,
};

export default allExamples;
