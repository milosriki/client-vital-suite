#!/bin/bash

# Setup Supabase and Vercel Connections
# This script helps you connect to Supabase and Vercel for managing secrets

set -e

PROJECT_REF="ztjndilxurtsfqdsvfds"
PROJECT_URL="https://ztjndilxurtsfqdsvfds.supabase.co"

echo "🔗 Setting up Supabase & Vercel Connections"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Supabase CLI
echo "📦 Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✓ Supabase CLI found${NC}"
    SUPABASE_VERSION=$(supabase --version)
    echo "  Version: $SUPABASE_VERSION"
else
    echo -e "${YELLOW}⚠ Supabase CLI not found${NC}"
    echo "  Install with: brew install supabase/tap/supabase"
    echo "  Or: npm install -g supabase"
    read -p "Press enter after installing..."
fi

# Check Vercel CLI
echo ""
echo "📦 Checking Vercel CLI..."
if command -v vercel &> /dev/null; then
    echo -e "${GREEN}✓ Vercel CLI found${NC}"
    VERCEL_VERSION=$(vercel --version)
    echo "  Version: $VERCEL_VERSION"
else
    echo -e "${YELLOW}⚠ Vercel CLI not found${NC}"
    echo "  Install with: npm install -g vercel"
    read -p "Press enter after installing..."
fi

# Supabase Login Check
echo ""
echo "🔐 Checking Supabase authentication..."
if supabase projects list &> /dev/null; then
    echo -e "${GREEN}✓ Already logged in to Supabase${NC}"
else
    echo -e "${YELLOW}⚠ Not logged in${NC}"
    echo "  Running: supabase login"
    supabase login
fi

# Link Supabase Project
echo ""
echo "🔗 Linking Supabase project..."
if [ -f "supabase/.temp/project-ref" ]; then
    CURRENT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "")
    if [ "$CURRENT_REF" == "$PROJECT_REF" ]; then
        echo -e "${GREEN}✓ Project already linked: $PROJECT_REF${NC}"
    else
        echo -e "${YELLOW}⚠ Project linked to different ref: $CURRENT_REF${NC}"
        echo "  Relinking to: $PROJECT_REF"
        supabase link --project-ref "$PROJECT_REF"
    fi
else
    echo "  Linking to project: $PROJECT_REF"
    supabase link --project-ref "$PROJECT_REF"
fi

# Verify Supabase Connection
echo ""
echo "✅ Verifying Supabase connection..."
if supabase projects list | grep -q "$PROJECT_REF"; then
    echo -e "${GREEN}✓ Connected to project: $PROJECT_REF${NC}"
    
    # List functions
    echo ""
    echo "📋 Edge Functions:"
    supabase functions list --project-ref "$PROJECT_REF" 2>/dev/null || echo "  (Run 'supabase functions list' to see functions)"
    
    # List secrets (names only)
    echo ""
    echo "🔐 Secrets (names only):"
    supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null || echo "  (Run 'supabase secrets list' to see secrets)"
else
    echo -e "${RED}✗ Failed to connect${NC}"
fi

# Vercel Login Check
echo ""
echo "🔐 Checking Vercel authentication..."
if vercel whoami &> /dev/null; then
    echo -e "${GREEN}✓ Already logged in to Vercel${NC}"
    VERCEL_USER=$(vercel whoami)
    echo "  User: $VERCEL_USER"
else
    echo -e "${YELLOW}⚠ Not logged in${NC}"
    echo "  Running: vercel login"
    vercel login
fi

# Link Vercel Project
echo ""
echo "🔗 Linking Vercel project..."
if [ -f ".vercel/project.json" ]; then
    echo -e "${GREEN}✓ Vercel project already linked${NC}"
    cat .vercel/project.json
else
    echo "  Running: vercel link"
    vercel link
fi

# Verify Vercel Connection
echo ""
echo "✅ Verifying Vercel connection..."
if vercel project ls &> /dev/null; then
    echo -e "${GREEN}✓ Connected to Vercel${NC}"
    
    # List environment variables
    echo ""
    echo "📋 Environment Variables:"
    vercel env ls 2>/dev/null || echo "  (Run 'vercel env ls' to see variables)"
else
    echo -e "${RED}✗ Failed to connect${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check Supabase secrets: supabase secrets list --project-ref $PROJECT_REF"
echo "2. Set Supabase secrets: supabase secrets set KEY=value --project-ref $PROJECT_REF"
echo "3. Check Vercel env vars: vercel env ls"
echo "4. Set Vercel env vars: vercel env add VARIABLE_NAME production"
echo ""

