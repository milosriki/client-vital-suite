#!/bin/bash
# Apply All Database Migrations
# This ensures all tables, functions, and policies are created

set -e

PROJECT_REF="ztjndilxurtsfqdsvfds"

echo "🗄️  Applying All Database Migrations"
echo "======================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run: supabase login"
    exit 1
fi

echo "📋 Pushing all migrations to project: $PROJECT_REF"
echo ""

# Push all migrations (uses linked project)
if supabase db push --linked; then
    echo ""
    echo "✅ All migrations applied successfully!"
    echo ""
    echo "🔍 Verify in dashboard:"
    echo "   https://supabase.com/dashboard/project/$PROJECT_REF/database/migrations"
else
    echo ""
    echo "❌ Migration push failed. Check errors above."
    exit 1
fi
