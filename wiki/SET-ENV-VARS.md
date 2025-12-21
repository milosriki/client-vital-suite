# 🔧 Set Vercel Environment Variables

## Current Status
- ✅ Vercel CLI connected
- ✅ Project linked: `milos-projects-d46729ec/jux`
- ⚠️ **No environment variables set** - Need to add them

## Required Variables

### Frontend Variables (Already in vercel.json, but verify):
- `VITE_SUPABASE_URL` = `https://ztjndilxurtsfqdsvfds.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `eyJhbGci...` (your anon key)

### Backend API Variables (NEED TO BE SET):
- `FB_PIXEL_ID` - Your Meta Pixel ID
- `FB_ACCESS_TOKEN` - Your Meta Access Token  
- `FB_TEST_EVENT_CODE` - Optional test code
- `EVENT_SOURCE_URL` - Optional (defaults to www.personaltrainersdubai.com)

## How to Set

### Option 1: Via CLI (Interactive)
```bash
export PATH=~/.npm-global/bin:$PATH
vercel env add FB_PIXEL_ID production
vercel env add FB_ACCESS_TOKEN production
vercel env add FB_TEST_EVENT_CODE production
vercel env add EVENT_SOURCE_URL production
```

### Option 2: Via Dashboard
1. Go to: https://vercel.com/dashboard
2. Click on your project: `jux`
3. Go to: Settings → Environment Variables
4. Add each variable:
   - Key: `FB_PIXEL_ID`
   - Value: Your Pixel ID
   - Environment: Production (and Preview/Development if needed)
   - Click "Save"

### Option 3: Set All at Once (Non-interactive)
```bash
export PATH=~/.npm-global/bin:$PATH

# Set for production
vercel env add FB_PIXEL_ID production <<< "YOUR_PIXEL_ID"
vercel env add FB_ACCESS_TOKEN production <<< "YOUR_ACCESS_TOKEN"
```

## Verify
```bash
vercel env ls
```

---

**Note**: The frontend variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`) are already in `vercel.json`, so they should be available. But you can verify they're set in the dashboard.

