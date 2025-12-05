#!/bin/bash

# ============================================
# PTD Smart Agent System - Setup Script
# ============================================
# This script sets up the AI agent system for your dashboard
#
# Prerequisites:
# - Supabase CLI installed (npm install -g supabase)
# - Logged into Supabase (supabase login)
# - ANTHROPIC_API_KEY ready

set -e

echo "============================================"
echo "PTD Smart Agent System Setup"
echo "============================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"

# Check for .env file or prompt for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo -e "${YELLOW}ANTHROPIC_API_KEY not set in environment${NC}"
    read -p "Enter your Anthropic API Key (sk-ant-...): " ANTHROPIC_API_KEY
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY is required${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API Key configured${NC}"
echo ""

# Step 1: Link to Supabase project (if not already linked)
echo "Step 1: Checking Supabase project link..."
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo -e "${YELLOW}Project not linked. Please run:${NC}"
    echo "  supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    read -p "Enter your Supabase project ref (from dashboard URL): " PROJECT_REF
    supabase link --project-ref "$PROJECT_REF"
fi
echo -e "${GREEN}✓ Project linked${NC}"
echo ""

# Step 2: Run database migrations
echo "Step 2: Running database migrations..."
echo "  - Creating agent tables (knowledge, conversations, decisions, insights)"
echo "  - Seeding knowledge base with formulas"

supabase db push

echo -e "${GREEN}✓ Database migrations complete${NC}"
echo ""

# Step 3: Set secrets for edge functions
echo "Step 3: Setting edge function secrets..."
supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"

echo -e "${GREEN}✓ Secrets configured${NC}"
echo ""

# Step 4: Deploy edge functions
echo "Step 4: Deploying edge functions..."
echo "  - ptd-agent (main intelligence agent)"
echo "  - ptd-watcher (proactive monitoring)"

supabase functions deploy ptd-agent --no-verify-jwt
supabase functions deploy ptd-watcher --no-verify-jwt

echo -e "${GREEN}✓ Edge functions deployed${NC}"
echo ""

# Step 5: (Optional) Set up cron job for watcher
echo "Step 5: Setting up scheduled monitoring..."
echo -e "${YELLOW}Note: To enable automatic monitoring, run this SQL in Supabase:${NC}"
echo ""
cat << 'CRON_SQL'
-- Run watcher every 5 minutes
SELECT cron.schedule(
  'ptd-watcher-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/ptd-watcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'
  );
  $$
);
CRON_SQL
echo ""

echo "============================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "============================================"
echo ""
echo "Your AI Agent System is now ready:"
echo ""
echo "  1. Start your frontend:  npm run dev"
echo "  2. Open the dashboard"
echo "  3. Click the AI panel on the right"
echo "  4. Ask: 'Who needs immediate attention?'"
echo ""
echo "Quick test command:"
echo "  curl -X POST '$(supabase functions url ptd-agent)' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"query\": \"Explain the health score formula\", \"session_id\": \"test\"}'"
echo ""
echo "============================================"
