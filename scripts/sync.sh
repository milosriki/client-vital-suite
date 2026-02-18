#!/bin/bash
# PTD FITNESS — Sync orchestrator
# Usage:
#   ./scripts/sync.sh          # Quick sync (active clients, 90d sessions)
#   ./scripts/sync.sh --full   # Full historical sync (all clients, coaches, 365d sessions)
#   ./scripts/sync.sh --report # Report only, no writes

cd "$(dirname "$0")/.."

if [[ "$*" == *"--full"* ]]; then
  echo "🔄 Running FULL historical sync..."
  node scripts/sync-aws-full.cjs
else
  echo "🔄 Running standard sync..."
  node scripts/sync-aws-to-supabase.cjs "$@"
fi
