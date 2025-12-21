#!/bin/bash

# Set All Vercel Environment Variables
# ⚠️ SECURITY: This script uses environment variables or prompts for values
# Never hardcode secrets in this file!

# Load values from environment or prompt user
SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-YOUR_PUBLISHABLE_KEY_HERE}"
GEMINI_API_KEY="${GEMINI_API_KEY:-YOUR_GEMINI_API_KEY_HERE}"
FB_PIXEL_ID="${FB_PIXEL_ID:-YOUR_FB_PIXEL_ID_HERE}"
FB_ACCESS_TOKEN="${FB_ACCESS_TOKEN:-YOUR_FB_ACCESS_TOKEN_HERE}"
EVENT_SOURCE_URL="${EVENT_SOURCE_URL:-https://your-domain.com}"

# Prompt if values are placeholders
if [[ "$SUPABASE_PUBLISHABLE_KEY" == "YOUR_PUBLISHABLE_KEY_HERE" ]]; then
    echo "⚠️  Please set environment variables or edit this script with your values"
    echo "Usage: SUPABASE_PUBLISHABLE_KEY=your_key ./set-vercel-env.sh"
    exit 1
fi

echo "🌐 Setting all Vercel environment variables..."

# Frontend Variables (for build-time)
echo "Setting frontend variables..."
vercel env add VITE_SUPABASE_URL production <<< "$SUPABASE_URL"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production <<< "$SUPABASE_PUBLISHABLE_KEY"
vercel env add VITE_GEMINI_API_KEY production <<< "$GEMINI_API_KEY"

# Backend API Variables (for serverless functions)
echo "Setting backend API variables..."
vercel env add FB_PIXEL_ID production <<< "$FB_PIXEL_ID"
vercel env add FB_ACCESS_TOKEN production <<< "$FB_ACCESS_TOKEN"
vercel env add EVENT_SOURCE_URL production <<< "$EVENT_SOURCE_URL"

# Also set for preview and development
echo "Setting for preview environment..."
vercel env add VITE_SUPABASE_URL preview <<< "$SUPABASE_URL"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview <<< "$SUPABASE_PUBLISHABLE_KEY"
vercel env add VITE_GEMINI_API_KEY preview <<< "$GEMINI_API_KEY"
vercel env add FB_PIXEL_ID preview <<< "$FB_PIXEL_ID"
vercel env add FB_ACCESS_TOKEN preview <<< "$FB_ACCESS_TOKEN"
vercel env add EVENT_SOURCE_URL preview <<< "$EVENT_SOURCE_URL"

echo "Setting for development environment..."
vercel env add VITE_SUPABASE_URL development <<< "$SUPABASE_URL"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY development <<< "$SUPABASE_PUBLISHABLE_KEY"
vercel env add VITE_GEMINI_API_KEY development <<< "$GEMINI_API_KEY"
vercel env add FB_PIXEL_ID development <<< "$FB_PIXEL_ID"
vercel env add FB_ACCESS_TOKEN development <<< "$FB_ACCESS_TOKEN"
vercel env add EVENT_SOURCE_URL development <<< "$EVENT_SOURCE_URL"

echo "✅ All Vercel environment variables set!"
echo ""
echo "To verify, run: vercel env ls"
