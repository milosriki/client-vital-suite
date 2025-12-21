# 🔐 Manage Secrets & Keys - Quick Reference

## Supabase Secrets Management

### List All Secrets
```bash
supabase secrets list --project-ref ztjndilxurtsfqdsvfds
```

### Set Individual Secret
```bash
supabase secrets set SECRET_NAME=secret_value --project-ref ztjndilxurtsfqdsvfds
```

### Set Multiple Secrets
```bash
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  GOOGLE_API_KEY=... \
  HUBSPOT_API_KEY=... \
  --project-ref ztjndilxurtsfqdsvfds
```

### Required Secrets for Your Project

#### Core AI Secrets (REQUIRED):
```bash
# Claude AI (Anthropic)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref ztjndilxurtsfqdsvfds

# Google Gemini AI
supabase secrets set GOOGLE_API_KEY=... --project-ref ztjndilxurtsfqdsvfds
# OR
supabase secrets set GEMINI_API_KEY=... --project-ref ztjndilxurtsfqdsvfds
```

#### Integration Secrets (If Using):
```bash
# HubSpot
supabase secrets set HUBSPOT_API_KEY=... --project-ref ztjndilxurtsfqdsvfds

# Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref ztjndilxurtsfqdsvfds

# Lovable AI
supabase secrets set LOVABLE_API_KEY=... --project-ref ztjndilxurtsfqdsvfds

# Stape CAPI
supabase secrets set STAPE_CAPIG_API_KEY=... --project-ref ztjndilxurtsfqdsvfds
```

#### Optional Secrets:
```bash
# GitHub (for auto-deployment)
supabase secrets set GITHUB_TOKEN=ghp_... --project-ref ztjndilxurtsfqdsvfds
supabase secrets set GITHUB_REPO=username/repo --project-ref ztjndilxurtsfqdsvfds
```

---

## Vercel Environment Variables

### List All Variables
```bash
vercel env ls
```

### Add Variable (Interactive)
```bash
vercel env add VARIABLE_NAME
# Follow prompts to select environment(s)
```

### Add Variable (All Environments)
```bash
vercel env add VARIABLE_NAME production preview development
```

### Add Variable (Specific Environment)
```bash
vercel env add VARIABLE_NAME production
```

### Required Variables for Your Project

#### Frontend Variables:
```bash
# Already set in vercel.json, but verify:
vercel env add VITE_SUPABASE_URL production
# Value: https://ztjndilxurtsfqdsvfds.supabase.co

vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
# Value: eyJhbGci... (your anon key)
```

#### Backend API Variables (NEW):
```bash
# Meta CAPI
vercel env add FB_PIXEL_ID production
# Value: Your Meta Pixel ID

vercel env add FB_ACCESS_TOKEN production
# Value: Your Meta Access Token

vercel env add FB_TEST_EVENT_CODE production
# Value: Optional test event code

vercel env add EVENT_SOURCE_URL production
# Value: https://www.personaltrainersdubai.com
```

---

## Quick Setup Commands

### Run Setup Script
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
./setup-connections.sh
```

### One-Time Setup
```bash
# 1. Login to Supabase
supabase login

# 2. Link project
supabase link --project-ref ztjndilxurtsfqdsvfds

# 3. Login to Vercel
vercel login

# 4. Link Vercel project
vercel link
```

---

## Verify Everything Works

### Test Supabase Connection
```bash
# List projects
supabase projects list

# List functions
supabase functions list --project-ref ztjndilxurtsfqdsvfds

# List secrets
supabase secrets list --project-ref ztjndilxurtsfqdsvfds
```

### Test Vercel Connection
```bash
# Check login
vercel whoami

# List projects
vercel project ls

# List env vars
vercel env ls
```

---

## Troubleshooting

### Supabase: "Not logged in"
```bash
supabase login
```

### Supabase: "Project not linked"
```bash
supabase link --project-ref ztjndilxurtsfqdsvfds
```

### Vercel: "Not logged in"
```bash
vercel login
```

### Vercel: "Project not linked"
```bash
vercel link
```

---

## Security Notes

⚠️ **Never commit secrets to git!**
- Secrets are stored securely in Supabase/Vercel
- Use environment variables, not hardcoded values
- Rotate keys regularly
- Use different keys for development/production

---

## Next Steps After Setup

1. ✅ Run `./setup-connections.sh` to verify connections
2. ✅ Set all required Supabase secrets
3. ✅ Set all required Vercel environment variables
4. ✅ Test connections
5. ✅ Deploy and verify everything works

