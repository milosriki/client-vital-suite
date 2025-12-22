#!/bin/bash
# Add all 13 environment variables to Vercel
# Run: bash scripts/add-all-vercel-env.sh

set -e

echo "🚀 Adding all environment variables to Vercel..."
echo ""

# Required Variables (5)
echo "📦 Adding Required Variables..."

echo "  → VITE_SUPABASE_URL"
vercel env add VITE_SUPABASE_URL production <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_SUPABASE_URL preview <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_SUPABASE_URL development <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → VITE_SUPABASE_PUBLISHABLE_KEY"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY development <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → VITE_SUPABASE_ANON_KEY"
vercel env add VITE_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_SUPABASE_ANON_KEY preview <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_SUPABASE_ANON_KEY development <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → SUPABASE_URL"
vercel env add SUPABASE_URL production <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add SUPABASE_URL preview <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add SUPABASE_URL development <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → SUPABASE_SERVICE_ROLE_KEY (Sensitive)"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add SUPABASE_SERVICE_ROLE_KEY preview <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add SUPABASE_SERVICE_ROLE_KEY development <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEyMDYwNywiZXhwIjoyMDY5Njk2NjA3fQ.1YKDkcl8EQ6eRG1y_-LaIfd03tEJffYNCVEyTrUuNCY" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

# Gemini and Facebook Variables (5)
echo ""
echo "📦 Adding Gemini & Facebook Variables..."

echo "  → VITE_GEMINI_API_KEY"
vercel env add VITE_GEMINI_API_KEY production <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_GEMINI_API_KEY preview <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_GEMINI_API_KEY development <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → FB_PIXEL_ID"
vercel env add FB_PIXEL_ID production <<< "349832333681399" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add FB_PIXEL_ID preview <<< "349832333681399" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add FB_PIXEL_ID development <<< "349832333681399" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → FB_ACCESS_TOKEN (Sensitive)"
vercel env add FB_ACCESS_TOKEN production <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add FB_ACCESS_TOKEN preview <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add FB_ACCESS_TOKEN development <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → FB_TEST_EVENT_CODE (Preview & Dev only)"
vercel env add FB_TEST_EVENT_CODE preview <<< "TEST123" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add FB_TEST_EVENT_CODE development <<< "TEST123" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → EVENT_SOURCE_URL"
vercel env add EVENT_SOURCE_URL production <<< "https://www.personaltrainersdubai.com" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add EVENT_SOURCE_URL preview <<< "https://www.personaltrainersdubai.com" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add EVENT_SOURCE_URL development <<< "https://www.personaltrainersdubai.com" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

# URL and Config Variables (3)
echo ""
echo "📦 Adding URL & Config Variables..."

echo "  → VITE_META_CAPI_URL"
vercel env add VITE_META_CAPI_URL production <<< "https://client-vital-suite.vercel.app/api" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_META_CAPI_URL preview <<< "https://client-vital-suite.vercel.app/api" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_META_CAPI_URL development <<< "https://client-vital-suite.vercel.app/api" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → VITE_API_BASE"
vercel env add VITE_API_BASE production <<< "https://client-vital-suite.vercel.app" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_API_BASE preview <<< "https://client-vital-suite.vercel.app" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add VITE_API_BASE development <<< "https://client-vital-suite.vercel.app" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo "  → LOG_LEVEL"
vercel env add LOG_LEVEL production <<< "info" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add LOG_LEVEL preview <<< "info" 2>&1 | grep -v "Enter" || echo "    Already exists or set"
vercel env add LOG_LEVEL development <<< "info" 2>&1 | grep -v "Enter" || echo "    Already exists or set"

echo ""
echo "✅ All environment variables added!"
echo ""
echo "⚠️  IMPORTANT: Mark these as Sensitive in Vercel Dashboard:"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - FB_ACCESS_TOKEN"
echo ""
echo "🔗 Dashboard: https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables"
echo ""
echo "🚀 Next: Redeploy your project to apply changes"

