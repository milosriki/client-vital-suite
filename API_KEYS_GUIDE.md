# API Keys & Environment Variables Configuration Guide

This document lists all the API keys and environment variables needed for the PTD Fitness Intelligence Platform dashboard to work correctly.

---

## 📍 Environment Variables Overview

The application has three main areas that require configuration:

1. **Frontend (Vite/React)** - Environment variables in `.env` file (prefixed with `VITE_`)
2. **Backend Server** - Environment variables in `backend/.env` file
3. **Supabase Edge Functions** - Secrets configured in Supabase Dashboard

---

## 🖥️ Frontend Environment Variables

**File:** `.env` (root directory)

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Your Supabase project URL | [Supabase Dashboard](https://supabase.com/dashboard) → Project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous/public key | Supabase Dashboard → Project → Settings → API → `anon` `public` key |
| `VITE_SUPABASE_PROJECT_ID` | ✅ Yes | Supabase project ID | Supabase Dashboard → Project → Settings → General |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Optional | Same as anon key (legacy) | Same as `VITE_SUPABASE_ANON_KEY` |
| `VITE_META_CAPI_URL` | Optional | Meta CAPI Proxy server URL | Default: `http://localhost:3000` |

### Example `.env` File:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_META_CAPI_URL=https://your-capi-server.com
```

---

## 🔧 Backend Server Environment Variables

**File:** `backend/.env`

| Variable | Required | Description | Where to Get It |
|----------|----------|-------------|-----------------|
| `FB_PIXEL_ID` | ✅ Yes | Facebook/Meta Pixel ID | [Meta Events Manager](https://business.facebook.com/events_manager) → Data Sources → Your Pixel |
| `FB_ACCESS_TOKEN` | ✅ Yes | Meta Conversions API Access Token | Meta Events Manager → Settings → Generate Access Token |
| `FB_TEST_EVENT_CODE` | Optional | Test event code for debugging | Meta Events Manager → Test Events |
| `PORT` | Optional | Server port | Default: `3000` |
| `LOG_LEVEL` | Optional | Logging level | Default: `info` |
| `NODE_ENV` | Optional | Environment mode | `production` or `development` |
| `EVENT_SOURCE_URL` | Optional | Default event source URL | Default: `https://ptdfitness.com` |
| `TZ` | Optional | Timezone | Default: `Asia/Dubai` |
| `DEFAULT_CURRENCY` | Optional | Default currency | Default: `AED` |
### Example `backend/.env` File:
```env
# Meta Conversions API Configuration
FB_PIXEL_ID=your_pixel_id_here
FB_ACCESS_TOKEN=your_access_token_here
FB_TEST_EVENT_CODE=TEST12345

# Server Configuration
PORT=3000
LOG_LEVEL=info
NODE_ENV=production

# Event Source
EVENT_SOURCE_URL=https://ptdfitness.com

# Timezone & Currency
TZ=Asia/Dubai
DEFAULT_CURRENCY=AED
```

---

## ☁️ Supabase Edge Function Secrets

These secrets are configured in the **Supabase Dashboard** → **Project** → **Settings** → **Edge Functions** → **Secrets**

### Core Supabase Secrets (Auto-configured)

| Secret | Required | Description | Notes |
|--------|----------|-------------|-------|
| `SUPABASE_URL` | ✅ Auto | Supabase project URL | Auto-injected by Supabase |
| `SUPABASE_ANON_KEY` | ✅ Auto | Supabase anonymous key | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Auto | Supabase service role key | Auto-injected by Supabase |

### HubSpot Integration

| Secret | Required | Description | Where to Get It |
|--------|----------|-------------|-----------------|
| `HUBSPOT_API_KEY` | ✅ Yes | HubSpot Private App Access Token | [HubSpot Developers](https://developers.hubspot.com/) → Your Account → Private Apps |

**Required for these functions:**
- `fetch-hubspot-live` - Real-time HubSpot data retrieval
- `sync-hubspot-to-capi` - HubSpot → Meta CAPI sync
- `integration-health` - Health check for HubSpot integration

**How to create a HubSpot Private App:**
1. Go to HubSpot → Settings → Account Setup → Integrations → Private Apps
2. Create a new app with these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.deals.read`
   - `crm.objects.owners.read`
   - `sales-email-read`

### Stripe Integration

| Secret | Required | Description | Where to Get It |
|--------|----------|-------------|-----------------|
| `STRIPE_SECRET_KEY` | ✅ Yes | Stripe Secret API Key | [Stripe Dashboard](https://dashboard.stripe.com/) → Developers → API Keys |

**Required for these functions:**
- `enrich-with-stripe` - Enrich CAPI events with Stripe payment data

**Note:** Use test key (`sk_test_...`) for development and live key (`sk_live_...`) for production.

### Stape CAPI Gateway

| Secret | Required | Description | Where to Get It |
|--------|----------|-------------|-----------------|
| `STAPE_CAPIG_API_KEY` | ✅ Yes | Stape CAPI Gateway API Key | [Stape.io Dashboard](https://stape.io/) → Your Container → Settings |

**Required for these functions:**
- `send-to-stape-capi` - Route events through Stape gateway
- `process-capi-batch` - Batch event processing
- `integration-health` - Health check for Stape integration

### AI/ML Integration (Anthropic Claude)

| Secret | Required | Description | Where to Get It |
|--------|----------|-------------|-----------------|
| `ANTHROPIC_API_KEY` | Optional | Anthropic Claude API Key | [Anthropic Console](https://console.anthropic.com/) → API Keys |

**Required for these functions:**
- `ptd-agent` - PTD Intelligence Agent
- `churn-predictor` - AI-powered churn prediction
- `intervention-recommender` - AI intervention recommendations

**Note:** If not configured, these functions will fall back to template-based responses instead of AI-generated ones.

### Google Gemini Integration

| Secret | Required | Description | Where to Get It |
|--------|----------|-------------|-----------------|
| `GEMINI_API_KEY` | Optional | Google Gemini API Key | [Google AI Studio](https://aistudio.google.com/) → Get API Key |

**Required for these functions:**
- `ptd-watcher` - Proactive monitoring agent (optional)

---

## 📊 Complete Secrets Summary

### Essential for Dashboard to Work:

| Secret | Service | Functions Using It |
|--------|---------|-------------------|
| `HUBSPOT_API_KEY` | HubSpot CRM | `fetch-hubspot-live`, `sync-hubspot-to-capi` |
| `STAPE_CAPIG_API_KEY` | Stape Gateway | `send-to-stape-capi`, `process-capi-batch` |
| `STRIPE_SECRET_KEY` | Stripe Payments | `enrich-with-stripe` |

### Optional for Enhanced Features:

| Secret | Service | Functions Using It |
|--------|---------|-------------------|
| `ANTHROPIC_API_KEY` | Claude AI | `ptd-agent`, `churn-predictor`, `intervention-recommender` |
| `GEMINI_API_KEY` | Google AI | `ptd-watcher` |

---

## 🚀 Setup Checklist

### Frontend Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Set `VITE_SUPABASE_URL` from Supabase dashboard
- [ ] Set `VITE_SUPABASE_ANON_KEY` from Supabase dashboard
- [ ] Set `VITE_SUPABASE_PROJECT_ID` from Supabase dashboard
- [ ] (Optional) Set `VITE_META_CAPI_URL` for Meta CAPI proxy

### Backend Server Setup
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Set `FB_PIXEL_ID` from Meta Events Manager
- [ ] Set `FB_ACCESS_TOKEN` from Meta Events Manager
- [ ] (Optional) Set `FB_TEST_EVENT_CODE` for testing

### Supabase Edge Functions Setup
- [ ] Go to Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] Add `HUBSPOT_API_KEY` - **Required for HubSpot features**
- [ ] Add `STAPE_CAPIG_API_KEY` - **Required for Meta CAPI**
- [ ] Add `STRIPE_SECRET_KEY` - **Required for Stripe features**
- [ ] (Optional) Add `ANTHROPIC_API_KEY` for AI features
- [ ] (Optional) Add `GEMINI_API_KEY` for Gemini AI

---

## 🔗 Quick Links

| Service | Dashboard URL |
|---------|--------------|
| Supabase | https://supabase.com/dashboard |
| HubSpot | https://developers.hubspot.com/ |
| Meta Events Manager | https://business.facebook.com/events_manager |
| Stripe | https://dashboard.stripe.com/apikeys |
| Stape.io | https://stape.io/dashboard |
| Anthropic | https://console.anthropic.com/ |
| Google AI Studio | https://aistudio.google.com/ |

---

## 🔒 Security Best Practices

1. **Never commit secrets to git** - Use `.env` files (already in `.gitignore`)
2. **Use environment-specific keys** - Different keys for dev/staging/production
3. **Rotate keys regularly** - Especially for production environments
4. **Use minimal permissions** - Only grant necessary scopes/permissions
5. **Monitor API usage** - Check dashboards for unusual activity

---

## ❓ Troubleshooting

### "HUBSPOT_API_KEY not configured"
- Ensure the secret is added in Supabase Dashboard → Settings → Edge Functions → Secrets
- The secret name must be exactly `HUBSPOT_API_KEY`

### "STAPE_CAPIG_API_KEY not configured"
- Add the secret in Supabase Edge Functions secrets
- Get the API key from your Stape.io dashboard

### "Missing Supabase configuration"
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected
- If missing, redeploy the edge functions

### "FB_PIXEL_ID or FB_ACCESS_TOKEN not configured"
- Add these to your `backend/.env` file
- Ensure the backend server is restarted after changes

### AI features not working
- Check if `ANTHROPIC_API_KEY` is set correctly
- The system will fall back to templates if AI is unavailable
