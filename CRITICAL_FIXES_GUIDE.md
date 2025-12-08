# CRITICAL FIXES GUIDE
**Quick Reference for Production Deployment**

---

## 🚨 FIX #1: Create Vercel Configuration (5 minutes)

### Create vercel.json

```bash
cd /home/user/client-vital-suite
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
EOF
```

### Configure Environment Variables in Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add the following:

```
VITE_SUPABASE_URL=https://ztjndilxurtsfqdsvfds.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo
VITE_META_CAPI_URL=<YOUR_BACKEND_URL_HERE>
```

---

## 🚨 FIX #2: Deploy Backend to Railway (15 minutes)

### Option A: Railway.app (Recommended)

1. **Sign up at railway.app**

2. **Create new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository
   - Select the `backend` directory

3. **Configure Environment Variables**:
```
FB_PIXEL_ID=<your_facebook_pixel_id>
FB_ACCESS_TOKEN=<your_facebook_access_token>
FB_TEST_EVENT_CODE=TEST12345
PORT=3000
LOG_LEVEL=info
NODE_ENV=production
EVENT_SOURCE_URL=https://ptdfitness.com
TZ=Asia/Dubai
DEFAULT_CURRENCY=AED
```

4. **Deploy**:
   - Railway will auto-deploy from `backend/package.json`
   - Note the generated URL (e.g., `https://your-app.railway.app`)

5. **Update Frontend**:
```bash
# Update .env
VITE_META_CAPI_URL=https://your-app.railway.app
```

### Option B: Render.com

1. **Sign up at render.com**

2. **Create Web Service**:
   - New → Web Service
   - Connect GitHub repository
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add Environment Variables** (same as Railway)

4. **Deploy and note URL**

### Create backend/.env for Local Development

```bash
cd /home/user/client-vital-suite/backend
cat > .env << 'EOF'
# Meta Conversions API Configuration
FB_PIXEL_ID=your_pixel_id_here
FB_ACCESS_TOKEN=your_access_token_here
FB_TEST_EVENT_CODE=TEST12345

# Server Configuration
PORT=3000
LOG_LEVEL=info
NODE_ENV=development

# Event Source
EVENT_SOURCE_URL=https://ptdfitness.com

# Timezone & Currency
TZ=Asia/Dubai
DEFAULT_CURRENCY=AED

# n8n Webhook URLs
N8N_BACKFILL_WEBHOOK=https://your-n8n-instance.com/webhook/backfill
N8N_HEALTH_WEBHOOK=https://your-n8n-instance.com/webhook/health
EOF
```

---

## 🚨 FIX #3: Add Missing Environment Variable (2 minutes)

### Update .env

```bash
cd /home/user/client-vital-suite
echo "VITE_META_CAPI_URL=http://localhost:3000" >> .env
```

### Update .env.example

```bash
cat > .env.example << 'EOF'
# Supabase Configuration
# Copy this file to .env and fill in your actual values

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Meta CAPI Backend URL
VITE_META_CAPI_URL=http://localhost:3000
EOF
```

---

## 🚨 FIX #4: Add Error Boundary (10 minutes)

### Create ErrorBoundary Component

```bash
cd /home/user/client-vital-suite/src/components
cat > ErrorBoundary.tsx << 'EOF'
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // TODO: Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
            </div>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
EOF
```

### Update main.tsx to Use Error Boundary

```typescript
// Update src/main.tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Wrap the entire app:
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <VercelAnalytics />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
```

---

## ⚠️ FIX #5: Improve Security (Optional but Recommended)

### Add Backend API Key Authentication

```javascript
// backend/server.js - Add after other middleware

const API_KEY = process.env.API_KEY || 'development-key';

// API Key middleware
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (process.env.NODE_ENV === 'production' && apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Apply to API routes
app.use('/api/', requireApiKey);
```

### Add to backend .env

```bash
API_KEY=<generate-secure-random-key>
```

### Update Frontend to Send API Key

```typescript
// src/pages/MetaDashboard.tsx
const response = await fetch(`${API_BASE}/api/events/Purchase`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY || ''
  },
  body: JSON.stringify(eventData)
});
```

### Restrict CORS (Production)

```javascript
// backend/server.js
const cors = require('cors');

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-domain.com', 'https://your-domain.vercel.app']
    : '*',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

---

## 🔍 VERIFICATION CHECKLIST

After applying fixes, verify:

### Build Test
```bash
cd /home/user/client-vital-suite
npm install
npm run build
npm run preview
```
✅ Should build without errors
✅ Preview should work on localhost:4173

### TypeScript Check
```bash
npx tsc --noEmit
```
✅ Should pass with no errors

### Backend Test
```bash
cd backend
npm install
npm run dev
# In another terminal:
curl http://localhost:3000/health
```
✅ Should return `{"status":"ok",...}`

### Environment Variables
```bash
# Check frontend
cat .env
# Should contain VITE_META_CAPI_URL

# Check backend
cat backend/.env
# Should contain FB_PIXEL_ID, FB_ACCESS_TOKEN
```

### Deployment Test
1. Deploy to Vercel
2. Check environment variables are set
3. Test production build
4. Verify backend connection works

---

## 🚀 DEPLOYMENT SEQUENCE

### Step 1: Prepare (30 minutes)
- [ ] Create vercel.json
- [ ] Create backend/.env
- [ ] Update .env.example
- [ ] Add ErrorBoundary component
- [ ] Test build locally

### Step 2: Deploy Backend (15 minutes)
- [ ] Sign up for Railway/Render
- [ ] Deploy backend
- [ ] Configure environment variables
- [ ] Test backend health endpoint
- [ ] Note backend URL

### Step 3: Configure Frontend (10 minutes)
- [ ] Update VITE_META_CAPI_URL
- [ ] Commit changes
- [ ] Push to GitHub

### Step 4: Deploy Frontend (10 minutes)
- [ ] Deploy to Vercel
- [ ] Configure environment variables in Vercel
- [ ] Wait for build to complete
- [ ] Test deployment

### Step 5: Verify (15 minutes)
- [ ] Test Supabase connection
- [ ] Test Meta CAPI integration
- [ ] Test dashboard loads
- [ ] Test AI assistant
- [ ] Check error boundary works
- [ ] Monitor logs for errors

**Total Time**: ~1.5 hours

---

## 🆘 TROUBLESHOOTING

### Build Fails on Vercel
**Error**: "vite: command not found"
**Fix**: Ensure vercel.json has correct `installCommand: "npm install"`

### Backend Connection Fails
**Error**: "Failed to fetch"
**Fix**:
1. Check VITE_META_CAPI_URL is set
2. Verify backend is running
3. Check CORS configuration
4. Check backend logs

### Database Connection Fails
**Error**: "Invalid API key"
**Fix**:
1. Verify VITE_SUPABASE_ANON_KEY is correct
2. Check Supabase project is active
3. Verify RLS policies allow access

### Error Boundary Not Showing
**Fix**:
1. Verify ErrorBoundary.tsx is created
2. Check main.tsx imports it correctly
3. Verify it wraps the entire app

---

## 📞 SUPPORT RESOURCES

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs
- **Meta CAPI Docs**: https://developers.facebook.com/docs/marketing-api/conversions-api

---

**Last Updated**: 2025-12-08
**Estimated Fix Time**: 1-2 hours
**Difficulty**: Intermediate
