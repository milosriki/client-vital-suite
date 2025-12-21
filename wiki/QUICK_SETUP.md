# 🚀 Quick Setup - Connect Supabase & Vercel

## Step 1: Install CLIs

### Install Supabase CLI
```bash
# macOS (recommended)
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

### Install Vercel CLI
```bash
npm install -g vercel
```

---

## Step 2: Run Setup Script

```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
./setup-connections.sh
```

This script will:
- ✅ Check if CLIs are installed
- ✅ Login to Supabase & Vercel
- ✅ Link your projects
- ✅ Verify connections
- ✅ Show current secrets/env vars

---

## Step 3: Set Secrets (After Setup)

### Supabase Secrets
```bash
# Core AI (REQUIRED)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref ztjndilxurtsfqdsvfds
supabase secrets set GOOGLE_API_KEY=... --project-ref ztjndilxurtsfqdsvfds

# Integrations (if using)
supabase secrets set HUBSPOT_API_KEY=... --project-ref ztjndilxurtsfqdsvfds
supabase secrets set STRIPE_SECRET_KEY=sk_live_... --project-ref ztjndilxurtsfqdsvfds
supabase secrets set LOVABLE_API_KEY=... --project-ref ztjndilxurtsfqdsvfds
```

### Vercel Environment Variables
```bash
# Backend API (REQUIRED)
vercel env add FB_PIXEL_ID production
vercel env add FB_ACCESS_TOKEN production

# Optional
vercel env add FB_TEST_EVENT_CODE production
vercel env add EVENT_SOURCE_URL production
```

---

## Alternative: Manual Setup

If you prefer to do it manually:

### Supabase
1. Get access token: https://supabase.com/dashboard/account/tokens
2. Login: `supabase login`
3. Link: `supabase link --project-ref ztjndilxurtsfqdsvfds`
4. Set secrets via dashboard: https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/settings/functions

### Vercel
1. Get token: https://vercel.com/account/tokens
2. Login: `vercel login`
3. Link: `vercel link`
4. Set env vars via dashboard: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

---

## After Setup

Once connected, I can help you:
- ✅ Check which secrets/env vars are set
- ✅ Add missing secrets/env vars
- ✅ Verify functions are deployed
- ✅ Test connections
- ✅ Deploy functions

---

**Ready to start?** Run: `./setup-connections.sh`

