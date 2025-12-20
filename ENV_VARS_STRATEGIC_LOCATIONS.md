# 🗺️ Strategic Environment Variables Locations Map

**Complete mapping of where each env var is used across the codebase**

---

## 📍 FRONTEND (Browser) - `import.meta.env.VITE_*`

### Core Supabase Client (Critical Path)
**File**: `src/integrations/supabase/client.ts`
- **Line 7**: `VITE_SUPABASE_URL` - Main Supabase connection
- **Line 8**: `VITE_SUPABASE_PUBLISHABLE_KEY` - Authentication key
- **Used by**: Every component that imports `supabase` client
- **Impact**: ⚠️ **CRITICAL** - App won't work without these

### Stripe Intelligence Page
**File**: `src/pages/StripeIntelligence.tsx`
- **Line 174**: `VITE_SUPABASE_URL` - Edge Function endpoint
- **Line 179**: `VITE_SUPABASE_PUBLISHABLE_KEY` - Authorization header
- **Purpose**: Calls `stripe-payouts-ai` Edge Function
- **Impact**: 🔴 **HIGH** - Stripe AI chat feature

### Stripe AI Dashboard Component
**File**: `src/components/ptd/StripeAIDashboard.tsx`
- **Line 86**: `VITE_SUPABASE_URL` - Supabase connection
- **Line 87**: `VITE_SUPABASE_PUBLISHABLE_KEY` - Auth key
- **Purpose**: Stripe dashboard modal component
- **Impact**: 🟡 **MEDIUM** - Modal feature

### Meta Dashboard (Facebook CAPI)
**File**: `src/pages/MetaDashboard.tsx`
- **Line 15**: `VITE_META_CAPI_URL` - Facebook CAPI endpoint
- **Fallback**: Uses `window.location.origin + '/api'`
- **Impact**: 🟡 **MEDIUM** - Facebook tracking

### API Configuration
**File**: `src/config/api.ts`
- **Line 15**: `VITE_API_BASE` - Base URL for API calls
- **Fallback**: Uses `window.location.origin`
- **Impact**: 🟢 **LOW** - API routing

### Browser Connection Verification
**File**: `src/utils/verifyBrowserConnection.ts`
- **Line 30**: `VITE_SUPABASE_URL` - Connection check
- **Line 65**: `import.meta.env.PROD` - Production detection
- **Impact**: 🟢 **LOW** - Debugging/verification

---

## 🔧 SERVER-SIDE (API Routes) - `process.env.*`

### System Health Check (Critical Monitoring)
**File**: `api/system-check.ts`
- **Lines 18-37**: Checks ALL 13 env vars
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VITE_GEMINI_API_KEY`
  - `FB_PIXEL_ID`
  - `FB_ACCESS_TOKEN`
  - `FB_TEST_EVENT_CODE`
  - `EVENT_SOURCE_URL`
  - `VITE_META_CAPI_URL`
  - `VITE_API_BASE`
  - `AGENT_API_KEY`
  - `LOG_LEVEL`
- **Purpose**: Deployment verification endpoint
- **Impact**: ⚠️ **CRITICAL** - Deployment health check

### Agent API Route
**File**: `api/agent.ts`
- **Line 63**: `AGENT_API_KEY` - API authentication
- **Line 75**: `SUPABASE_URL` - Database connection
- **Line 76**: `SUPABASE_SERVICE_ROLE_KEY` - Service role auth
- **Impact**: 🔴 **HIGH** - Agent API security

### Facebook Events - Single Event
**File**: `api/events/[name].ts`
- **Line 40**: `EVENT_SOURCE_URL` - Event source URL
- **Line 63**: `FB_PIXEL_ID` - Facebook Pixel ID
- **Line 64**: `FB_ACCESS_TOKEN` - Facebook API token
- **Line 74**: `FB_TEST_EVENT_CODE` - Test mode code
- **Impact**: 🔴 **HIGH** - Facebook conversion tracking

### Facebook Events - Batch
**File**: `api/events/batch.ts`
- **Line 40**: `EVENT_SOURCE_URL` - Event source URL
- **Line 63**: `FB_PIXEL_ID` - Facebook Pixel ID
- **Line 64**: `FB_ACCESS_TOKEN` - Facebook API token
- **Line 74**: `FB_TEST_EVENT_CODE` - Test mode code
- **Impact**: 🔴 **HIGH** - Batch Facebook events

### Facebook Webhook Backfill
**File**: `api/webhook/backfill.ts`
- **Line 40**: `EVENT_SOURCE_URL` - Event source URL
- **Line 63**: `FB_PIXEL_ID` - Facebook Pixel ID
- **Line 64**: `FB_ACCESS_TOKEN` - Facebook API token
- **Line 74**: `FB_TEST_EVENT_CODE` - Test mode code
- **Impact**: 🟡 **MEDIUM** - Historical data sync

---

## 🖥️ BACKEND SERVER - `process.env.*`

### Main Server
**File**: `backend/server.js`
- **Line 10**: `LOG_LEVEL` - Logging verbosity (default: 'info')
- **Line 60**: `EVENT_SOURCE_URL` - Default event source
- **Line 83**: `FB_PIXEL_ID` - Facebook Pixel ID
- **Line 84**: `FB_ACCESS_TOKEN` - Facebook API token
- **Line 94**: `FB_TEST_EVENT_CODE` - Test event code
- **Line 172**: `PORT` - Server port (default: 3000)
- **Impact**: 🟡 **MEDIUM** - Standalone server

---

## 🛠️ SCRIPTS & TOOLS - `process.env.*`

### Stripe Blocked IPs Query
**File**: `scripts/query-stripe-blocked-ips.ts`
- **Line 9**: `VITE_SUPABASE_URL` - Supabase connection
- **Line 10**: `SUPABASE_SERVICE_ROLE_KEY` - Service role
- **Impact**: 🟢 **LOW** - Utility script

### Test Events Script
**File**: `backend/test-events.js`
- **Line 4**: `SERVER_URL` - Test server URL
- **Impact**: 🟢 **LOW** - Testing only

---

## 📊 STRATEGIC IMPORTANCE MATRIX

| Variable | Frontend | Server | Scripts | Criticality |
|----------|----------|--------|---------|-------------|
| `VITE_SUPABASE_URL` | ✅ 3 files | ✅ 2 files | ✅ 1 file | ⚠️ **CRITICAL** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ 3 files | ✅ 1 file | ❌ | ⚠️ **CRITICAL** |
| `VITE_SUPABASE_ANON_KEY` | ❌ | ✅ 1 file | ❌ | 🔴 **HIGH** |
| `SUPABASE_URL` | ❌ | ✅ 2 files | ✅ 1 file | ⚠️ **CRITICAL** |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ 2 files | ✅ 1 file | ⚠️ **CRITICAL** 🔒 |
| `VITE_GEMINI_API_KEY` | ❌ | ✅ 1 file | ❌ | 🟡 **MEDIUM** |
| `FB_PIXEL_ID` | ❌ | ✅ 4 files | ❌ | 🔴 **HIGH** |
| `FB_ACCESS_TOKEN` | ❌ | ✅ 4 files | ❌ | 🔴 **HIGH** 🔒 |
| `FB_TEST_EVENT_CODE` | ❌ | ✅ 4 files | ❌ | 🟢 **LOW** |
| `EVENT_SOURCE_URL` | ❌ | ✅ 4 files | ❌ | 🟡 **MEDIUM** |
| `VITE_META_CAPI_URL` | ✅ 1 file | ✅ 1 file | ❌ | 🟡 **MEDIUM** |
| `VITE_API_BASE` | ✅ 1 file | ✅ 1 file | ❌ | 🟢 **LOW** |
| `AGENT_API_KEY` | ❌ | ✅ 1 file | ❌ | 🟡 **MEDIUM** 🔒 |
| `LOG_LEVEL` | ❌ | ✅ 2 files | ❌ | 🟢 **LOW** |

🔒 = Sensitive (should be encrypted)

---

## 🎯 CRITICAL PATH ANALYSIS

### App Won't Load Without:
1. `VITE_SUPABASE_URL` - Used in `client.ts` (line 7)
2. `VITE_SUPABASE_PUBLISHABLE_KEY` - Used in `client.ts` (line 8)

### Features That Break Without:
- **Stripe AI Chat**: Needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Facebook Tracking**: Needs `FB_PIXEL_ID` + `FB_ACCESS_TOKEN`
- **Agent API**: Needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `AGENT_API_KEY`
- **System Check**: Needs all vars for verification

---

## 📍 FILE-BY-FILE BREAKDOWN

### Frontend Files (6)
1. `src/integrations/supabase/client.ts` - Core Supabase client
2. `src/pages/StripeIntelligence.tsx` - Stripe AI chat
3. `src/components/ptd/StripeAIDashboard.tsx` - Stripe dashboard modal
4. `src/pages/MetaDashboard.tsx` - Facebook CAPI
5. `src/config/api.ts` - API configuration
6. `src/utils/verifyBrowserConnection.ts` - Connection verification

### Server Files (5)
1. `api/system-check.ts` - Health check (checks all vars)
2. `api/agent.ts` - Agent API route
3. `api/events/[name].ts` - Single Facebook event
4. `api/events/batch.ts` - Batch Facebook events
5. `api/webhook/backfill.ts` - Facebook webhook backfill

### Backend Files (1)
1. `backend/server.js` - Standalone server

### Script Files (2)
1. `scripts/query-stripe-blocked-ips.ts` - Utility script
2. `backend/test-events.js` - Test script

---

## 🔐 SECURITY NOTES

### Sensitive Variables (Never expose to browser):
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only
- `FB_ACCESS_TOKEN` - Server-only
- `AGENT_API_KEY` - Server-only

### Safe for Browser:
- All `VITE_*` variables are bundled into frontend
- `VITE_SUPABASE_PUBLISHABLE_KEY` is safe (anon key)
- `VITE_GEMINI_API_KEY` is safe (public API key)

---

## ✅ VERIFICATION CHECKLIST

- [ ] `VITE_SUPABASE_URL` set in all 3 environments
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` set in all 3 environments
- [ ] `SUPABASE_SERVICE_ROLE_KEY` marked as Sensitive
- [ ] `FB_ACCESS_TOKEN` marked as Sensitive
- [ ] All Facebook vars set if using Facebook features
- [ ] `VITE_GEMINI_API_KEY` set if using Gemini features
- [ ] System check endpoint returns `ok: true`

---

## 🚀 DEPLOYMENT STRATEGY

1. **Required vars** (5): Set first, verify system-check passes
2. **Facebook vars** (4): Set if using Facebook CAPI
3. **Gemini var** (1): Set if using AI features
4. **Config vars** (3): Set for URL routing and logging

**Total**: 13 variables across 14 files

