#!/bin/bash

# PTD Superintelligence Deployment Script
# Run this to deploy the full AI system to your Supabase project.

echo "🚀 Starting PTD Superintelligence Deployment..."

# 1. Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it: brew install supabase/tap/supabase"
    exit 1
fi

# 2. Database Migrations
echo "📦 Deploying Database Schema..."
supabase db push

# 3. Deploy Edge Functions
echo "🧠 Deploying AI Brains (Edge Functions)..."
supabase functions deploy ptd-ultimate-intelligence --no-verify-jwt
supabase functions deploy ai-ceo-master --no-verify-jwt
supabase functions deploy ai-trigger-deploy --no-verify-jwt
supabase functions deploy ai-deploy-callback --no-verify-jwt
supabase functions deploy ptd-proactive-scanner --no-verify-jwt

# 4. Set Secrets (Interactive)
echo "🔐 Setting up Secrets..."
echo "You need to set the following secrets for the AI to work:"
echo "1. ANTHROPIC_API_KEY (for Claude)"
echo "2. GOOGLE_API_KEY (for Gemini)"
echo "3. GITHUB_TOKEN (for code deployment)"
echo "4. GITHUB_REPO (e.g. 'username/repo')"

read -p "Do you want to set these now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    read -p "Enter ANTHROPIC_API_KEY: " anthropic_key
    supabase secrets set ANTHROPIC_API_KEY=$anthropic_key

    read -p "Enter GOOGLE_API_KEY: " google_key
    supabase secrets set GOOGLE_API_KEY=$google_key

    read -p "Enter GITHUB_TOKEN: " github_token
    supabase secrets set GITHUB_TOKEN=$github_token

    read -p "Enter GITHUB_REPO (owner/repo): " github_repo
    supabase secrets set GITHUB_REPO=$github_repo
fi

echo "✅ Deployment Complete!"
echo "👉 Run 'npm run dev' to start the dashboard."
echo "👉 Go to: http://localhost:5173/ultimate-ceo"
