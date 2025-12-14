#!/bin/bash

# Set All API Keys in Supabase
# This script sets all API keys found in documentation

PROJECT_REF="ztjndilxurtsfqdsvfds"

echo "🔐 Setting all API keys in Supabase..."

# Google/Gemini Keys
echo "Setting Google/Gemini keys..."
supabase secrets set GOOGLE_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s --project-ref $PROJECT_REF
supabase secrets set GEMINI_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s --project-ref $PROJECT_REF
supabase secrets set GOOGLE_GEMINI_API_KEY=AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s --project-ref $PROJECT_REF

# Meta/Facebook Keys
echo "Setting Meta/Facebook keys..."
supabase secrets set FB_PIXEL_ID=349832333681399 --project-ref $PROJECT_REF
supabase secrets set FB_ACCESS_TOKEN=EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1 --project-ref $PROJECT_REF
supabase secrets set META_APP_ID=223192964069489 --project-ref $PROJECT_REF
supabase secrets set META_APP_SECRET=667a10ddcc6dffec6cc8a22a29b80684 --project-ref $PROJECT_REF
supabase secrets set META_CLIENT_TOKEN=7626cb19dee913d36f37e24961cca09d --project-ref $PROJECT_REF
supabase secrets set META_PAGE_ID=100334836038237 --project-ref $PROJECT_REF
supabase secrets set META_AD_ACCOUNT_ID=349832333681399 --project-ref $PROJECT_REF

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
