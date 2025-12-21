#!/bin/bash

# Set All Vercel Environment Variables
# ⚠️ SECURITY: This script uses environment variables - never hardcode secrets!

# Load values from environment or prompt user
SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-YOUR_PUBLISHABLE_KEY_HERE}"
GEMINI_API_KEY="${GEMINI_API_KEY:-YOUR_GEMINI_API_KEY_HERE}"
FB_PIXEL_ID="${FB_PIXEL_ID:-YOUR_FB_PIXEL_ID_HERE}"
FB_ACCESS_TOKEN="${FB_ACCESS_TOKEN:-YOUR_FB_ACCESS_TOKEN_HERE}"
EVENT_SOURCE_URL="${EVENT_SOURCE_URL:-https://your-domain.com}"

# Validate required variables
if [[ "$SUPABASE_PUBLISHABLE_KEY" == "YOUR_PUBLISHABLE_KEY_HERE" ]]; then
    echo "⚠️  ERROR: Please set environment variables before running this script"
    echo ""
    echo "Usage:"
    echo "  SUPABASE_PUBLISHABLE_KEY=your_key \\"
    echo "  GEMINI_API_KEY=your_key \\"
    echo "  FB_PIXEL_ID=your_id \\"
    echo "  FB_ACCESS_TOKEN=your_token \\"
    echo "  ./set-all-vercel-keys.sh"
    exit 1
fi

echo "🌐 Setting all Vercel environment variables..."

# Check if linked
if [ ! -f .vercel/project.json ]; then
    echo "⚠️  Project not linked. Linking now..."
    vercel link --yes
fi

# Frontend Variables (Build-time)
echo "Setting frontend variables for production..."
vercel env add VITE_SUPABASE_URL production <<< "$SUPABASE_URL" 2>&1 | grep -v "Enter" || echo "Set VITE_SUPABASE_URL"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production <<< "$SUPABASE_PUBLISHABLE_KEY" 2>&1 | grep -v "Enter" || echo "Set VITE_SUPABASE_PUBLISHABLE_KEY"
vercel env add VITE_GEMINI_API_KEY production <<< "$GEMINI_API_KEY" 2>&1 | grep -v "Enter" || echo "Set VITE_GEMINI_API_KEY"

# Backend API Variables (Runtime)
echo "Setting backend API variables for production..."
vercel env add FB_PIXEL_ID production <<< "$FB_PIXEL_ID" 2>&1 | grep -v "Enter" || echo "Set FB_PIXEL_ID"
vercel env add FB_ACCESS_TOKEN production <<< "$FB_ACCESS_TOKEN" 2>&1 | grep -v "Enter" || echo "Set FB_ACCESS_TOKEN"
vercel env add EVENT_SOURCE_URL production <<< "$EVENT_SOURCE_URL" 2>&1 | grep -v "Enter" || echo "Set EVENT_SOURCE_URL"

echo "✅ Vercel environment variables set for production!"
echo ""
echo "To set for preview/development, run:"
echo "  vercel env add VARIABLE_NAME preview"
echo "  vercel env add VARIABLE_NAME development"
