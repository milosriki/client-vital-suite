#!/bin/bash
# =============================================================================
# Security Audit Script
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

PASSED=0
WARNINGS=0
FAILED=0

pass() { echo -e "  ${GREEN}✅ PASS${NC}: $1"; ((PASSED++)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${NC}: $1"; ((WARNINGS++)); }
fail() { echo -e "  ${RED}❌ FAIL${NC}: $1"; ((FAILED++)); }
info() { echo -e "  ${BLUE}ℹ️  INFO${NC}: $1"; }

echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}  Security Audit - PTD Fitness Platform${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# 1. Configuration Files
# =============================================================================
echo -e "${YELLOW}▶ Configuration Files${NC}"
echo "────────────────────────────────────────────────────"

# vercel.json
if [[ -f "vercel.json" ]]; then
  if grep -qE '"(VITE_|SUPABASE_|API_KEY|SECRET)[^"]*"\s*:\s*"[^"]{10,}"' vercel.json 2>/dev/null; then
    fail "Hardcoded credentials in vercel.json"
  else
    pass "vercel.json clean of hardcoded credentials"
  fi
else
  warn "vercel.json not found"
fi

# .env files
for env_file in .env .env.local .env.production; do
  if [[ -f "$env_file" ]]; then
    if git ls-files --error-unmatch "$env_file" &>/dev/null; then
      fail "$env_file is tracked by git (should be gitignored)"
    else
      pass "$env_file exists but not tracked"
    fi
  fi
done

# .gitignore
if [[ -f ".gitignore" ]]; then
  if grep -q "^\.env" .gitignore; then
    pass ".env patterns in .gitignore"
  else
    fail ".env not in .gitignore"
  fi
else
  fail ".gitignore not found"
fi

echo ""

# =============================================================================
# 2. Source Code Secrets
# =============================================================================
echo -e "${YELLOW}▶ Source Code Secrets Scan${NC}"
echo "────────────────────────────────────────────────────"

# Patterns to search for
PATTERNS=(
  "sk_live_|sk_test_"        # Stripe
  "pat-na1-"                  # HubSpot
  "AIza[A-Za-z0-9_-]{35}"    # Google
  "sk-ant-api"               # Anthropic
  "xoxb-|xoxp-"              # Slack
  "ghp_[A-Za-z0-9]{36}"      # GitHub
  "AKIA[A-Z0-9]{16}"         # AWS
)

FOUND_SECRETS=0
for pattern in "${PATTERNS[@]}"; do
  if grep -rn "$pattern" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "placeholder\|example\|test" | head -1 | grep -q .; then
    fail "Found pattern matching: $pattern"
    ((FOUND_SECRETS++))
  fi
done

if [[ $FOUND_SECRETS -eq 0 ]]; then
  pass "No hardcoded API keys found in source"
fi

# Check for private keys
if grep -rn "PRIVATE KEY" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -1 | grep -q .; then
  fail "Private key found in source code"
else
  pass "No private keys in source"
fi

echo ""

# =============================================================================
# 3. Supabase Client Configuration
# =============================================================================
echo -e "${YELLOW}▶ Supabase Client Configuration${NC}"
echo "────────────────────────────────────────────────────"

CLIENT_FILE="src/integrations/supabase/client.ts"
if [[ -f "$CLIENT_FILE" ]]; then
  # Check for env var usage
  if grep -q "import.meta.env" "$CLIENT_FILE"; then
    pass "Uses environment variables for config"
  else
    warn "May not be using environment variables"
  fi
  
  # Check for hardcoded service role key (BAD)
  if grep -q "service_role" "$CLIENT_FILE"; then
    fail "Service role key referenced in client code"
  else
    pass "No service role key in client"
  fi
  
  # Check anon key usage (OK if fallback)
  if grep -q "eyJhbGci" "$CLIENT_FILE"; then
    info "Contains anon key as fallback (acceptable for public client)"
  fi
else
  warn "Supabase client file not found"
fi

echo ""

# =============================================================================
# 4. Git History
# =============================================================================
echo -e "${YELLOW}▶ Git History Scan${NC}"
echo "────────────────────────────────────────────────────"

# Check for secrets in git history (limited scan)
SECRET_COMMITS=0
for pattern in "sk_live_" "sk_test_" "service_role"; do
  if git log -p --all -S "$pattern" --oneline 2>/dev/null | head -1 | grep -q .; then
    warn "Pattern '$pattern' found in git history"
    ((SECRET_COMMITS++))
  fi
done

if [[ $SECRET_COMMITS -eq 0 ]]; then
  pass "No obvious secrets in git history"
else
  warn "Consider using git-filter-repo to clean history"
fi

echo ""

# =============================================================================
# 5. Security Headers
# =============================================================================
echo -e "${YELLOW}▶ Security Headers (vercel.json)${NC}"
echo "────────────────────────────────────────────────────"

if [[ -f "vercel.json" ]]; then
  HEADERS=(
    "X-Content-Type-Options"
    "X-Frame-Options"
    "X-XSS-Protection"
    "Referrer-Policy"
  )
  
  for header in "${HEADERS[@]}"; do
    if grep -q "$header" vercel.json; then
      pass "Security header: $header"
    else
      warn "Missing header: $header"
    fi
  done
  
  # Check for HSTS (optional for Vercel as it's handled automatically)
  if grep -q "Strict-Transport-Security" vercel.json; then
    pass "HSTS header configured"
  else
    info "HSTS not in vercel.json (Vercel handles this)"
  fi
else
  warn "Cannot check security headers without vercel.json"
fi

echo ""

# =============================================================================
# 6. Dependencies
# =============================================================================
echo -e "${YELLOW}▶ Dependency Security${NC}"
echo "────────────────────────────────────────────────────"

if [[ -f "package.json" ]]; then
  # Check for npm audit
  if command -v npm &>/dev/null; then
    AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{"vulnerabilities":{}}')
    if command -v jq &>/dev/null; then
      VULN_COUNT=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "0")
      CRITICAL=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "0")
      HIGH=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "0")
      
      if [[ "$CRITICAL" -gt 0 ]]; then
        fail "Critical vulnerabilities: $CRITICAL"
      elif [[ "$HIGH" -gt 0 ]]; then
        warn "High vulnerabilities: $HIGH"
      else
        pass "No critical/high vulnerabilities"
      fi
      info "Total vulnerabilities: $VULN_COUNT"
    else
      info "Install jq for detailed vulnerability count"
    fi
  else
    warn "npm not available for audit"
  fi
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}  Security Audit Summary${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed:${NC}   $PASSED"
echo -e "  ${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
echo -e "  ${RED}❌ Failed:${NC}   $FAILED"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "  ${RED}⚠️  Critical security issues found. Please fix before deploying.${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "  ${YELLOW}Security audit passed with warnings. Review recommended.${NC}"
else
  echo -e "  ${GREEN}🔒 Security audit passed!${NC}"
fi
echo ""
