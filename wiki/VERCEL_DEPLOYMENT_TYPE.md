# Vercel Deployment Type Analysis

## ✅ Current Configuration: **HYBRID** (Static Frontend + Dynamic API)

### Static Frontend (SPA)
- **Framework**: Vite + React + TypeScript
- **Build Output**: `dist/` directory (static files)
- **Routing**: SPA with rewrites to `/index.html`
- **Deployment**: Static files served from CDN
- **Configuration**: `vercel.json` → `framework: "vite"`

### Dynamic API Routes (Serverless Functions)
- **Location**: `/api/*` folder
- **Runtime**: Node.js serverless functions (`@vercel/node`)
- **Type**: Dynamic (executed on-demand)
- **Functions**:
  - ✅ `/api/agent.ts` - NEW: Proxy to Supabase Edge Function
  - ✅ `/api/health.ts` - Health check endpoint
  - ✅ `/api/events/[name].ts` - Meta CAPI single event
  - ✅ `/api/events/batch.ts` - Meta CAPI batch events
  - ✅ `/api/webhook/backfill.ts` - Webhook handler

## How Vercel Detects Routes

### Static Routes (Frontend)
```
/ → /index.html (static)
/about → /index.html (static, SPA routing)
/dashboard → /index.html (static, SPA routing)
```

### Dynamic Routes (API)
```
/api/agent → Serverless function (dynamic)
/api/health → Serverless function (dynamic)
/api/events/:name → Serverless function (dynamic)
```

## Vercel Configuration (`vercel.json`)

```json
{
  "framework": "vite",           // Static frontend builder
  "buildCommand": "npm run build", // Builds static files
  "outputDirectory": "dist",      // Static output
  "rewrites": [
    {
      "source": "/((?!api/).*)",  // All routes EXCEPT /api/*
      "destination": "/index.html" // → Static SPA
    }
  ]
}
```

**Key Point**: Routes matching `/api/*` are **automatically** detected as serverless functions and bypass the static rewrite.

## API Route Detection

Vercel automatically detects TypeScript files in `/api` folder:
- ✅ `api/agent.ts` → `/api/agent` (serverless function)
- ✅ `api/health.ts` → `/api/health` (serverless function)
- ✅ `api/events/[name].ts` → `/api/events/:name` (dynamic route)

## Environment Variables

### Frontend (Static - Build Time)
- `VITE_SUPABASE_URL` - Bundled into static JS
- `VITE_SUPABASE_ANON_KEY` - Bundled into static JS
- `VITE_GEMINI_API_KEY` - Bundled into static JS

### API Routes (Dynamic - Runtime)
- `SUPABASE_URL` - Server-only (NOT `VITE_*`)
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only (NOT `VITE_*`)
- `FB_PIXEL_ID` - Server-only
- `FB_ACCESS_TOKEN` - Server-only

## Deployment Flow

1. **Build Phase**:
   - Vite builds static files → `dist/`
   - TypeScript API routes compiled → Serverless functions

2. **Deploy Phase**:
   - Static files → CDN (fast, cached)
   - API routes → Serverless functions (on-demand execution)

3. **Runtime**:
   - Frontend requests → Static files from CDN
   - `/api/*` requests → Serverless functions (dynamic execution)

## Benefits of This Setup

✅ **Fast Frontend**: Static files served from CDN (global edge network)
✅ **Dynamic Backend**: API routes execute server-side logic
✅ **Cost Effective**: Pay only for API function invocations
✅ **Scalable**: Auto-scales serverless functions
✅ **Secure**: Server-side secrets never exposed to browser

## Current Status

- ✅ Static frontend: Configured and working
- ✅ Dynamic API routes: Configured and working
- ✅ `/api/agent.ts`: Created (needs env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ Other API routes: Working (have required env vars)

## Next Steps

1. Add missing env vars for `/api/agent.ts`:
   ```bash
   vercel env add SUPABASE_URL production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```

2. Redeploy to activate new API route

3. Test:
   ```bash
   curl -X POST https://your-app.vercel.app/api/agent \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}'
   ```

## Summary

**Deployment Type**: **HYBRID**
- **Frontend**: Static (SPA) ✅
- **API Routes**: Dynamic (Serverless) ✅
- **Best of Both**: Fast static frontend + flexible serverless backend ✅

