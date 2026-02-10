#!/bin/bash

echo "🚀 Deploying 'Real Lisa' (NEPQ v3) and 'Atlas Auditor' to Supabase Edge Network..."

# 1. Deploy the Function
./node_modules/.bin/supabase functions deploy ptd-agent-gemini --no-verify-jwt

# 2. Deploy First Auditor (Atlas)
./node_modules/.bin/supabase functions deploy ptd-skill-auditor --no-verify-jwt

# 2. Deploy the Auditor (Atlas)
./node_modules/.bin/supabase functions deploy ptd-skill-auditor --no-verify-jwt

echo "✅ Deployment Complete."
echo "🧠 Unified Lisa is now LIVE."
echo "👉 Test her here: https://wa.me/message/YOUR_LINK"
