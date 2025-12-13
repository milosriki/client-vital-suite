# 🔗 Setup Supabase & Vercel Connections

## Goal
Connect to Supabase (`ztjndilxurtsfqdsvfds`) and Vercel so we can check and manage secrets/keys directly.

---

## Part 1: Supabase Connection

### Step 1: Install Supabase CLI
```bash
# macOS
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```
This will open your browser to authenticate.

### Step 3: Link to Your Project
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
supabase link --project-ref ztjndilxurtsfqdsvfds
```

### Step 4: Verify Connection
```bash
# Check project info
supabase projects list

# Check functions
supabase functions list --project-ref ztjndilxurtsfqdsvfds

# Check secrets (will show names, not values)
supabase secrets list --project-ref ztjndilxurtsfqdsvfds
```

### Step 5: Set Secrets (if needed)
```bash
# Set individual secrets
supabase secrets set ANTHROPIC_API_KEY=your_key --project-ref ztjndilxurtsfqdsvfds
supabase secrets set GOOGLE_API_KEY=your_key --project-ref ztjndilxurtsfqdsvfds
supabase secrets set HUBSPOT_API_KEY=your_key --project-ref ztjndilxurtsfqdsvfds
supabase secrets set STRIPE_SECRET_KEY=your_key --project-ref ztjndilxurtsfqdsvfds
supabase secrets set LOVABLE_API_KEY=your_key --project-ref ztjndilxurtsfqdsvfds

# Or set multiple at once
supabase secrets set \
  ANTHROPIC_API_KEY=your_key \
  GOOGLE_API_KEY=your_key \
  HUBSPOT_API_KEY=your_key \
  --project-ref ztjndilxurtsfqdsvfds
```

---

## Part 2: Vercel Connection

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Link Your Project
```bash
cd /Users/milosvukovic/.cursor/worktrees/client-vital-suite-1/jux
vercel link
```
Follow the prompts to select your project.

### Step 4: Verify Connection
```bash
# Check project info
vercel project ls

# Check environment variables
vercel env ls
```

### Step 5: Set Environment Variables
```bash
# Set individual variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add FB_PIXEL_ID production
vercel env add FB_ACCESS_TOKEN production

# Or add to all environments
vercel env add VARIABLE_NAME production preview development
```

---

## Part 3: MCP Configuration (For Cursor AI)

The MCP (Model Context Protocol) connection needs to be configured in Cursor settings to point to the correct project.

### For Supabase MCP:
1. Open Cursor Settings
2. Find MCP/Supabase configuration
3. Set project reference: `ztjndilxurtsfqdsvfds`
4. Add Supabase Access Token (get from https://supabase.com/dashboard/account/tokens)

### For Vercel MCP:
1. Open Cursor Settings  
2. Find MCP/Vercel configuration
3. Add Vercel Token (get from https://vercel.com/account/tokens)
4. Set Team ID (if you have a team)

---

## Quick Setup Script

I'll create a script to automate this setup:

