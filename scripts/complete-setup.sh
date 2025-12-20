#!/bin/bash

# Complete Environment & Performance Setup Script
# Sets up both Vercel and Supabase for maximum performance

set -e

echo "🚀 Complete Environment & Performance Setup"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify Vercel CLI
echo -e "${YELLOW}Step 1: Verifying Vercel CLI...${NC}"
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI not found. Install: npm install -g vercel${NC}"
    exit 1
fi

VERCEL_USER=$(vercel whoami 2>&1 | tail -1)
if [ -z "$VERCEL_USER" ]; then
    echo -e "${RED}❌ Not logged in to Vercel. Run: vercel login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Vercel CLI authenticated as: $VERCEL_USER${NC}"
echo ""

# Step 2: Verify Supabase CLI
echo -e "${YELLOW}Step 2: Verifying Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Install: npm install -g supabase${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Step 3: Check current Vercel env vars
echo -e "${YELLOW}Step 3: Checking Vercel environment variables...${NC}"
MISSING_VARS=()

if ! vercel env ls 2>&1 | grep -q "SUPABASE_URL"; then
    MISSING_VARS+=("SUPABASE_URL")
fi

if ! vercel env ls 2>&1 | grep -q "SERVICE_ROLE"; then
    MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY")
fi

if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required Vercel env vars are set${NC}"
else
    echo -e "${YELLOW}⚠️  Missing Vercel env vars: ${MISSING_VARS[*]}${NC}"
    echo ""
    echo "To set them, run:"
    echo "  ./scripts/set-vercel-server-env.sh"
    echo ""
    echo "Or manually:"
    echo "  vercel env add SUPABASE_URL production"
    echo "  vercel env add SUPABASE_SERVICE_ROLE_KEY production"
    echo ""
fi
echo ""

# Step 4: Check Supabase secrets
echo -e "${YELLOW}Step 4: Checking Supabase secrets...${NC}"
REQUIRED_SECRETS=("ANTHROPIC_API_KEY" "GEMINI_API_KEY" "HUBSPOT_API_KEY" "STRIPE_SECRET_KEY" "OPENAI_API_KEY")
MISSING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! supabase secrets list 2>&1 | grep -q "$secret"; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All required Supabase secrets are set${NC}"
else
    echo -e "${YELLOW}⚠️  Missing Supabase secrets: ${MISSING_SECRETS[*]}${NC}"
    echo ""
    echo "To set them, run:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "  supabase secrets set ${secret}=your_key_here"
    done
    echo ""
fi
echo ""

# Step 5: Push migrations
echo -e "${YELLOW}Step 5: Pushing database migrations...${NC}"
if supabase db push --linked 2>&1; then
    echo -e "${GREEN}✅ Migrations pushed successfully${NC}"
else
    echo -e "${RED}❌ Migration push failed. Check errors above.${NC}"
    exit 1
fi
echo ""

# Step 6: Verify cron jobs (via migration)
echo -e "${YELLOW}Step 6: Verifying cron jobs...${NC}"
echo "Note: Cron jobs are created by migration 20251219000000_setup_cron_and_config.sql"
echo "Check in Supabase Dashboard → Database → Cron Jobs"
echo ""

# Step 7: Build verification
echo -e "${YELLOW}Step 7: Building frontend...${NC}"
if npm run build 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed. Check errors above.${NC}"
    exit 1
fi
echo ""

# Step 8: Summary
echo -e "${GREEN}============================================"
echo "✅ Setup Complete!"
echo "============================================${NC}"
echo ""
echo "Next Steps:"
echo "1. Set missing Vercel env vars (if any): ./scripts/set-vercel-server-env.sh"
echo "2. Set missing Supabase secrets (if any): supabase secrets set KEY=value"
echo "3. Verify cron jobs in Supabase Dashboard"
echo "4. Deploy to Vercel: git push (auto-deploys)"
echo "5. Test /api/agent endpoint after deployment"
echo ""

