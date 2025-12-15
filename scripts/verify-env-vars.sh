#!/bin/bash
# =============================================================================
# Verify Environment Variables (Vercel + Supabase)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Environment Variables Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Required Vercel environment variables
VERCEL_VARS=(
  "VITE_SUPABASE_URL|Supabase project URL|https://xxx.supabase.co"
  "VITE_SUPABASE_PUBLISHABLE_KEY|Supabase anon key|eyJ..."
)

# Required Supabase secrets
SUPABASE_SECRETS=(
  "HUBSPOT_API_KEY|HubSpot private app token|pat-na1-..."
  "HUBSPOT_ACCESS_TOKEN|HubSpot OAuth token|pat-na1-..."
  "GEMINI_API_KEY|Google AI API key|AIza..."
  "ANTHROPIC_API_KEY|Anthropic Claude API key|sk-ant-..."
  "STRIPE_SECRET_KEY|Stripe secret key|sk_live_..."
  "FB_ACCESS_TOKEN|Facebook Graph API token|EAA..."
  "CALLGEAR_API_KEY|CallGear API key|..."
  "CRON_SECRET|Cron job authentication|..."
)

# Optional but recommended
OPTIONAL_SECRETS=(
  "OPENAI_API_KEY|OpenAI API key|sk-..."
  "FB_PIXEL_ID|Facebook Pixel ID|..."
  "FB_APP_SECRET|Facebook App Secret|..."
  "GTM_SERVER_URL|Google Tag Manager Server URL|https://..."
)

echo -e "${YELLOW}▶ Vercel Environment Variables (Frontend)${NC}"
echo "────────────────────────────────────────────────────"
echo ""
echo "These should be set in Vercel Dashboard or via CLI:"
echo ""

for var_info in "${VERCEL_VARS[@]}"; do
  IFS='|' read -r name desc example <<< "$var_info"
  echo -e "  ${GREEN}$name${NC}"
  echo -e "    Description: $desc"
  echo -e "    Example: $example"
  echo ""
done

echo -e "  ${BLUE}Set via CLI:${NC} vercel env add <NAME> production"
echo -e "  ${BLUE}Dashboard:${NC} https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables"
echo ""

echo -e "${YELLOW}▶ Supabase Secrets (Edge Functions)${NC}"
echo "────────────────────────────────────────────────────"
echo ""

# Check if we can get secrets
if npx supabase secrets list &>/dev/null; then
  SECRETS_OUTPUT=$(npx supabase secrets list 2>/dev/null)
  
  for secret_info in "${SUPABASE_SECRETS[@]}"; do
    IFS='|' read -r name desc example <<< "$secret_info"
    if echo "$SECRETS_OUTPUT" | grep -q "$name"; then
      echo -e "  ${GREEN}✅ $name${NC} - $desc"
    else
      echo -e "  ${RED}❌ $name${NC} - $desc (MISSING)"
    fi
  done
  
  echo ""
  echo -e "${YELLOW}▶ Optional Secrets${NC}"
  echo "────────────────────────────────────────────────────"
  
  for secret_info in "${OPTIONAL_SECRETS[@]}"; do
    IFS='|' read -r name desc example <<< "$secret_info"
    if echo "$SECRETS_OUTPUT" | grep -q "$name"; then
      echo -e "  ${GREEN}✅ $name${NC}"
    else
      echo -e "  ${YELLOW}○ $name${NC} (optional)"
    fi
  done
else
  echo -e "  ${YELLOW}⚠️  Cannot check Supabase secrets (not linked)${NC}"
  echo ""
  echo "  Required secrets:"
  for secret_info in "${SUPABASE_SECRETS[@]}"; do
    IFS='|' read -r name desc example <<< "$secret_info"
    echo -e "    • $name - $desc"
  done
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Quick Commands:${NC}"
echo ""
echo "  # Set Supabase secret"
echo "  npx supabase secrets set HUBSPOT_API_KEY=your_key"
echo ""
echo "  # Set Vercel env var"
echo "  vercel env add VITE_SUPABASE_URL production"
echo ""
echo "  # List all Supabase secrets"
echo "  npx supabase secrets list"
echo ""
