#!/bin/bash
# Complete Setup: Connect, Migrate, Deploy All Functions
# This script does everything needed to get all functions working

set -e

PROJECT_REF="ztjndilxurtsfqdsvfds"

echo "🔧 Complete System Setup & Deployment"
echo "======================================"
echo ""

# Step 1: Check Supabase CLI
echo "1️⃣ Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
else
    echo "✅ Supabase CLI found"
fi

# Step 2: Login check
echo ""
echo "2️⃣ Checking Supabase login..."
if ! supabase projects list &> /dev/null; then
    echo "⚠️  Not logged in. Please login:"
    supabase login
else
    echo "✅ Logged in to Supabase"
fi

# Step 3: Link project
echo ""
echo "3️⃣ Linking to project: $PROJECT_REF"
if supabase link --project-ref "$PROJECT_REF" 2>&1 | grep -q "already linked\|Linked"; then
    echo "✅ Project linked"
else
    echo "⚠️  Project link may have issues. Continuing..."
fi

# Step 4: Apply migrations
echo ""
echo "4️⃣ Applying database migrations..."
if bash scripts/apply-all-migrations.sh; then
    echo "✅ Migrations applied"
else
    echo "❌ Migration failed. Check errors above."
    exit 1
fi

# Step 5: Deploy all functions
echo ""
echo "5️⃣ Deploying all Edge Functions..."
if bash scripts/deploy-all-functions.sh; then
    echo "✅ Functions deployed"
else
    echo "⚠️  Some functions may have failed. Check output above."
fi

# Step 6: Summary
echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo ""
echo "📊 Next Steps:"
echo "   1. Verify functions in dashboard:"
echo "      https://supabase.com/dashboard/project/$PROJECT_REF/functions"
echo ""
echo "   2. Check secrets are set:"
echo "      https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
echo ""
echo "   3. Test a function:"
echo "      curl https://$PROJECT_REF.supabase.co/functions/v1/health-calculator"
echo ""
