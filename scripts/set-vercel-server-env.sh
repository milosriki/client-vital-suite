#!/bin/bash

# Set Vercel Server-Side Environment Variables
# Run this script to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

set -e

echo "🔧 Setting Vercel Server-Side Environment Variables"
echo ""

# Get service role key from user
read -p "Enter Supabase Service Role Key (from Dashboard → Settings → API): " SERVICE_KEY

if [ -z "$SERVICE_KEY" ]; then
  echo "❌ Service Role Key is required!"
  exit 1
fi

SUPABASE_URL="https://ztjndilxurtsfqdsvfds.supabase.co"

echo ""
echo "Setting SUPABASE_URL for Production..."
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL production

echo ""
echo "Setting SUPABASE_SERVICE_ROLE_KEY for Production..."
echo "$SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo ""
echo "Setting SUPABASE_URL for Preview..."
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL preview

echo ""
echo "Setting SUPABASE_SERVICE_ROLE_KEY for Preview..."
echo "$SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview

echo ""
echo "Setting SUPABASE_URL for Development..."
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL development

echo ""
echo "Setting SUPABASE_SERVICE_ROLE_KEY for Development..."
echo "$SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY development

echo ""
echo "✅ Environment variables set successfully!"
echo ""
echo "Verifying..."
vercel env ls | grep -E "(SUPABASE_URL|SERVICE_ROLE)"

echo ""
echo "✅ Done! Variables are set for Production, Preview, and Development."

