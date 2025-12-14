#!/bin/bash

# Set All Vercel Environment Variables
# Based on keys found in documentation

echo "🌐 Setting all Vercel environment variables..."

# Frontend Variables (for build-time)
echo "Setting frontend variables..."
vercel env add VITE_SUPABASE_URL production <<< "https://ztjndilxurtsfqdsvfds.supabase.co"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NjUyMjIsImV4cCI6MjA2NTA0MTIyMn0.LkGFjn0sKMjKYQWBvvXxwWv3GZCqoVocpGmeI_JUDQM"
vercel env add VITE_GEMINI_API_KEY production <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s"

# Backend API Variables (for serverless functions)
echo "Setting backend API variables..."
vercel env add FB_PIXEL_ID production <<< "349832333681399"
vercel env add FB_ACCESS_TOKEN production <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1"
vercel env add EVENT_SOURCE_URL production <<< "https://www.personaltrainersdubai.com"

# Also set for preview and development
echo "Setting for preview environment..."
vercel env add VITE_SUPABASE_URL preview <<< "https://ztjndilxurtsfqdsvfds.supabase.co"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NjUyMjIsImV4cCI6MjA2NTA0MTIyMn0.LkGFjn0sKMjKYQWBvvXxwWv3GZCqoVocpGmeI_JUDQM"
vercel env add VITE_GEMINI_API_KEY preview <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s"
vercel env add FB_PIXEL_ID preview <<< "349832333681399"
vercel env add FB_ACCESS_TOKEN preview <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1"
vercel env add EVENT_SOURCE_URL preview <<< "https://www.personaltrainersdubai.com"

echo "Setting for development environment..."
vercel env add VITE_SUPABASE_URL development <<< "https://ztjndilxurtsfqdsvfds.supabase.co"
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY development <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NjUyMjIsImV4cCI6MjA2NTA0MTIyMn0.LkGFjn0sKMjKYQWBvvXxwWv3GZCqoVocpGmeI_JUDQM"
vercel env add VITE_GEMINI_API_KEY development <<< "AIzaSyBbHpPCMl_QOmvPRvop4656CcfqqA5_i_s"
vercel env add FB_PIXEL_ID development <<< "349832333681399"
vercel env add FB_ACCESS_TOKEN development <<< "EAADKZCilWZBHEBQMFcIgF9iTEPeXBmOvExm0HFIXDzcRQA1DPOWoieespOjXQdr2wdsJlZBx4W3IJyIcwZC3mXw0ZBvnIUTTYagAiLaTN4ohBuuVTwDlVTEgrW0z85LSIEmHx2wtOzItBxsPtYVcJoTZBkZBZAFFPEUIoRo86Tok9YdJzhqwgPd5mTESjnjFxzDGtDPpAtZC1"
vercel env add EVENT_SOURCE_URL development <<< "https://www.personaltrainersdubai.com"

echo "✅ All Vercel environment variables set!"
echo ""
echo "To verify, run: vercel env ls"
