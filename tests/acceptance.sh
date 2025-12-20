#!/bin/bash

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0

echo "🧪 Running acceptance tests against $BASE_URL"
echo "=============================================="

# Test 1: System Check
echo -n "1. GET /api/system-check... "
RESULT=$(curl -s "$BASE_URL/api/system-check")
if echo "$RESULT" | grep -q '"ok":true'; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL: $RESULT"
  ((FAIL++))
fi

# Test 2: Agent Proxy
echo -n "2. POST /api/agent... "
RESULT=$(curl -s -X POST "$BASE_URL/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}')
if echo "$RESULT" | grep -q '"response"\|"answer"\|"content"'; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL: $RESULT"
  ((FAIL++))
fi

# Test 3: Memory Write
echo -n "3. POST /api/memory (write)... "
RESULT=$(curl -s -X POST "$BASE_URL/api/memory" \
  -H "Content-Type: application/json" \
  -d '{"namespace":"test","key":"acceptance_test","value":{"foo":"bar"}}')
if echo "$RESULT" | grep -q '"ok":true'; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL: $RESULT"
  ((FAIL++))
fi

# Test 4: Memory Read
echo -n "4. GET /api/memory (read)... "
RESULT=$(curl -s "$BASE_URL/api/memory?namespace=test&key=acceptance_test")
if echo "$RESULT" | grep -q '"foo":"bar"'; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL: $RESULT"
  ((FAIL++))
fi

# Test 5: Query Endpoint
echo -n "5. POST /api/query... "
RESULT=$(curl -s -X POST "$BASE_URL/api/query" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the average health score?","mode":"fast"}')
if echo "$RESULT" | grep -q '"answer"\|"sourcesUsed"'; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL: $RESULT"
  ((FAIL++))
fi

# Test 6: Create Thread
echo -n "6. POST /api/threads... "
RESULT=$(curl -s -X POST "$BASE_URL/api/threads" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Thread"}')
if echo "$RESULT" | grep -q '"id"'; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL: $RESULT"
  ((FAIL++))
fi

# Cleanup test memory
curl -s -X DELETE "$BASE_URL/api/memory?namespace=test&key=acceptance_test" > /dev/null

echo ""
echo "=============================================="
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
