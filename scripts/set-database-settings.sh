#!/bin/bash
# Set database-level settings via Supabase CLI/psql
# Note: ALTER DATABASE requires superuser - may need to run in Dashboard SQL Editor

set -e

echo "🔧 Setting database-level configuration..."
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

echo "📋 Database Settings to Apply:"
echo "  1. app.settings.supabase_url = https://ztjndilxurtsfqdsvfds.supabase.co"
echo "  2. app.cron_secret = [generated secret]"
echo ""

# Try to get connection info
echo "⚠️  Note: ALTER DATABASE commands require superuser permissions."
echo "   These typically need to be run in Supabase Dashboard SQL Editor."
echo ""
echo "🔗 Dashboard: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/sql/new"
echo ""
echo "📝 SQL Commands to run:"
echo ""
cat << 'EOF'
-- Step 1: Confirm database
SELECT current_database() as db_name;

-- Step 2: Set Supabase URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ztjndilxurtsfqdsvfds.supabase.co';

-- Step 3: Set cron secret
ALTER DATABASE postgres SET app.cron_secret = '${CRON_SECRET:?CRON_SECRET env var required}';

-- Step 4: Verify (open NEW tab first!)
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE 
    WHEN current_setting('app.cron_secret', true) IS NOT NULL 
    THEN 'SET (hidden for security)'
    ELSE 'NOT SET'
  END as cron_secret_status;
EOF

echo ""
echo "✅ Copy the SQL above and run it in Supabase Dashboard SQL Editor"

