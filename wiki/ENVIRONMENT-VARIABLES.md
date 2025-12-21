# 🔐 Environment Variables & Secrets Configuration

## ✅ Updated Configuration

### Event Source URL
**Changed from:** `https://ptdfitness.com`  
**Changed to:** `https://www.personaltrainersdubai.com`

All references updated in:
- ✅ API serverless functions (`/api/*`)
- ✅ Supabase Edge Functions
- ✅ Frontend components
- ✅ Backend server

---

## 📋 Required Supabase Secrets

These must be set in **Supabase Dashboard → Project Settings → Edge Functions → Secrets**

### Core AI Secrets (Required)

| Secret Name | Used By | Purpose |
|------------|---------|---------|
| `ANTHROPIC_API_KEY` | `ptd-agent`, `ptd-agent-claude`, `churn-predictor`, `intervention-recommender`, `ptd-ultimate-intelligence` | Claude AI (Anthropic) for main AI agents |
| `GOOGLE_API_KEY` | `ptd-agent-gemini`, `ptd-watcher`, `ptd-ultimate-intelligence` | Google Gemini AI |
| `GEMINI_API_KEY` | `ptd-watcher` | Alternative Gemini key (check which one is used) |

### Integration Secrets

| Secret Name | Used By | Purpose |
|------------|---------|---------|
| `HUBSPOT_API_KEY` | `sync-hubspot-to-supabase`, `sync-hubspot-to-capi`, `fetch-hubspot-live` | HubSpot API integration |
| `STRIPE_SECRET_KEY` | `stripe-dashboard-data`, `stripe-forensics`, `stripe-payouts-ai`, `enrich-with-stripe` | Stripe API for payment data |
| `STAPE_CAPIG_API_KEY` | `send-to-stape-capi` | Stape CAPI integration |
| `LOVABLE_API_KEY` | `smart-agent`, `stripe-payouts-ai` | Lovable AI integration |

### Auto-Deployment Secrets (Optional)

| Secret Name | Used By | Purpose |
|------------|---------|---------|
| `GITHUB_TOKEN` | `ai-trigger-deploy`, `ai-deploy-callback` | GitHub API for auto-deployment |
| `GITHUB_REPO` | `ai-trigger-deploy`, `ai-deploy-callback` | GitHub repo (format: `owner/repo`) |

### Auto-Provided by Supabase (No Action Needed)

These are automatically provided by Supabase - **DO NOT SET MANUALLY**:
- `SUPABASE_URL` - Auto-provided
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided
- `SUPABASE_ANON_KEY` - Auto-provided

---

## 🌐 Vercel Environment Variables

Set in **Vercel Dashboard → Project Settings → Environment Variables**

### Frontend Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `https://ztjndilxurtsfqdsvfds.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGci...` (your anon key) | Supabase anon key |

### Backend API Variables (Vercel Serverless Functions)

| Variable | Value | Purpose |
|----------|-------|---------|
| `FB_PIXEL_ID` | Your Meta Pixel ID | Meta Conversions API |
| `FB_ACCESS_TOKEN` | Your Meta Access Token | Meta Conversions API |
| `FB_TEST_EVENT_CODE` | (Optional) Test code | Meta test events |
| `EVENT_SOURCE_URL` | `https://www.personaltrainersdubai.com` | Default event source |

---

## 🔍 Verification Checklist

### Supabase Secrets
- [ ] `ANTHROPIC_API_KEY` - Set in Supabase secrets
- [ ] `GOOGLE_API_KEY` or `GEMINI_API_KEY` - Set in Supabase secrets
- [ ] `HUBSPOT_API_KEY` - Set if using HubSpot integration
- [ ] `STRIPE_SECRET_KEY` - Set if using Stripe integration
- [ ] `STAPE_CAPIG_API_KEY` - Set if using Stape
- [ ] `LOVABLE_API_KEY` - Set if using Lovable AI features
- [ ] `GITHUB_TOKEN` - Set if using auto-deployment
- [ ] `GITHUB_REPO` - Set if using auto-deployment

### Vercel Variables
- [ ] `VITE_SUPABASE_URL` - Set in Vercel
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` - Set in Vercel
- [ ] `FB_PIXEL_ID` - Set in Vercel (for API functions)
- [ ] `FB_ACCESS_TOKEN` - Set in Vercel (for API functions)
- [ ] `EVENT_SOURCE_URL` - Optional, defaults to www.personaltrainersdubai.com

### Code Updates
- [x] All `ptdfitness.com` → `www.personaltrainersdubai.com`
- [x] n8n references removed/updated
- [x] API functions created
- [x] Supabase client consolidated

---

## 🚫 Removed/Deprecated

### Legacy Systems
- ✅ All AI agents now run directly in Supabase Edge Functions

### Old URLs
- ❌ `https://ptdfitness.com` - Replaced everywhere
- ✅ `https://www.personaltrainersdubai.com` - New default

---

## 🧪 Testing Secrets

### Test Supabase Function
```bash
curl -X POST 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-agent' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"query": "test", "session_id": "test"}'
```

### Test Vercel API
```bash
curl https://your-project.vercel.app/api/health
```

---

## 📝 Notes

1. **Lovable Integration**: Lovable connects directly to Supabase and Vercel - env vars are synced automatically
2. **Supabase Secrets**: Must be set via Supabase CLI or Dashboard (not in code)
3. **Vercel Variables**: Set in Vercel Dashboard (also in `vercel.json` for reference)
4. **Event Source**: All CAPI events now use `www.personaltrainersdubai.com` as default

---

**Last Updated**: After removing n8n dependencies and updating URLs

