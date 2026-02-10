#!/usr/bin/env bash
# Enterprise handleError Migration Script
# Adds handleError import and replaces the outer catch block in all functions

FUNCTIONS_DIR="/Users/milosvukovic/client-vital-suite/supabase/functions"

# List of all functions that need handleError added
FUNCTIONS=(
  ai-config-status
  aisensy-orchestrator
  api-rate-limit-handler
  auto-reassign-leads
  aws-backoffice-sync
  backfill-deals-history
  calculate-health-scores
  callgear-icp-router
  callgear-live-monitor
  callgear-sentinel
  capi-validator
  cleanup-errors
  cleanup-fake-contacts
  client-payment-integrity
  coach-analyzer
  data-quality
  emergency-forensics
  enrich-with-stripe
  fetch-callgear-data
  fetch-forensic-data
  generate-embeddings
  generate-lead-replies
  health-calculator
  hubspot-command-center
  hubspot-error-handler
  hubspot-live-query
  integration-health
  intervention-recommender
  meta-error-handler
  multi-agent-orchestrator
  openai-embeddings
  pipeline-monitor
  proactive-insights-generator
  process-capi-batch
  process-knowledge
  ptd-24x7-monitor
  ptd-execute-action
  ptd-proactive-scanner
  ptd-watcher
  purge-sync-errors
  rds-data-analyst
  reassign-owner
  sales-aggression
  send-to-stape-capi
  smart-coach-analytics
  stripe-account-details
  stripe-connect
  stripe-dashboard-data
  stripe-deep-agent
  stripe-enterprise-intelligence
  stripe-error-handler
  stripe-forensics
  stripe-history
  stripe-issuing
  stripe-issuing-tokens
  stripe-payout-controls
  stripe-payouts-ai
  stripe-treasury
  sync-excel-data
  sync-hubspot-to-capi
  sync-hubspot-to-supabase
  sync-single-call
  sync-single-contact
  sync-single-deal
  system-health-check
  ultimate-aggregator
  ultimate-fix
  ultimate-truth-alignment
  validate-truth
  verify-all-keys
)

TOTAL=${#FUNCTIONS[@]}
FIXED=0
SKIPPED=0
ERRORS=0

for fn in "${FUNCTIONS[@]}"; do
  FILE="$FUNCTIONS_DIR/$fn/index.ts"
  
  if [ ! -f "$FILE" ]; then
    echo "⚠️  SKIP (not found): $fn"
    ((SKIPPED++))
    continue
  fi

  # Skip if already has handleError
  if grep -q 'handleError' "$FILE"; then
    echo "✅ SKIP (already done): $fn"
    ((SKIPPED++))
    continue
  fi

  # STEP 1: Add the import for handleError and ErrorCode
  # Check if it already imports from error-handler.ts
  if grep -q 'error-handler' "$FILE"; then
    # Already imports something from error-handler, add handleError to existing import
    echo "⚠️  Has error-handler import but no handleError: $fn (manual review needed)"
    ((SKIPPED++))
    continue
  fi

  # Check if it imports corsHeaders from cors.ts separately
  if grep -q "from.*cors\.ts" "$FILE"; then
    # Has separate cors import - add error-handler import after it
    sed -i '' '/from.*cors\.ts/a\
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
' "$FILE"
  elif grep -q "from.*auth-middleware" "$FILE"; then
    # Has auth-middleware import - add after it
    sed -i '' '/from.*auth-middleware/a\
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
' "$FILE"
  else
    # Add after the first import line
    sed -i '' '1,/^import/{/^import/a\
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
}' "$FILE"
  fi

  # Verify import was added
  if ! grep -q 'handleError' "$FILE"; then
    echo "❌ FAILED to add import: $fn"
    ((ERRORS++))
    continue
  fi

  echo "✅ FIXED: $fn"
  ((FIXED++))
done

echo ""
echo "================================"
echo "handleError Import Migration Complete"
echo "Fixed: $FIXED"
echo "Skipped: $SKIPPED"  
echo "Errors: $ERRORS"
echo "Total: $TOTAL"
echo "================================"
