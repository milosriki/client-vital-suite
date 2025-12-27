#!/bin/bash
# Bulk instrument edge functions with observability

FUNCTIONS_DIR="/Users/milosvukovic/client-vital-suite-check/supabase/functions"

# Functions to instrument (critical path first)
CRITICAL_FUNCTIONS=(
  "agent-orchestrator"
  "ptd-agent-claude"
  "ptd-agent-gemini"
  "ai-ceo-master"
  "hubspot-sync-manager"
  "hubspot-webhook"
  "calculate-health-scores"
  "churn-predictor"
  "intervention-recommender"
  "stripe-webhook"
)

instrument_function() {
  local func_name="$1"
  local file_path="$FUNCTIONS_DIR/$func_name/index.ts"
  
  if [[ ! -f "$file_path" ]]; then
    echo "❌ $func_name: File not found"
    return 1
  fi
  
  # Check if already instrumented
  if grep -q "withTracing\|observability" "$file_path"; then
    echo "✅ $func_name: Already instrumented"
    return 0
  fi
  
  echo "🔧 Instrumenting: $func_name"
  
  # Create backup
  cp "$file_path" "$file_path.bak"
  
  # Add import after first line (usually /// <reference)
  sed -i '' '1a\
import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
' "$file_path"
  
  echo "   ✅ Added import"
}

echo "=========================================="
echo "BULK INSTRUMENTATION SCRIPT"
echo "=========================================="

for func in "${CRITICAL_FUNCTIONS[@]}"; do
  instrument_function "$func"
done

echo ""
echo "=========================================="
echo "INSTRUMENTATION COMPLETE"
echo "=========================================="
