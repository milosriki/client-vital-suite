#!/bin/bash
# Load env vars
export $(grep -v '^#' .env.local | xargs)

echo "Testing LangSmith API with CURL..."
echo "API Key: ${LANGSMITH_API_KEY:0:10}..."

# Test 1: Check Limits/Auth (easiest endpoint)
echo "1. Testing /info or root..."
curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: $LANGSMITH_API_KEY" "https://api.smith.langchain.com/"
echo ""

# Test 2: List Projects (What the script did)
echo "2. Testing /projects..."
curl -s -X GET "https://api.smith.langchain.com/projects" \
  -H "x-api-key: $LANGSMITH_API_KEY" \
  -H "Content-Type: application/json"
echo ""
