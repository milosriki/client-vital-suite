#!/bin/bash
# Verify all environment variables are set in Vercel
# Run: bash scripts/verify-vercel-env.sh

set -e

echo "🔍 Verifying Vercel environment variables..."
echo ""

# List all env vars
vercel env ls production 2>/dev/null | grep -E "(VITE_|SUPABASE_|FB_|EVENT_|LOG_|AGENT_)" || echo "No env vars found or not logged in"

echo ""
echo "✅ To verify manually, check:"
echo "   https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables"
echo ""
echo "📋 Required variables (13 total):"
echo "   1. VITE_SUPABASE_URL"
echo "   2. VITE_SUPABASE_PUBLISHABLE_KEY"
echo "   3. VITE_SUPABASE_ANON_KEY"
echo "   4. SUPABASE_URL"
echo "   5. SUPABASE_SERVICE_ROLE_KEY (Sensitive)"
echo "   6. VITE_GEMINI_API_KEY"
echo "   7. FB_PIXEL_ID"
echo "   8. FB_ACCESS_TOKEN (Sensitive)"
echo "   9. FB_TEST_EVENT_CODE"
echo "   10. EVENT_SOURCE_URL"
echo "   11. VITE_META_CAPI_URL"
echo "   12. VITE_API_BASE"
echo "   13. LOG_LEVEL"

