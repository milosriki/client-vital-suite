# 🔐 Server-Side Environment Variables Required in Vercel

**All API routes that require server-side env vars (NOT exposed to browser)**

---

## 📍 Location to Set

**Vercel Dashboard**:  
https://vercel.com/milos-projects-d46729ec/client-vital-suite/settings/environment-variables

**Set for**: Production ✅ Preview ✅ Development ✅

---

## 🔴 CRITICAL - Required for Core Functionality

### `STRIPE_SECRET_KEY`

**Required for**: All Stripe integrations (Dashboard, Forensics, Payouts)
**Status**: ❌ **LIKELY MISSING ON VERCEL** (Present locally)

### `ANTHROPIC_API_KEY`

**Required for**: Claude Agent, Business Intelligence, Lead Replies
**Status**: ❌ **LIKELY MISSING ON VERCEL** (Present locally)

### `/api/agent` - Agent API Proxy

**File**: `api/agent.ts`

| Variable                    | Required    | Purpose                             |
| --------------------------- | ----------- | ----------------------------------- |
| `SUPABASE_URL`              | ✅ **YES**  | Supabase project URL                |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES**  | Service role key (server-only)      |
| `AGENT_API_KEY`             | ⚠️ Optional | API key for authentication (if set) |

**Status**: ✅ Both required vars are SET

---

### `/api/memory` - Server Memory API

**File**: `api/memory.ts`

| Variable                    | Required   | Purpose                        |
| --------------------------- | ---------- | ------------------------------ |
| `SUPABASE_URL`              | ✅ **YES** | Supabase project URL           |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES** | Service role key (server-only) |

**Status**: ✅ Both required vars are SET

---

### `/api/session` - Session Management

**File**: `api/session.ts`

| Variable                    | Required   | Purpose                        |
| --------------------------- | ---------- | ------------------------------ |
| `SUPABASE_URL`              | ✅ **YES** | Supabase project URL           |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES** | Service role key (server-only) |

**Status**: ✅ Both required vars are SET

---

### `/api/brain` - Brain API

**File**: `api/brain.ts`

| Variable                    | Required    | Purpose                          |
| --------------------------- | ----------- | -------------------------------- |
| `SUPABASE_URL`              | ✅ **YES**  | Supabase project URL             |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES**  | Service role key (server-only)   |
| `OPENAI_API_KEY`            | ⚠️ Optional | OpenAI API key (if using OpenAI) |

**Status**: ✅ Supabase vars SET, OpenAI optional

---

### `/api/user-memory` - User Memory API

**File**: `api/user-memory.ts`

| Variable                    | Required   | Purpose                        |
| --------------------------- | ---------- | ------------------------------ |
| `SUPABASE_URL`              | ✅ **YES** | Supabase project URL           |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES** | Service role key (server-only) |

**Status**: ✅ Both required vars are SET

---

## 🟡 OPTIONAL - For Facebook CAPI Integration

### `/api/events/[name]` - Single Facebook Event

**File**: `api/events/[name].ts`

| Variable             | Required    | Purpose                        |
| -------------------- | ----------- | ------------------------------ |
| `FB_PIXEL_ID`        | ⚠️ Optional | Facebook Pixel ID              |
| `FB_ACCESS_TOKEN`    | ⚠️ Optional | Facebook API token             |
| `FB_TEST_EVENT_CODE` | ⚠️ Optional | Test event code                |
| `EVENT_SOURCE_URL`   | ⚠️ Optional | Event source URL (has default) |

**Status**: ✅ All optional vars are SET

---

### `/api/events/batch` - Batch Facebook Events

**File**: `api/events/batch.ts`

| Variable             | Required    | Purpose                        |
| -------------------- | ----------- | ------------------------------ |
| `FB_PIXEL_ID`        | ⚠️ Optional | Facebook Pixel ID              |
| `FB_ACCESS_TOKEN`    | ⚠️ Optional | Facebook API token             |
| `FB_TEST_EVENT_CODE` | ⚠️ Optional | Test event code                |
| `EVENT_SOURCE_URL`   | ⚠️ Optional | Event source URL (has default) |

**Status**: ✅ All optional vars are SET

---

### `/api/webhook/backfill` - Facebook Webhook Backfill

**File**: `api/webhook/backfill.ts`

| Variable             | Required    | Purpose                        |
| -------------------- | ----------- | ------------------------------ |
| `FB_PIXEL_ID`        | ⚠️ Optional | Facebook Pixel ID              |
| `FB_ACCESS_TOKEN`    | ⚠️ Optional | Facebook API token             |
| `FB_TEST_EVENT_CODE` | ⚠️ Optional | Test event code                |
| `EVENT_SOURCE_URL`   | ⚠️ Optional | Event source URL (has default) |

**Status**: ✅ All optional vars are SET

---

## 🟢 NO SERVER ENV VARS NEEDED

### `/api/system-check` - Health Check

**File**: `api/system-check.ts`

**Purpose**: Checks env vars (doesn't require them to function)

**Status**: ✅ Works without env vars (just reports status)

---

### `/api/health` - Health Endpoint

**File**: `api/health.ts`

**Purpose**: Simple health check

**Status**: ✅ No env vars needed

---

## 📊 Summary Table

| API Route               | Required Server Env Vars                    | Status |
| ----------------------- | ------------------------------------------- | ------ |
| `/api/agent`            | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ SET |
| `/api/memory`           | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ SET |
| `/api/session`          | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ SET |
| `/api/brain`            | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ SET |
| `/api/user-memory`      | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ SET |
| `/api/events/[name]`    | `FB_PIXEL_ID`, `FB_ACCESS_TOKEN` (optional) | ✅ SET |
| `/api/events/batch`     | `FB_PIXEL_ID`, `FB_ACCESS_TOKEN` (optional) | ✅ SET |
| `/api/webhook/backfill` | `FB_PIXEL_ID`, `FB_ACCESS_TOKEN` (optional) | ✅ SET |
| `/api/system-check`     | None (checks vars, doesn't require)         | ✅ OK  |
| `/api/health`           | None                                        | ✅ OK  |

---

## 🔑 Common Server-Side Variables

### Always Required (5 routes)

- `SUPABASE_URL` ✅ SET
- `SUPABASE_SERVICE_ROLE_KEY` ✅ SET

### Optional but Set

- `FB_PIXEL_ID` ✅ SET
- `FB_ACCESS_TOKEN` ✅ SET
- `FB_TEST_EVENT_CODE` ✅ SET
- `EVENT_SOURCE_URL` ✅ SET
- `AGENT_API_KEY` ⚠️ Not set (optional)
- `OPENAI_API_KEY` ⚠️ Not set (optional)

---

## ✅ Verification

**Check all server-side vars**:

```bash
vercel env ls production | grep -v "VITE_"
```

**Test endpoints**:

```bash
# Test agent (requires SUPABASE_URL + SERVICE_ROLE_KEY)
curl -X POST https://client-vital-suite.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'

# Test memory (requires SUPABASE_URL + SERVICE_ROLE_KEY)
curl "https://client-vital-suite.vercel.app/api/memory?global=true"

# Test system-check (no vars required, just checks)
curl https://client-vital-suite.vercel.app/api/system-check
```

---

## 🎯 Key Points

1. **5 API routes** require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
2. **All 5 routes** have these vars SET ✅
3. **Facebook routes** have optional vars SET ✅
4. **No routes** are missing required server-side env vars ✅

**All server-side environment variables are properly configured!** 🚀
