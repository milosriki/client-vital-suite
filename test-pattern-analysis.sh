#!/bin/bash

# ============================================
# CALL PATTERN ANALYSIS - TEST SCRIPT
# Run this after deploying to verify everything works
# ============================================

echo "🧪 Testing Call Pattern Analysis System..."
echo ""

# Set your Supabase URL and key
SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-your-service-role-key}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if migrations are applied
echo "📊 Test 1: Checking database tables..."
psql "$DATABASE_URL" -c "SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'call_pattern_analysis'
);" 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ call_pattern_analysis table exists${NC}"
else
  echo -e "${RED}❌ call_pattern_analysis table not found${NC}"
fi

# Test 2: Check if RPC function exists
echo ""
echo "🔧 Test 2: Checking RPC function..."
psql "$DATABASE_URL" -c "SELECT EXISTS (
  SELECT FROM pg_proc WHERE proname = 'get_pattern_breaks'
);" 2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ get_pattern_breaks() RPC function exists${NC}"
else
  echo -e "${RED}❌ get_pattern_breaks() RPC function not found${NC}"
fi

# Test 3: Check if cron job is scheduled
echo ""
echo "⏰ Test 3: Checking cron schedule..."
psql "$DATABASE_URL" -c "SELECT * FROM cron.job WHERE jobname = 'daily-pattern-analysis';" 2>/dev/null

# Test 4: Test edge function
echo ""
echo "🚀 Test 4: Testing edge function..."
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/functions/v1/analyze-call-patterns" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}' \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Edge function responding (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Edge function error (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi

# Test 5: Check if component is in build
echo ""
echo "🎨 Test 5: Checking if PatternBreakAlert is in build..."
if [ -f "dist/assets/index-*.js" ]; then
  if grep -q "PatternBreakAlert" dist/assets/index-*.js; then
    echo -e "${GREEN}✅ PatternBreakAlert component found in build${NC}"
  else
    echo -e "${YELLOW}⚠️  PatternBreakAlert component not found in build${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Build files not found (run 'npm run build' first)${NC}"
fi

echo ""
echo "============================================"
echo "Test Summary:"
echo "  - Database schema"
echo "  - RPC functions"
echo "  - Cron schedule"
echo "  - Edge function"
echo "  - Frontend build"
echo ""
echo "Manual verification steps:"
echo "  1. Navigate to dashboard (/")"
echo "  2. Look for 'Call Pattern Breaks' card"
echo "  3. Click 'Run Analysis' button"
echo "  4. Verify pattern breaks display"
echo "============================================"
