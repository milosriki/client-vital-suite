# Webhook Configuration & Size Limits

## Overview
This document details all webhook endpoints in the system, their locations, size limits, and configurations.

---

## 1. Stripe Webhook (`stripe-webhook`)

**Location:** `supabase/functions/stripe-webhook/index.ts`

**Endpoint URL:**
```
https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/stripe-webhook
```

**Configuration:**
- **Size Limit:** No explicit limit (uses Deno Edge Function default ~10MB request body)
- **Signature Verification:** Optional (checks `STRIPE_WEBHOOK_SECRET` if configured)
- **Request Method:** POST
- **Content-Type:** application/json

**What it does:**
- Receives Stripe webhook events
- Stores events in `stripe_events` table
- Processes specific event types (payments, payouts, account changes, etc.)
- Runs fraud detection checks
- Creates fraud alerts in `stripe_fraud_alerts` table

**Event Types Handled:**
- Account events (`v2.core.account.*`)
- Account person events (`account_person.*`)
- Money management events (`v2.money_management.*`)
- Financial account events (`financial_account.*`)
- Billing meter events (`billing.meter.*`)
- Payment events (`payment_intent.*`, `charge.*`)
- Subscription events (`subscription.*`)
- Invoice events (`invoice.*`)
- Payout events (`payout.*`)
- Account link events (`account_link.*`)

**Size Considerations:**
- Stripe webhook payloads are typically small (< 50KB per event)
- Stores full event object in `raw_event` JSONB column
- No batching - processes one event at a time

**Environment Variables:**
- `STRIPE_SECRET_KEY` - Required
- `STRIPE_WEBHOOK_SECRET` - Optional (for signature verification)
- `SUPABASE_URL` - Required
- `SUPABASE_SERVICE_ROLE_KEY` - Required

---

## 2. AnyTrack Webhook (`anytrack-webhook`)

**Location:** `supabase/functions/anytrack-webhook/index.ts`

**Endpoint URL:**
```
https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/anytrack-webhook
```

**Configuration:**
- **Size Limit:** No explicit limit (uses Deno Edge Function default ~10MB)
- **Request Method:** POST
- **Content-Type:** application/json

**What it does:**
- Receives conversion events from AnyTrack
- Accepts single event or array of events
- Stores events in `events` table
- Creates attribution events in `attribution_events` table
- Syncs lead events to `contacts` table

**Payload Format:**
```json
// Single event
{
  "eventName": "Purchase",
  "email": "user@example.com",
  "eventValue": 100.00,
  "currency": "AED",
  ...
}

// Or array of events
[
  { "eventName": "Purchase", ... },
  { "eventName": "Lead", ... }
]
```

**Size Considerations:**
- Logs first 500 characters of payload for debugging
- Processes events sequentially (not parallel)
- No explicit batch size limit, but processes one-by-one

**Environment Variables:**
- `SUPABASE_URL` - Required
- `SUPABASE_SERVICE_ROLE_KEY` - Required

---

## 3. Backfill Webhook (`api/webhook/backfill.ts`)

**Location:** `api/webhook/backfill.ts` (Vercel Serverless Function)

**Endpoint URL:**
```
https://client-vital-suite.vercel.app/api/webhook/backfill
```

**Configuration:**
- **Size Limit:** Vercel default (4.5MB for Hobby, 50MB for Pro)
- **Request Method:** POST
- **Content-Type:** application/json

**What it does:**
- Receives batch events from n8n or other sources
- Prepares events for Meta Conversions API (CAPI)
- Hashes PII data (email, phone, names, etc.)
- Sends to Meta CAPI endpoint
- Returns success/failure response

**Payload Format:**
```json
{
  "events": [
    {
      "event_name": "Purchase",
      "user_data": {
        "email": "user@example.com",
        "phone": "+971501234567",
        "fbp": "fb.1.xxx",
        "fbc": "fb.1.xxx"
      },
      "custom_data": {
        "currency": "AED",
        "value": 500.00
      }
    }
  ]
}

// Or single event (auto-converted to array)
{
  "event_name": "Purchase",
  "user_data": {...},
  "custom_data": {...}
}
```

**Size Considerations:**
- Accepts single event or array
- No explicit batch size limit
- Meta CAPI has limit of 50 events per request (not enforced here)
- Processes all events in one batch

**Environment Variables:**
- `FB_PIXEL_ID` - Required
- `FB_ACCESS_TOKEN` - Required
- `FB_TEST_EVENT_CODE` - Optional
- `EVENT_SOURCE_URL` - Optional (defaults to personaltrainersdubai.com)

---

## 4. Batch Events Webhook (`api/events/batch.ts`)

**Location:** `api/events/batch.ts` (Vercel Serverless Function)

**Endpoint URL:**
```
https://client-vital-suite.vercel.app/api/events/batch
```

**Configuration:**
- **Size Limit:** Vercel default (4.5MB for Hobby, 50MB for Pro)
- **Request Method:** POST
- **Content-Type:** application/json

**What it does:**
- Similar to backfill webhook
- Requires `events` array (doesn't accept single event)
- Validates array format
- Sends to Meta CAPI

**Payload Format:**
```json
{
  "events": [
    {
      "event_name": "Purchase",
      "user_data": {...},
      "custom_data": {...}
    },
    {
      "event_name": "ViewContent",
      "user_data": {...}
    }
  ]
}
```

**Size Considerations:**
- **Requires array** (returns 400 if not array)
- No explicit batch size limit
- Meta CAPI limit: 50 events per request (not enforced)

**Environment Variables:**
- Same as backfill webhook

---

## 5. CallGear ICP Router (`callgear-icp-router`)

**Location:** `supabase/functions/callgear-icp-router/index.ts`

**Endpoint URL:**
```
https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/callgear-icp-router
```

**Configuration:**
- **Size Limit:** No explicit limit (Deno Edge Function default ~10MB)
- **Request Method:** POST
- **Authentication:** Bearer token (`CALLGEAR_API_KEY`)
- **Timeout:** Must respond within 2 seconds (CallGear requirement)

**What it does:**
- Receives CallGear Intelligent Call Processing (ICP) webhooks
- Analyzes caller data
- Determines routing decision
- Returns routing instructions

**Payload Format:**
```json
{
  "cdr_id": "12345",
  "numa": "+971501234567",
  "numb": "+971501234568",
  ...
}
```

**Size Considerations:**
- Small payloads (< 5KB typical)
- **Critical:** Must respond within 2 seconds
- No batching - single call per request

**Environment Variables:**
- `CALLGEAR_API_KEY` - Required
- `SUPABASE_URL` - Required
- `SUPABASE_SERVICE_ROLE_KEY` - Required

---

## 6. Backend Server Webhook (`backend/server.js`)

**Location:** `backend/server.js` (Node.js/PM2 server)

**Endpoint URL:**
```
http://localhost:3000/api/webhook/backfill
# Or deployed URL
```

**Configuration:**
- **Size Limit:** Node.js default (typically 1MB, configurable)
- **Request Method:** POST
- **Rate Limiting:** 100 requests/minute per IP
- **Request Method:** POST

**What it does:**
- Same functionality as Vercel backfill webhook
- Processes events and sends to Meta CAPI
- Includes Pino logging

**Size Considerations:**
- Default Express body parser limit: 1MB
- Can be increased with `express.json({ limit: '10mb' })`
- Currently no explicit limit set (uses default)

**Environment Variables:**
- Same as Vercel backfill webhook

---

## Size Limits Summary

| Webhook | Platform | Default Limit | Actual Limit | Notes |
|---------|----------|---------------|---------------|-------|
| `stripe-webhook` | Supabase Edge Function | ~10MB | ~10MB | No explicit limit set |
| `anytrack-webhook` | Supabase Edge Function | ~10MB | ~10MB | No explicit limit set |
| `backfill` (Vercel) | Vercel Serverless | 4.5MB (Hobby) / 50MB (Pro) | 4.5MB/50MB | Platform limit |
| `batch` (Vercel) | Vercel Serverless | 4.5MB (Hobby) / 50MB (Pro) | 4.5MB/50MB | Platform limit |
| `callgear-icp-router` | Supabase Edge Function | ~10MB | ~10MB | Must respond < 2s |
| `backfill` (Backend) | Node.js/Express | 1MB (default) | 1MB | Can be increased |

---

## Stripe Webhook Endpoint Listing

**In Stripe Forensics Function:**
- Lists webhook endpoints: `stripe.webhookEndpoints.list({ limit: 100 })`
- **Limit:** 100 endpoints max per call
- Used for security audit (checking for unauthorized webhook destinations)

**Location:** `supabase/functions/stripe-forensics/index.ts` (line 1009)

---

## Recommendations

### 1. Add Explicit Size Limits
```typescript
// For Supabase Edge Functions
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const body = await req.text();
if (body.length > MAX_BODY_SIZE) {
  return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413 });
}
```

### 2. Add Batch Size Validation
```typescript
// For Meta CAPI webhooks
const MAX_EVENTS_PER_BATCH = 50;
if (eventsArray.length > MAX_EVENTS_PER_BATCH) {
  return res.status(400).json({ error: `Max ${MAX_EVENTS_PER_BATCH} events per batch` });
}
```

### 3. Add Request Timeout Handling
```typescript
// For CallGear ICP router
const timeout = setTimeout(() => {
  return new Response(JSON.stringify({ error: 'Timeout' }), { status: 504 });
}, 1900); // 1.9 seconds (under 2s requirement)
```

### 4. Add Payload Logging Limits
```typescript
// Current: logs first 500 chars
console.log("Payload:", JSON.stringify(body).slice(0, 500));

// Better: log size and sample
console.log("Payload size:", body.length, "bytes");
console.log("Payload sample:", JSON.stringify(body).slice(0, 200));
```

---

## Current Issues

1. **No explicit size limits** - Relies on platform defaults
2. **No batch size validation** - Could send >50 events to Meta CAPI (will fail)
3. **No timeout handling** - CallGear ICP router could exceed 2s
4. **Incomplete error handling** - Some webhooks silently fail
5. **No rate limiting** - Except backend server (100 req/min)

---

## Environment Variables Required

### Stripe Webhook
- `STRIPE_SECRET_KEY` ✅ Required
- `STRIPE_WEBHOOK_SECRET` ⚠️ Optional (recommended for production)
- `SUPABASE_URL` ✅ Required
- `SUPABASE_SERVICE_ROLE_KEY` ✅ Required

### AnyTrack Webhook
- `SUPABASE_URL` ✅ Required
- `SUPABASE_SERVICE_ROLE_KEY` ✅ Required

### Backfill/Batch Webhooks
- `FB_PIXEL_ID` ✅ Required
- `FB_ACCESS_TOKEN` ✅ Required
- `FB_TEST_EVENT_CODE` ⚠️ Optional
- `EVENT_SOURCE_URL` ⚠️ Optional

### CallGear ICP Router
- `CALLGEAR_API_KEY` ✅ Required
- `SUPABASE_URL` ✅ Required
- `SUPABASE_SERVICE_ROLE_KEY` ✅ Required

---

## Testing Webhooks

### Stripe Webhook
```bash
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  -d '{"id":"evt_test","type":"payment_intent.succeeded","data":{"object":{}}}'
```

### AnyTrack Webhook
```bash
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/anytrack-webhook \
  -H "Content-Type: application/json" \
  -d '{"eventName":"Purchase","email":"test@example.com","eventValue":100}'
```

### Backfill Webhook
```bash
curl -X POST https://client-vital-suite.vercel.app/api/webhook/backfill \
  -H "Content-Type: application/json" \
  -d '{"events":[{"event_name":"Purchase","user_data":{"email":"test@example.com"},"custom_data":{"value":100}}]}'
```


