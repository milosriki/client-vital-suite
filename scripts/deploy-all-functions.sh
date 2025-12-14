#!/bin/bash
# Deploy All Supabase Edge Functions
# This script deploys all functions to ensure they're connected and working

set -e

PROJECT_REF="ztjndilxurtsfqdsvfds"
FUNCTIONS_DIR="supabase/functions"

echo "🚀 Deploying All Edge Functions to Project: $PROJECT_REF"
echo "=================================================="
echo ""

# List of all functions to deploy
FUNCTIONS=(
  "agent-orchestrator"
  "ai-ceo-master"
  "ai-deploy-callback"
  "ai-trigger-deploy"
  "anomaly-detector"
  "anytrack-webhook"
  "business-intelligence"
  "callgear-icp-router"
  "callgear-live-monitor"
  "callgear-sentinel"
  "callgear-supervisor"
  "capi-validator"
  "churn-predictor"
  "coach-analyzer"
  "daily-report"
  "data-quality"
  "enrich-with-stripe"
  "fetch-callgear-data"
  "fetch-forensic-data"
  "fetch-hubspot-live"
  "generate-embeddings"
  "generate-lead-replies"
  "generate-lead-reply"
  "health-calculator"
  "hubspot-command-center"
  "integration-health"
  "intervention-recommender"
  "openai-embeddings"
  "pipeline-monitor"
  "proactive-insights-generator"
  "process-capi-batch"
  "process-knowledge"
  "ptd-24x7-monitor"
  "ptd-agent"
  "ptd-agent-claude"
  "ptd-agent-gemini"
  "ptd-execute-action"
  "ptd-proactive-scanner"
  "ptd-self-learn"
  "ptd-ultimate-intelligence"
  "ptd-watcher"
  "send-to-stape-capi"
  "smart-agent"
  "stripe-dashboard-data"
  "stripe-forensics"
  "stripe-payouts-ai"
  "stripe-webhook"
  "sync-hubspot-to-capi"
  "sync-hubspot-to-supabase"
  "agent-analyst"
)

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run: supabase login"
    exit 1
fi

# Deploy each function
SUCCESS=0
FAILED=0
SKIPPED=0

for func in "${FUNCTIONS[@]}"; do
    if [ ! -d "$FUNCTIONS_DIR/$func" ]; then
        echo "⚠️  SKIP: $func (directory not found)"
        ((SKIPPED++))
        continue
    fi
    
    echo -n "📦 Deploying $func... "
    
    if supabase functions deploy "$func" --no-verify-jwt 2>&1 | grep -q "Deployed\|already exists\|Success\|Function.*deployed"; then
        echo "✅"
        ((SUCCESS++))
    else
        echo "❌ FAILED"
        ((FAILED++))
        echo "   Try manually: supabase functions deploy $func --project-ref $PROJECT_REF"
    fi
done

echo ""
echo "=================================================="
echo "📊 Deployment Summary:"
echo "   ✅ Success: $SUCCESS"
echo "   ❌ Failed:  $FAILED"
echo "   ⚠️  Skipped: $SKIPPED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Some functions failed to deploy. Check errors above."
    exit 1
fi

echo "✅ All functions deployed successfully!"
echo ""
echo "🔍 Verify functions in dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/functions"
