# 🔗 Complete Setup Guide - Supabase & Vercel Connection

## ✅ Current Status

- ✅ **Vercel Team Found**: `milos' projects` (team_k2pQynzJNHrOBWbIDzK5NX4U)
- ⚠️ **Supabase CLI**: Not installed
- ⚠️ **Vercel CLI**: Not installed
- ✅ **MCP Tools**: Available (but need configuration)

---

## 🎯 Goal

Connect to both Supabase and Vercel so we can:
1. ✅ Check current secrets/env vars
2. ✅ Add missing secrets/env vars
3. ✅ Verify functions are deployed
4. ✅ Manage everything from here

---

## Option 1: Install CLIs (Recommended)

### Install Supabase CLI
```bash
# macOS (Homebrew - fastest)
brew install supabase/tap/supabase

# Or npm
npm install -g supabase
```

### Install Vercel CLI
```bash
npm install -g vercel
```

### Then Run Setup
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
./setup-connections.sh
```

---

## Option 2: Use Dashboard (No CLI Needed)

### Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds
2. **Functions**: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/functions
3. **Secrets**: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/settings/functions
4. **Database**: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/editor

### Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Find your project
3. **Environment Variables**: Project → Settings → Environment Variables
4. **Deployments**: Project → Deployments

---

## Option 3: Configure MCP (For Cursor AI)

To enable me to directly manage secrets via MCP:

### Supabase MCP Configuration
1. Get Supabase Access Token:
   - Go to: https://supabase.com/dashboard/account/tokens
   - Create new token
   - Copy token

2. Configure in Cursor:
   - Open Cursor Settings
   - Find "MCP Servers" or "Supabase MCP"
   - Add:
     - Project Reference: `ztjndilxurtsfqdsvfds`
     - Access Token: `your_token_here`

### Vercel MCP Configuration
1. Get Vercel Token:
   - Go to: https://vercel.com/account/tokens
   - Create new token
   - Copy token

2. Configure in Cursor:
   - Open Cursor Settings
   - Find "MCP Servers" or "Vercel MCP"
   - Add:
     - Team ID: `team_k2pQynzJNHrOBWbIDzK5NX4U`
     - Access Token: `your_token_here`

---

## 📋 What We Need to Set

### Supabase Secrets (Required)
- `ANTHROPIC_API_KEY` - Claude AI
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` - Gemini AI
- `HUBSPOT_API_KEY` - HubSpot sync (if using)
- `STRIPE_SECRET_KEY` - Stripe (if using)
- `LOVABLE_API_KEY` - Lovable AI (if using)

### Vercel Environment Variables (Required)
- `FB_PIXEL_ID` - Meta Pixel ID
- `FB_ACCESS_TOKEN` - Meta Access Token
- `FB_TEST_EVENT_CODE` - Optional
- `EVENT_SOURCE_URL` - Optional (defaults to www.personaltrainersdubai.com)

---

## 🚀 Quick Start Commands

### After Installing CLIs:

```bash
# 1. Login to Supabase
supabase login

# 2. Link Supabase project
supabase link --project-ref ztjndilxurtsfqdsvfds

# 3. Login to Vercel
vercel login

# 4. Link Vercel project
vercel link

# 5. Check Supabase secrets
supabase secrets list --project-ref ztjndilxurtsfqdsvfds

# 6. Check Vercel env vars
vercel env ls

# 7. Set Supabase secrets (example)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref ztjndilxurtsfqdsvfds

# 8. Set Vercel env vars (example)
vercel env add FB_PIXEL_ID production
```

---

## 📝 Next Steps

**Choose your preferred method:**

1. **Install CLIs** → Run `./setup-connections.sh`
2. **Use Dashboards** → Manual setup via web UI
3. **Configure MCP** → Enable direct management from Cursor

Once connected, I can help you:
- ✅ Check what's currently set
- ✅ Add missing secrets/env vars
- ✅ Verify everything is configured correctly
- ✅ Test connections

---

**Which method would you like to use?** I recommend Option 1 (CLIs) for the most control and automation.

