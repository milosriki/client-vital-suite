#!/bin/bash

# Set All Vercel Environment Variables
# This script sets all required keys for Vercel

echo "🌐 Setting all Vercel environment variables..."

# Check if linked
if [ ! -f .vercel/project.json ]; then
    echo "⚠️  Project not linked. Linking now..."
    vercel link --yes
fi

# Frontend Variables (Build-time)
echo "Setting frontend variables for production..."
vercel env add VITE_SUPABASE_URL production <<< "https://ztjndilxurtsfqdsvfds.supabase.co" 2>&1 | grep -v "Enter" || echo "Set VITE_SUPABASE_URL"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NjUyMjIsImV4cCI6MjA2NTA0MTIyMn0.LkGFjn0sKMjKYQWBvvXxwWv3GZCqoVocpGmeI_JUDQM" 2>&1 | grep -v "Enter" || echo "Set VITE_SUPABASE_PUBLISHABLE_KEY"
vercel env add VITE_GEMINI_API_KEY production <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s" 2>&1 | grep -v "Enter" || echo "Set VITE_GEMINI_API_KEY"

# Backend API Variables (Runtime)
echo "Setting backend API variables for production..."
vercel env add FB_PIXEL_ID production <<< "349832333681399" 2>&1 | grep -v "Enter" || echo "Set FB_PIXEL_ID"
vercel env add FB_ACCESS_TOKEN production <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1" 2>&1 | grep -v "Enter" || echo "Set FB_ACCESS_TOKEN"
vercel env add EVENT_SOURCE_URL production <<< "https://www.personaltrainersdubai.com" 2>&1 | grep -v "Enter" || echo "Set EVENT_SOURCE_URL"

echo "✅ Vercel environment variables set for production!"
echo ""
echo "To set for preview/development, run:"
echo "  vercel env add VARIABLE_NAME preview"
echo "  vercel env add VARIABLE_NAME development"
