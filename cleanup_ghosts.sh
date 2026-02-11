#!/bin/bash

# TRUE ZOMBIES (20)
ZOMBIES=(
  "error-auto-resolver"
  "error-cleanup-agent"
  "error-correlation-agent"
  "error-health-monitor"
  "error-notification-agent"
  "error-pattern-analyzer"
  "error-prediction-agent"
  "error-prevention-agent"
  "error-recovery-agent"
  "error-retry-orchestrator"
  "error-rollback-agent"
  "error-root-cause-analyzer"
  "error-severity-classifier"
  "error-trend-analyzer"
  "error-triage-agent"
  "agent-analyst"
  "agent-manager"
  "check-workflow"
  "deep-research"
  "ptd-self-learn"
)

echo "Starting cleanup of 20 Ghost Functions..."

for FUNC in "${ZOMBIES[@]}"; do
    echo "Deleting ghost: $FUNC"
    # Using --yes to skip confirmation
    /opt/homebrew/bin/supabase functions delete "$FUNC" --project-ref ztjndilxurtsfqdsvfds --yes
done

echo "Ghost cleanup complete."
