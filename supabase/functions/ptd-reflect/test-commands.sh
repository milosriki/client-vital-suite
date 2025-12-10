#!/bin/bash

# PTD Reflection Agent - Test Commands
# Replace SUPABASE_URL and SUPABASE_ANON_KEY with your actual values

SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

echo "╔════════════════════════════════════════════════╗"
echo "║  PTD Reflection Agent - Test Suite            ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# ============================================
# TEST 1: Full Mode - Simple Query
# ============================================
echo "TEST 1: Full Mode - Simple Query"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "full",
    "query": "How many clients are in RED zone today?",
    "context": {
      "session_id": "test_1"
    },
    "max_iterations": 2,
    "quality_threshold": 80
  }' | jq '.metadata'

echo ""
echo ""

# ============================================
# TEST 2: Critique-Only Mode
# ============================================
echo "TEST 2: Critique-Only Mode"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "critique_only",
    "query": "What should we do about at-risk clients?",
    "initial_response": "You should call them. They need help. Contact them soon.",
    "max_iterations": 2,
    "quality_threshold": 80
  }' | jq '{
    initial_score: .metadata.initial_score,
    final_score: .metadata.final_score,
    quality_gain: .total_quality_gain,
    iterations: .iterations
  }'

echo ""
echo ""

# ============================================
# TEST 3: Client Analysis
# ============================================
echo "TEST 3: Client-Specific Analysis"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "full",
    "query": "Analyze john.doe@example.com and recommend intervention",
    "context": {
      "client_email": "john.doe@example.com",
      "session_id": "test_3"
    },
    "max_iterations": 2,
    "quality_threshold": 85
  }' | jq '{
    quality: .metadata,
    fact_checks: .fact_checks,
    critique_summary: .critiques[-1] | {
      completeness,
      accuracy,
      actionability,
      confidence,
      overall_score
    }
  }'

echo ""
echo ""

# ============================================
# TEST 4: High-Threshold (Perfectionist)
# ============================================
echo "TEST 4: High-Threshold Mode (90%)"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "full",
    "query": "Create a comprehensive action plan for all RED zone clients with timeline and draft messages",
    "context": {
      "session_id": "executive_report"
    },
    "max_iterations": 3,
    "quality_threshold": 90
  }' | jq '{
    target: 90,
    achieved: .metadata.final_score,
    threshold_met: (.metadata.final_score >= 90),
    iterations_used: .iterations,
    time_ms: .metadata.total_time_ms
  }'

echo ""
echo ""

# ============================================
# TEST 5: Error Handling
# ============================================
echo "TEST 5: Error Handling (Empty Query)"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "full",
    "query": "",
    "max_iterations": 2
  }' | jq '{
    success,
    error
  }'

echo ""
echo ""

# ============================================
# TEST 6: Fast Mode (Single Iteration)
# ============================================
echo "TEST 6: Fast Mode (Max 1 Iteration)"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "full",
    "query": "Quick summary of health zone distribution",
    "max_iterations": 1,
    "quality_threshold": 75
  }' | jq '{
    iterations: .iterations,
    score: .metadata.final_score,
    time_ms: .metadata.total_time_ms,
    fast_mode: (.metadata.total_time_ms < 10000)
  }'

echo ""
echo ""

# ============================================
# TEST 7: Chain-of-Thought Verification
# ============================================
echo "TEST 7: Chain-of-Thought Verification"
echo "───────────────────────────────────────────────"

curl -X POST "${SUPABASE_URL}/functions/v1/ptd-reflect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "mode": "full",
    "query": "Explain the health score calculation for a typical YELLOW zone client",
    "max_iterations": 2,
    "quality_threshold": 80
  }' | jq '{
    has_chain_of_thought: (.chain_of_thought | length > 0),
    reasoning_steps: .chain_of_thought | length,
    first_thought_preview: .chain_of_thought[0][:100]
  }'

echo ""
echo "✅ Test suite completed!"
echo ""
