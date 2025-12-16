#!/usr/bin/env bash
set -euo pipefail

# Simple connectivity/status check for Vercel CLI and Supabase CLI.
# Usage: ./check-cli-connections.sh

status_ok="[OK ]"
status_warn="[WARN]"
status_err="[ERR]"
issues=()

add_issue() {
  issues+=("$1")
}

print_header() {
  echo "\n==== $1 ===="
}

check_binary() {
  local bin="$1"
  local install_url="$2"
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "$status_err $bin not found. Install: $install_url"
    add_issue "$bin missing (install: $install_url)"
    return 1
  fi

  echo "$status_ok $bin installed ($("$bin" --version 2>/dev/null || true))"
  return 0
}

check_vercel() {
  print_header "Vercel CLI"
  if ! check_binary "vercel" "https://vercel.com/cli"; then
    return
  fi

  if vercel whoami >/dev/null 2>&1; then
    local user
    user=$(vercel whoami 2>/dev/null)
    echo "$status_ok Authenticated as: $user"
  else
    echo "$status_warn Not authenticated. Run: vercel login"
    add_issue "Vercel CLI not authenticated (run: vercel login)"
    return
  fi

  # Check project link from repo root.
  if vercel link --confirm >/dev/null 2>&1; then
    echo "$status_ok Project is linked (vercel link --confirm)"
  else
    echo "$status_warn Project not linked. Run: vercel link"
    add_issue "Vercel project not linked (run: vercel link)"
  fi
}

check_supabase() {
  print_header "Supabase CLI"
  if ! check_binary "supabase" "https://supabase.com/docs/guides/cli"; then
    return
  fi

  local projects_output=""
  if projects_output=$(supabase projects list 2>/dev/null); then
    echo "$status_ok Authenticated (supabase projects list)"
  else
    echo "$status_warn Not authenticated. Run: supabase login"
    add_issue "Supabase CLI not authenticated (run: supabase login)"
    return
  fi

  # Show project_id from config if present.
  local config="supabase/config.toml"
  if [[ -f "$config" ]]; then
    local project_id
    project_id=$(grep -m1 '^project_id' "$config" | awk -F'=' '{print $2}' | tr -d ' "')
    if [[ -n "$project_id" ]]; then
      echo "$status_ok Project ref from $config: $project_id"
      if echo "$projects_output" | grep -q "$project_id"; then
        echo "$status_ok Project ref is present in supabase projects list"
      else
        echo "$status_warn Project ref not found in supabase projects list; ensure you are logged into the right account or re-link via: supabase link"
        add_issue "Supabase project ref missing from account (check login or run: supabase link)"
      fi
    else
      echo "$status_warn No project_id set in $config"
      add_issue "Supabase project_id missing in $config (run: supabase link)"
    fi
  else
    echo "$status_warn supabase/config.toml not found; run supabase link"
    add_issue "supabase/config.toml missing (run: supabase link)"
  fi

  # Optional: list edge functions to confirm visibility.
  if supabase functions list >/dev/null 2>&1; then
    supabase functions list
  else
    echo "$status_warn Could not list functions (may require project link)"
    add_issue "Supabase functions list failed (check project link)"
  fi
}

check_vercel
echo
check_supabase

print_header "Summary"
if [[ ${#issues[@]} -eq 0 ]]; then
  echo "$status_ok All checks passed"
  exit 0
fi

for issue in "${issues[@]}"; do
  echo "$status_err $issue"
done

exit 1

