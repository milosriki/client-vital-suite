# 🚀 Backend Deployment Guide

## Overview

Your backend (`backend/server.js`) is a Node.js Express server that acts as a Meta Conversions API proxy. It needs to be deployed separately from your frontend.

## Deployment Options

### Option 1: Vercel Serverless Functions (Recommended) ⭐

Convert your Express server to Vercel serverless functions. This keeps everything in one project.

#### Step 1: Create API Directory Structure
```
api/
  ├── health.ts          # GET /api/health
  ├── events/
  │   ├── [name].ts      # POST /api/events/:name
  │   └── batch.ts        # POST /api/events/batch
  └── webhook/
      └── backfill.ts    # POST /api/webhook/backfill
```

#### Step 2: Convert Express Routes to Serverless Functions

See `api/` directory for converted functions.

#### Step 3: Set Environment Variables in Vercel
- `FB_PIXEL_ID`
- `FB_ACCESS_TOKEN`
- `FB_TEST_EVENT_CODE` (optional)
- `EVENT_SOURCE_URL` (optional, default: https://www.personaltrainersdubai.com)

#### Step 4: Update Frontend
Set `VITE_META_CAPI_URL` to your Vercel deployment URL (same domain as frontend).

---

### Option 2: Separate Vercel Project

Deploy backend as a separate Vercel project.

#### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

#### Step 2: Deploy Backend
```bash
cd backend
vercel
```

#### Step 3: Set Environment Variables
In Vercel dashboard → Project Settings → Environment Variables:
- `FB_PIXEL_ID`
- `FB_ACCESS_TOKEN`
- `FB_TEST_EVENT_CODE` (optional)
- `EVENT_SOURCE_URL` (optional)

#### Step 4: Update Frontend
Set `VITE_META_CAPI_URL` to the backend deployment URL.

---

### Option 3: Docker Deployment (Railway/Render/Fly.io)

#### Railway
1. Connect GitHub repo
2. Select `backend/` directory
3. Set environment variables
4. Deploy

#### Render
1. Create new Web Service
2. Connect GitHub repo
3. Root directory: `backend`
4. Build command: `npm install`
5. Start command: `npm start`
6. Set environment variables

#### Fly.io
```bash
cd backend
fly launch
fly secrets set FB_PIXEL_ID=your_pixel_id
fly secrets set FB_ACCESS_TOKEN=your_token
fly deploy
```

---

### Option 4: PM2 on VPS

If you have a VPS:

```bash
cd backend
npm install
npm run pm2:start
```

Set environment variables in `.env` file or PM2 ecosystem file.

---

## Environment Variables Required

```env
# Required
FB_PIXEL_ID=your_meta_pixel_id
FB_ACCESS_TOKEN=your_meta_access_token

# Optional
FB_TEST_EVENT_CODE=TEST12345
EVENT_SOURCE_URL=https://www.personaltrainersdubai.com
PORT=3000
LOG_LEVEL=info
TZ=Asia/Dubai
```

## Testing Deployment

After deployment, test the endpoints:

```bash
# Health check
curl https://your-backend-url.vercel.app/health

# Test event
curl -X POST https://your-backend-url.vercel.app/api/events/Purchase \
  -H "Content-Type: application/json" \
  -d '{
    "user_data": {
      "email": "test@example.com"
    },
    "custom_data": {
      "value": 100,
      "currency": "AED"
    }
  }'
```

## Update Frontend Configuration

Once backend is deployed, update `vercel.json`:

```json
{
  "env": {
    "VITE_META_CAPI_URL": "https://your-actual-backend-url.vercel.app"
  }
}
```

Or set it in Vercel Dashboard → Project Settings → Environment Variables.

## Recommended: Option 1 (Vercel Serverless)

This keeps everything in one project and is easiest to manage. See the `api/` directory for serverless function implementations.

