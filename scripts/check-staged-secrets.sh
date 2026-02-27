#!/usr/bin/env bash
set -euo pipefail

if [[ "${ALLOW_SECRET_COMMIT:-0}" == "1" ]]; then
  echo "[secret-scan] ALLOW_SECRET_COMMIT=1 set, skipping secret scan."
  exit 0
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "[secret-scan] ripgrep (rg) not found. Install rg to enable secret scanning."
  exit 1
fi

DIFF_CONTENT="$(git diff --cached -U0 -- . ':(exclude)*.lock' ':(exclude)*.svg' ':(exclude)*.png' ':(exclude)*.jpg' ':(exclude)*.jpeg' || true)"
if [[ -z "$DIFF_CONTENT" ]]; then
  exit 0
fi

ADDED_LINES="$(echo "$DIFF_CONTENT" | rg '^\+' | rg -v '^\+\+\+' || true)"
if [[ -z "$ADDED_LINES" ]]; then
  exit 0
fi

PATTERN='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,}|[0-9]{8,}:[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,})'

if echo "$ADDED_LINES" | rg -n --pcre2 "$PATTERN" >/tmp/secret-scan-hits.txt; then
  echo "❌ [secret-scan] Potential secret detected in staged changes."
  cat /tmp/secret-scan-hits.txt
  echo "\nIf this is a false positive, inspect and re-stage safe content."
  echo "Emergency bypass (not recommended): ALLOW_SECRET_COMMIT=1 git commit ..."
  exit 1
fi

echo "✅ [secret-scan] No obvious secrets found in staged changes."
