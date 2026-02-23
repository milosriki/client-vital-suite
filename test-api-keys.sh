#!/bin/bash
# Test API Keys Script
# This script tests if the API keys are working by calling the verify-all-keys function

set -e

echo "🔍 Testing API Keys Configuration..."
echo ""

# Get Supabase URL and Service Role Key from environment or .env file
if [ -f .env ]; then
    echo "📂 Loading environment variables from .env file..."
    # Safer way to load .env file
    set -a
    source .env
    set +a
fi

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: SUPABASE_URL is not set"
    echo "Please set SUPABASE_URL in your environment or .env file"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set"
    echo "Please set SUPABASE_SERVICE_ROLE_KEY in your environment or .env file"
    exit 1
fi

echo "✅ Found SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
echo ""

# Call the verify-all-keys edge function
echo "🚀 Calling verify-all-keys edge function..."
echo ""

RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/verify-all-keys" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json")

# Check if response is valid JSON
if echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo "📊 API Key Verification Report:"
    echo "================================"
    echo ""
    
    # Extract and display summary
    echo "📈 Summary:"
    echo "$RESPONSE" | jq -r '.data.summary | to_entries[] | "  \(.key): \(.value)"'
    echo ""
    
    # Display recommendations
    echo "💡 Recommendations:"
    echo "$RESPONSE" | jq -r '.data.recommendations[]'
    echo ""
    
    # Check overall status
    OVERALL_STATUS=$(echo "$RESPONSE" | jq -r '.data.summary.overall_status')
    if [ "$OVERALL_STATUS" = "✅ ALL REQUIRED KEYS SET" ]; then
        echo "✅ SUCCESS: All required API keys are configured!"
        echo ""
        echo "🔑 Required Keys Status:"
        echo "$RESPONSE" | jq -r '.data.supabase_secrets | to_entries[] | "  \(.key): \(.value.status)"'
        echo ""
        echo "🔓 Optional Keys Status:"
        echo "$RESPONSE" | jq -r '.data.optional_secrets | to_entries[] | "  \(.key): \(.value.status)"'
        exit 0
    else
        echo "⚠️ WARNING: Some required API keys are missing!"
        echo ""
        echo "❌ Missing Keys:"
        echo "$RESPONSE" | jq -r '.data.missing_keys[] | "  - \(.key) (used by: \(.used_by | join(", ")))"'
        echo ""
        echo "Full report saved to api-keys-report.json"
        echo "$RESPONSE" | jq '.' > api-keys-report.json
        exit 1
    fi
else
    echo "❌ Error: Invalid response from verify-all-keys function"
    echo "Response: $RESPONSE"
    exit 1
fi
