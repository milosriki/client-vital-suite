# Deployment Guide - Image Media Type Error Fix

## Overview
This PR fixes the "image media type is required" error (HTTP 400) that was occurring when using OpenAI-compatible chat completion APIs in the agent functions.

## Files Changed
1. `supabase/functions/ptd-agent-gemini/index.ts` - Fixed content validation in tool results and assistant messages
2. `supabase/functions/smart-agent/index.ts` - Applied same fixes for consistency
3. `FIX_IMAGE_MEDIA_TYPE_ERROR.md` - Comprehensive documentation of the issue and fix

## What Was Fixed
- **Assistant messages**: Changed `content: null` to `content: ""` to prevent API rejection
- **Tool result messages**: Added type-safe validation to ensure content is always a non-empty string
- **Edge case handling**: Added protection against non-string values, empty strings, and whitespace-only content

## Testing Performed
✅ Syntax validation  
✅ Logic testing with edge cases  
✅ Code review - no issues found  
✅ Security scan (CodeQL) - no vulnerabilities  
✅ Type safety improvements implemented  

## Deployment Steps

### Option 1: GitHub Actions (Recommended)
The changes will be automatically deployed when merged to the main branch via the existing GitHub Actions workflow `.github/workflows/deploy-supabase.yml`.

### Option 2: Manual Deployment
If you need to deploy manually:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the specific functions
supabase functions deploy ptd-agent-gemini
supabase functions deploy smart-agent
```

## Verification Steps

After deployment, verify the fix by:

1. **Test the agent endpoints**:
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ptd-agent-gemini \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"message":"Test message","thread_id":"test-thread"}'
   ```

2. **Check logs** in Supabase Dashboard → Edge Functions → Logs
   - Look for successful completions
   - Verify no "image media type" errors

3. **Monitor error rates**:
   - Check for reduced 400 errors in function logs
   - Verify tool calls complete successfully

## Expected Behavior After Fix
- ✅ No more "image media type is required" errors
- ✅ Tool calls complete successfully
- ✅ Assistant messages with tool_calls process correctly
- ✅ Empty tool results handled gracefully with "No data returned" message

## Rollback Plan
If issues occur after deployment:

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or redeploy previous version
git checkout <previous-commit-hash>
supabase functions deploy ptd-agent-gemini
supabase functions deploy smart-agent
```

## Related Documentation
- Main fix documentation: `FIX_IMAGE_MEDIA_TYPE_ERROR.md`
- OpenAI API reference: https://platform.openai.com/docs/api-reference/chat
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

## Support
If you encounter any issues after deployment:
1. Check Supabase function logs
2. Review the error messages in `FIX_IMAGE_MEDIA_TYPE_ERROR.md`
3. Verify environment variables are set correctly
4. Ensure API keys (GEMINI_API_KEY, LOVABLE_API_KEY) are valid

## Success Metrics
Monitor these metrics post-deployment:
- 📉 Reduced 400 error rate in agent functions
- 📈 Increased successful tool call completions
- ✅ No "image media type" errors in logs
- 🎯 Improved agent response reliability
