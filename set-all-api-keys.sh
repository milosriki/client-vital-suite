#!/bin/bash

# Set All API Keys in Supabase
# ⚠️ SECURITY: This script uses environment variables - never hardcode secrets!

PROJECT_REF="${SUPABASE_PROJECT_REF:-ztjndilxurtsfqdsvfds}"

# Load values from environment
GOOGLE_API_KEY="${GOOGLE_API_KEY:-YOUR_GOOGLE_API_KEY_HERE}"
GEMINI_API_KEY="${GEMINI_API_KEY:-YOUR_GEMINI_API_KEY_HERE}"
GOOGLE_GEMINI_API_KEY="${GOOGLE_GEMINI_API_KEY:-$GEMINI_API_KEY}"
FB_PIXEL_ID="${FB_PIXEL_ID:-YOUR_FB_PIXEL_ID_HERE}"
FB_ACCESS_TOKEN="${FB_ACCESS_TOKEN:-YOUR_FB_ACCESS_TOKEN_HERE}"
META_APP_ID="${META_APP_ID:-YOUR_META_APP_ID_HERE}"
META_APP_SECRET="${META_APP_SECRET:-YOUR_META_APP_SECRET_HERE}"
META_CLIENT_TOKEN="${META_CLIENT_TOKEN:-YOUR_META_CLIENT_TOKEN_HERE}"
META_PAGE_ID="${META_PAGE_ID:-YOUR_META_PAGE_ID_HERE}"
META_AD_ACCOUNT_ID="${META_AD_ACCOUNT_ID:-$FB_PIXEL_ID}"

# Validate required variables
if [[ "$GOOGLE_API_KEY" == "YOUR_GOOGLE_API_KEY_HERE" ]]; then
    echo "⚠️  ERROR: Please set environment variables before running this script"
    echo ""
    echo "Usage:"
    echo "  GOOGLE_API_KEY=your_key \\"
    echo "  GEMINI_API_KEY=your_key \\"
    echo "  FB_PIXEL_ID=your_id \\"
    echo "  FB_ACCESS_TOKEN=your_token \\"
    echo "  ./set-all-api-keys.sh"
    exit 1
fi

echo "🔐 Setting all API keys in Supabase..."

# Google/Gemini Keys
echo "Setting Google/Gemini keys..."
supabase secrets set GOOGLE_API_KEY="$GOOGLE_API_KEY" --project-ref $PROJECT_REF
supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY" --project-ref $PROJECT_REF
supabase secrets set GOOGLE_GEMINI_API_KEY="$GOOGLE_GEMINI_API_KEY" --project-ref $PROJECT_REF

# Meta/Facebook Keys
echo "Setting Meta/Facebook keys..."
supabase secrets set FB_PIXEL_ID="$FB_PIXEL_ID" --project-ref $PROJECT_REF
supabase secrets set FB_ACCESS_TOKEN="$FB_ACCESS_TOKEN" --project-ref $PROJECT_REF
supabase secrets set META_APP_ID="$META_APP_ID" --project-ref $PROJECT_REF
supabase secrets set META_APP_SECRET="$META_APP_SECRET" --project-ref $PROJECT_REF
supabase secrets set META_CLIENT_TOKEN="$META_CLIENT_TOKEN" --project-ref $PROJECT_REF
supabase secrets set META_PAGE_ID="$META_PAGE_ID" --project-ref $PROJECT_REF
supabase secrets set META_AD_ACCOUNT_ID="$META_AD_ACCOUNT_ID" --project-ref $PROJECT_REF

echo "✅ All keys from documentation set!"
echo ""
echo "⚠️  Missing keys that need to be set manually:"
echo "   - ANTHROPIC_API_KEY (sk-ant-...)"
echo "   - OPENAI_API_KEY (sk-...)"
echo "   - HUBSPOT_API_KEY (pat_...)"
echo "   - STRIPE_SECRET_KEY (sk_live_...)"
echo "   - STAPE_CAPIG_API_KEY"
echo "   - LOVABLE_API_KEY"
echo ""
echo "To set missing keys, run:"
echo "  supabase secrets set KEY_NAME=value --project-ref $PROJECT_REF"
