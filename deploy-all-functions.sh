#!/bin/bash
# Deploy all Supabase Edge Functions

set -euo pipefail

CONFIG_FILE="supabase/config.toml"
PROJECT_REF="${PROJECT_REF:-}"  # Allow override via env

resolve_project_ref() {
  if [[ -n "$PROJECT_REF" ]]; then
    return
  fi

  if [[ -f "$CONFIG_FILE" ]]; then
    local config_ref
    config_ref=$(grep -m1 '^project_id' "$CONFIG_FILE" | awk -F'=' '{print $2}' | tr -d ' "')
    if [[ -n "$config_ref" ]]; then
      PROJECT_REF="$config_ref"
    fi
  fi
}

require_supabase_cli() {
  if ! command -v supabase >/dev/null 2>&1; then
    echo "❌ Supabase CLI not found. Please install it first: https://supabase.com/docs/guides/cli"
    exit 1
  fi
}

ensure_authenticated_and_linked() {
  local projects_output
  if ! projects_output=$(supabase projects list 2>/dev/null); then
    echo "❌ Supabase CLI is not authenticated. Run: supabase login"
    exit 1
  fi

  if ! echo "$projects_output" | grep -q "$PROJECT_REF"; then
    echo "❌ Project ref '$PROJECT_REF' not visible to this account. Run: supabase link or log into the correct account."
    exit 1
  fi
}

resolve_project_ref

echo "🚀 Deploying all Supabase Edge Functions..."
if [[ -z "$PROJECT_REF" ]]; then
  echo "❌ No project ref found. Set PROJECT_REF or run: supabase link"
  exit 1
fi
echo "Project: $PROJECT_REF"
echo ""

require_supabase_cli
ensure_authenticated_and_linked

# Dynamically discover all functions (exclude shared helpers)
FUNCTIONS=()
for dir in supabase/functions/*; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  if [ "$name" = "_shared" ]; then
    continue
  fi
  FUNCTIONS+=("$name")
done

# Sort for stable output
IFS=$'\n' FUNCTIONS=($(printf '%s\n' "${FUNCTIONS[@]}" | sort))
unset IFS

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
  echo "No functions found to deploy in supabase/functions."
  exit 0
fi

echo "Found ${#FUNCTIONS[@]} functions to deploy:"
printf ' - %s\n' "${FUNCTIONS[@]}"
echo ""

echo "Status legend: ✅ success (green), ❌ failure (red)."
echo "Any ❌ / red line means that function did not deploy; see the log guidance in the summary."
echo ""

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
if [ $FAILED -gt 0 ]; then
  echo "Failed deployments have logs at /tmp/deploy_<function>.log"
  echo "For example: tail -n 40 /tmp/deploy_some-function.log"
fi
echo "=========================================="
