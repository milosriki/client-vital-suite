#!/bin/bash
# =============================================================================
# PTD Fitness Intelligence Platform - Deployment Verification Script
# =============================================================================
# Usage:
#   ./verify-deployment.sh              # Full verification
#   ./verify-deployment.sh --security   # Security checks only
#   ./verify-deployment.sh --find-similar # Find similar Vercel projects
#   ./verify-deployment.sh --report     # Generate markdown report
# =============================================================================

# Don't exit on error - we handle errors gracefully
set +e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
PASSED=0
WARNINGS=0
FAILED=0

# Project Configuration
PROJECT_NAME="client-vital-suite"
SUPABASE_PROJECT_REF="ztjndilxurtsfqdsvfds"
PRODUCTION_URL="https://client-vital-suite.vercel.app"
SUPABASE_URL="https://ztjndilxurtsfqdsvfds.supabase.co"

# Required Environment Variables
REQUIRED_VERCEL_ENV=(
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_PUBLISHABLE_KEY"
)

REQUIRED_SUPABASE_SECRETS=(
  "HUBSPOT_API_KEY"
  "HUBSPOT_ACCESS_TOKEN"
  "GEMINI_API_KEY"
  "ANTHROPIC_API_KEY"
  "STRIPE_SECRET_KEY"
  "FB_ACCESS_TOKEN"
)

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
  echo ""
  echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${PURPLE}  $1${NC}"
  echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_section() {
  echo ""
  echo -e "${CYAN}▶ $1${NC}"
  echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"
}

pass() {
  echo -e "  ${GREEN}✅ PASS${NC}: $1"
  ((PASSED++))
}

warn() {
  echo -e "  ${YELLOW}⚠️  WARN${NC}: $1"
  ((WARNINGS++))
}

fail() {
  echo -e "  ${RED}❌ FAIL${NC}: $1"
  ((FAILED++))
}

info() {
  echo -e "  ${BLUE}ℹ️  INFO${NC}: $1"
}

# =============================================================================
# Check Prerequisites
# =============================================================================

check_prerequisites() {
  print_section "Prerequisites"
  
  # Check Vercel CLI
  if command -v vercel &> /dev/null; then
    VERCEL_VERSION=$(vercel --version 2>/dev/null | head -1)
    pass "Vercel CLI installed ($VERCEL_VERSION)"
  else
    fail "Vercel CLI not installed"
    return 1
  fi
  
  # Check Vercel Authentication
  VERCEL_USER=$(vercel whoami 2>/dev/null | tail -1)
  if [[ -n "$VERCEL_USER" && "$VERCEL_USER" != *"Error"* ]]; then
    pass "Vercel authenticated as: $VERCEL_USER"
  else
    fail "Vercel CLI not authenticated (run: vercel login)"
    return 1
  fi
  
  # Check Supabase CLI
  if command -v npx &> /dev/null && npx supabase --version &> /dev/null; then
    SUPABASE_VERSION=$(npx supabase --version 2>/dev/null)
    pass "Supabase CLI available ($SUPABASE_VERSION)"
  else
    warn "Supabase CLI not available"
  fi
  
  # Check curl
  if command -v curl &> /dev/null; then
    pass "curl available"
  else
    fail "curl not installed"
  fi
  
  # Check jq
  if command -v jq &> /dev/null; then
    pass "jq available"
  else
    warn "jq not installed (some checks will be limited)"
  fi
}

# =============================================================================
# Find Similar Vercel Projects
# =============================================================================

find_similar_projects() {
  print_section "Finding Similar Vercel Projects"
  
  echo -e "  ${BLUE}Searching for projects matching: vital, client, suite, ptd...${NC}"
  
  PROJECTS=$(vercel project ls 2>/dev/null | tail -n +3)
  
  SIMILAR_COUNT=0
  while IFS= read -r line; do
    PROJECT=$(echo "$line" | awk '{print $1}')
    if [[ -n "$PROJECT" ]]; then
      if [[ "$PROJECT" =~ (vital|client|suite|ptd|fitness) ]]; then
        URL=$(echo "$line" | awk '{print $2}')
        if [[ "$PROJECT" == "$PROJECT_NAME" ]]; then
          echo -e "  ${GREEN}★ $PROJECT${NC} (PRIMARY) → $URL"
        else
          echo -e "  ${YELLOW}  $PROJECT${NC} → $URL"
          ((SIMILAR_COUNT++))
        fi
      fi
    fi
  done <<< "$PROJECTS"
  
  if [[ $SIMILAR_COUNT -gt 0 ]]; then
    warn "Found $SIMILAR_COUNT similar project(s) - consider consolidating"
  else
    pass "No duplicate projects found"
  fi
}

# =============================================================================
# Security Checks
# =============================================================================

check_security() {
  print_section "Security Audit"
  
  # Check vercel.json for hardcoded credentials
  if [[ -f "vercel.json" ]]; then
    if grep -q "SUPABASE_URL\|SUPABASE_KEY\|API_KEY\|SECRET" vercel.json 2>/dev/null; then
      if grep -q '"env"' vercel.json; then
        # Check if env section has actual values (not just references)
        if grep -E '"VITE_[^"]+"\s*:\s*"(https://|eyJ|sk_|pk_)' vercel.json &>/dev/null; then
          fail "Hardcoded credentials found in vercel.json"
        else
          pass "No hardcoded credentials in vercel.json"
        fi
      else
        pass "No env section in vercel.json"
      fi
    else
      pass "No sensitive keys in vercel.json"
    fi
  else
    warn "vercel.json not found"
  fi
  
  # Check for hardcoded Supabase URL in source (acceptable as it's public)
  HARDCODED_URLS=$(grep -rn "ztjndilxurtsfqdsvfds.supabase.co" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
  if [[ $HARDCODED_URLS -gt 2 ]]; then
    warn "Supabase URL referenced $HARDCODED_URLS times in source (should use env var)"
  else
    pass "Supabase URL properly configured"
  fi
  
  # Check for hardcoded API keys in source
  HARDCODED_KEYS=$(grep -rn "sk_live_\|sk_test_\|pat-na1-\|AIza" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".env" || true)
  if [[ -n "$HARDCODED_KEYS" ]]; then
    fail "Hardcoded API keys found in source code!"
    echo "$HARDCODED_KEYS" | head -3
  else
    pass "No hardcoded API keys in source"
  fi
  
  # Check for exposed secrets in git history (basic check)
  if git log -p --all -S "sk_live_" --oneline 2>/dev/null | head -1 | grep -q .; then
    warn "Potential secrets found in git history"
  else
    pass "No obvious secrets in recent git history"
  fi
  
  # Check .gitignore
  if [[ -f ".gitignore" ]]; then
    if grep -q ".env" .gitignore; then
      pass ".env files are gitignored"
    else
      warn ".env not in .gitignore"
    fi
  else
    warn ".gitignore not found"
  fi
  
  # Check for test data patterns in production code
  TEST_PATTERNS=$(grep -rn "@example.com\|@test.com\|555-0" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "placeholder\|Placeholder\|example" | wc -l)
  if [[ $TEST_PATTERNS -gt 0 ]]; then
    warn "Found $TEST_PATTERNS potential test data patterns (review manually)"
  else
    pass "No test data patterns in production code"
  fi
}

# =============================================================================
# Vercel Environment Variables
# =============================================================================

check_vercel_env() {
  print_section "Vercel Environment Variables"
  
  # Check if project exists
  VERCEL_PROJECTS=$(vercel project ls 2>/dev/null || true)
  if echo "$VERCEL_PROJECTS" | grep -q "$PROJECT_NAME"; then
    pass "Project '$PROJECT_NAME' exists in Vercel"
  else
    warn "Project '$PROJECT_NAME' not found in Vercel project list (may still be deployed)"
  fi
  
  # Try to get env vars (requires project link)
  info "Checking production environment variables..."
  
  # Check via API or local config
  if [[ -f ".vercel/project.json" ]]; then
    PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId' 2>/dev/null)
    if [[ -n "$PROJECT_ID" && "$PROJECT_ID" != "null" ]]; then
      pass "Vercel project linked (ID: ${PROJECT_ID:0:8}...)"
    fi
  fi
  
  # List what should be set
  echo ""
  info "Required Vercel Environment Variables:"
  for var in "${REQUIRED_VERCEL_ENV[@]}"; do
    echo -e "    • $var"
  done
  
  echo ""
  info "Set via: vercel env add <NAME> production"
  info "Or in Dashboard: https://vercel.com/milos-projects-d46729ec/$PROJECT_NAME/settings/environment-variables"
}

# =============================================================================
# Supabase Secrets
# =============================================================================

check_supabase_secrets() {
  print_section "Supabase Secrets"
  
  if ! command -v npx &> /dev/null; then
    warn "npx not available, skipping Supabase checks"
    return
  fi
  
  # Get secrets list
  SECRETS_OUTPUT=$(npx supabase secrets list 2>/dev/null)
  
  if [[ -z "$SECRETS_OUTPUT" ]]; then
    warn "Could not retrieve Supabase secrets (not linked or not authenticated)"
    return
  fi
  
  for secret in "${REQUIRED_SUPABASE_SECRETS[@]}"; do
    if echo "$SECRETS_OUTPUT" | grep -q "$secret"; then
      pass "Secret set: $secret"
    else
      fail "Secret missing: $secret"
    fi
  done
  
  # Count total secrets
  TOTAL_SECRETS=$(echo "$SECRETS_OUTPUT" | grep -c "|" || echo "0")
  info "Total secrets configured: $TOTAL_SECRETS"
}

# =============================================================================
# Deployment Status
# =============================================================================

check_deployment_status() {
  print_section "Deployment Status"
  
  # Check production URL
  HTTP_STATUS=$(curl -sI "$PRODUCTION_URL" 2>/dev/null | head -1 | awk '{print $2}')
  
  if [[ "$HTTP_STATUS" == "200" ]]; then
    pass "Production site is live: $PRODUCTION_URL"
  elif [[ "$HTTP_STATUS" == "401" ]]; then
    warn "Production site requires authentication (Vercel team protection)"
  else
    fail "Production site not responding (HTTP $HTTP_STATUS)"
  fi
  
  # Check Supabase health
  # ⚠️ SECURITY: Use environment variable for anon key
  SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_PUBLISHABLE_KEY}}"
  if [[ -z "$SUPABASE_ANON_KEY" ]]; then
    warn "Supabase anon key not set - skipping API check"
    warn "Set SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY environment variable"
  else
    SUPABASE_STATUS=$(curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null | head -c 100)
    
    if [[ -n "$SUPABASE_STATUS" ]]; then
      pass "Supabase API responding"
    else
      fail "Supabase API not responding"
    fi
    
    # Check Edge Function
    FUNC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/functions/v1/business-intelligence" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      -H "Content-Type: application/json" \
      -d '{"query":"health"}' 2>/dev/null)
  
  if [[ "$FUNC_STATUS" == "200" ]]; then
    pass "Edge Functions operational"
  else
    warn "Edge Functions returned HTTP $FUNC_STATUS"
  fi
  fi
  
  # Get latest deployment info
  LATEST_DEPLOY=$(vercel ls 2>/dev/null | head -1)
  if [[ -n "$LATEST_DEPLOY" ]]; then
    info "Latest deployment: $LATEST_DEPLOY"
  fi
}

# =============================================================================
# Code Quality Checks
# =============================================================================

check_code_quality() {
  print_section "Code Quality"
  
  # Check TypeScript errors
  if [[ -f "tsconfig.json" ]]; then
    TS_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
    TS_ERRORS=$(echo "$TS_OUTPUT" | grep -c "error TS" || echo "0")
    if [[ "$TS_ERRORS" == "0" || -z "$TS_ERRORS" ]]; then
      pass "No TypeScript errors"
    else
      warn "TypeScript errors: $TS_ERRORS"
    fi
  fi
  
  # Check for console.log statements
  CONSOLE_LOGS=$(grep -rn "console.log\|console.error\|console.warn" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "// eslint-disable" | wc -l | tr -d '[:space:]')
  if [[ "$CONSOLE_LOGS" -gt 10 ]]; then
    warn "Found $CONSOLE_LOGS console statements (consider removing for production)"
  else
    pass "Console statements within acceptable range ($CONSOLE_LOGS)"
  fi
  
  # Check for TODO/FIXME comments
  TODOS=$(grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d '[:space:]')
  if [[ "$TODOS" -gt 0 ]]; then
    info "Found $TODOS TODO/FIXME comments"
  fi
  
  # Check build succeeds
  if npm run build &>/dev/null; then
    pass "Build succeeds"
  else
    fail "Build failed"
  fi
}

# =============================================================================
# Generate Report
# =============================================================================

generate_report() {
  REPORT_FILE="VERIFICATION_REPORT.md"
  
  print_section "Generating Report"
  
  cat > "$REPORT_FILE" << EOF
# PTD Fitness Platform - Deployment Verification Report

**Generated:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Project:** $PROJECT_NAME
**Production URL:** $PRODUCTION_URL

## Summary

| Status | Count |
|--------|-------|
| ✅ Passed | $PASSED |
| ⚠️ Warnings | $WARNINGS |
| ❌ Failed | $FAILED |

## Configuration

### Vercel Project
- **Name:** $PROJECT_NAME
- **URL:** $PRODUCTION_URL
- **Framework:** Vite + React

### Supabase Project
- **Reference:** $SUPABASE_PROJECT_REF
- **URL:** $SUPABASE_URL

## Required Environment Variables

### Vercel (Frontend)
| Variable | Description |
|----------|-------------|
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Supabase anon/public key |

### Supabase (Edge Functions)
| Secret | Purpose |
|--------|---------|
| HUBSPOT_API_KEY | HubSpot API access |
| HUBSPOT_ACCESS_TOKEN | HubSpot OAuth token |
| GEMINI_API_KEY | Google Gemini AI |
| ANTHROPIC_API_KEY | Claude AI |
| STRIPE_SECRET_KEY | Stripe payments |
| FB_ACCESS_TOKEN | Facebook/Meta API |

## Quick Commands

\`\`\`bash
# Deploy to production
./setup-production.sh

# Set Vercel env var
vercel env add VITE_SUPABASE_URL production

# Set Supabase secret
npx supabase secrets set HUBSPOT_API_KEY=your_key

# Check deployment status
curl -I $PRODUCTION_URL

# Test Edge Function
curl -X POST "$SUPABASE_URL/functions/v1/business-intelligence" \\
  -H "Authorization: Bearer <anon_key>" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "status"}'
\`\`\`

## Links

- [Vercel Dashboard](https://vercel.com/milos-projects-d46729ec/$PROJECT_NAME)
- [Supabase Dashboard](https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF)
- [GitHub Repository](https://github.com/milosriki/client-vital-suite)

---
*Report generated by verify-deployment.sh*
EOF

  pass "Report generated: $REPORT_FILE"
}

# =============================================================================
# Print Summary
# =============================================================================

print_summary() {
  print_header "VERIFICATION SUMMARY"
  
  echo ""
  echo -e "  ${GREEN}✅ Passed:${NC}   $PASSED"
  echo -e "  ${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
  echo -e "  ${RED}❌ Failed:${NC}   $FAILED"
  echo ""
  
  TOTAL=$((PASSED + WARNINGS + FAILED))
  if [[ $FAILED -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
      echo -e "  ${GREEN}🎉 All checks passed! Deployment is healthy.${NC}"
    else
      echo -e "  ${YELLOW}⚠️  Deployment OK with $WARNINGS warnings. Review above.${NC}"
    fi
  else
    echo -e "  ${RED}❌ $FAILED critical issue(s) found. Please fix before deploying.${NC}"
  fi
  
  echo ""
  echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# =============================================================================
# Main
# =============================================================================

main() {
  print_header "PTD Fitness Platform - Deployment Verification"
  echo "  Project: $PROJECT_NAME"
  echo "  URL: $PRODUCTION_URL"
  echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
  
  case "${1:-}" in
    --security)
      check_prerequisites
      check_security
      ;;
    --find-similar)
      check_prerequisites
      find_similar_projects
      ;;
    --report)
      generate_report
      ;;
    *)
      check_prerequisites
      find_similar_projects
      check_security
      check_vercel_env
      check_supabase_secrets
      check_deployment_status
      check_code_quality
      generate_report
      ;;
  esac
  
  print_summary
}

# Run
main "$@"
