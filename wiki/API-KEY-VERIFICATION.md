# API Key Verification Guide

This guide explains how to verify that your API keys are properly configured and working.

## Quick Test

To quickly test if your API keys are working, run:

```bash
./test-api-keys.sh
```

This script will:
1. Load environment variables from `.env` file
2. Call the `verify-all-keys` edge function
3. Display a comprehensive report of all API keys
4. Show which keys are missing and which functions need them

## Understanding the Report

The verification report includes:

### Required Keys (MUST be set)
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` - Primary AI service for agents
- `ANTHROPIC_API_KEY` - For Claude-based agents
- `OPENAI_API_KEY` - For OpenAI embeddings
- `HUBSPOT_API_KEY` - For HubSpot sync and automation
- `STRIPE_SECRET_KEY` - For payment processing and fraud detection
- `CALLGEAR_API_KEY` - For call tracking
- `FB_ACCESS_TOKEN` / `META_ACCESS_TOKEN` - For Facebook/Meta CAPI
- `STAPE_CAPIG_API_KEY` - For server-side tracking

### Optional Keys (nice to have)
- `LOVABLE_API_KEY` - **Optional** fallback for AI services (only used when GEMINI_API_KEY is not set)

## What This Means

After our recent updates:

✅ **Your system works WITHOUT Lovable** - GEMINI_API_KEY is all you need for AI agents  
✅ **LOVABLE_API_KEY is optional** - Only used as a fallback if GEMINI is not available  
✅ **All agent functions updated** - smart-agent, ptd-agent-gemini, stripe-payouts-ai now work independently

## Manual Verification

You can also manually call the verification function:

```bash
curl -X POST \
  "${SUPABASE_URL}/functions/v1/verify-all-keys" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" | jq '.'
```

## Interpreting Results

### ✅ ALL REQUIRED KEYS SET
All critical API keys are configured. Your system is fully operational.

### ⚠️ SOME REQUIRED KEYS MISSING
Some critical keys are missing. Check the `missing_keys` array in the report to see which ones need to be added.

### ℹ️ Optional keys not set
Optional keys (like LOVABLE_API_KEY) are not configured. This is fine - your system will work without them.

## Next Steps

If keys are missing:

1. **For Supabase secrets**: Set them using Supabase CLI or dashboard
   ```bash
   supabase secrets set GEMINI_API_KEY=your_key_here
   ```

2. **For Vercel environment variables**: Set them in Vercel dashboard or CLI
   ```bash
   vercel env add VITE_GEMINI_API_KEY
   ```

## Key Usage Map

The report includes a `key_usage_map` that shows which functions require which keys. This helps you understand:
- What will break if a key is missing
- Which keys are most critical
- Where to focus your configuration efforts

## Example Output

```json
{
  "summary": {
    "supabase_required_total": 12,
    "supabase_required_set": 12,
    "supabase_required_missing": 0,
    "supabase_required_percentage": 100,
    "supabase_optional_total": 1,
    "supabase_optional_set": 0,
    "overall_status": "✅ ALL REQUIRED KEYS SET"
  },
  "recommendations": [
    "✅ All required Supabase secrets are set",
    "ℹ️ 1 optional keys not set (Lovable fallback)",
    "⚠️ Verify Vercel env vars manually in Vercel dashboard"
  ]
}
```

This shows all required keys are set, but the optional LOVABLE_API_KEY is not - which is perfectly fine!
