#!/bin/bash
# Deploy all Supabase Edge Functions

PROJECT_REF="ztjndilxurtsfqdsvfds"

echo "🚀 Deploying all Supabase Edge Functions..."
echo "Project: $PROJECT_REF"
echo ""

# List of all functions
FUNCTIONS=(
  "agent-orchestrator"
  "ai-ceo-master"
  "ai-deploy-callback"
  "ai-trigger-deploy"
  "anomaly-detector"
  "anytrack-webhook"
  "auto-reassign-leads"
  "business-intelligence"
  "calendly-webhook"
  "callgear-icp-router"
  "callgear-live-monitor"
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
  "hubspot-anytrack-webhook"
  "hubspot-command-center"
  "integration-health"
  "intervention-recommender"
  "marketing-stress-test"
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
  "reassign-owner"
  "send-to-stape-capi"
  "smart-agent"
  "stripe-dashboard-data"
  "stripe-forensics"
  "stripe-payouts-ai"
  "stripe-webhook"
  "sync-hubspot-to-capi"
  "sync-hubspot-to-supabase"
  "ultimate-truth-alignment"
  "verify-all-keys"
)

SUCCESS=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
  echo -n "Deploying $func... "
  if supabase functions deploy "$func" --project-ref "$PROJECT_REF" > /tmp/deploy_${func}.log 2>&1; then
    echo "✅"
    ((SUCCESS++))
  else
    echo "❌ Failed (check /tmp/deploy_${func}.log)"
    ((FAILED++))
  fi
done

echo ""
echo "=========================================="
echo "Deployment Summary:"
echo "✅ Success: $SUCCESS"
echo "❌ Failed: $FAILED"
echo "Total: ${#FUNCTIONS[@]}"
echo "=========================================="
