# PTD Tracking: Context7 MCP Solutions for All Issues

> **Date:** 2026-03-01  
> **Source:** Context7 MCP `resolve-library-id` + `query-docs`  
> **Purpose:** Map each PTD issue to official documentation patterns

---

## Library IDs (Resolved)

| System | Context7 Library ID | Snippets |
|--------|--------------------|----------|
| Supabase | `/supabase/supabase` | Edge functions, webhooks, error handling |
| HubSpot | `/websites/developers_hubspot` | Workflows, deals, lifecycle, currency |
| GTM | `/websites/developers_google_tag-platform` | dataLayer, triggers, variables |
| Cloudflare | `/cloudflare/cloudflare-docs` | Workers, webhooks, signature verification |
| PostgreSQL | `/websites/postgresql` | COALESCE, NULL handling |
| Meta CAPI | *Web search* — developers.facebook.com/docs/marketing-api/conversions-api |

---

## 1. GTM: Form Submission Trigger Never Fires

**Issue:** Trigger `hubspot_form_submission` never fires — site uses Typeform/Calendly, not HubSpot forms.

**Context7 Pattern (GTM):**
```javascript
// Push custom event to dataLayer when user lands on thank-you page
dataLayer.push({'event': 'event_name'});

// For lead conversion:
dataLayer.push({ 'event': 'lead_submitted', 'form_data': {...}, 'lead_value': 400 });
```

**Source:** `/websites/developers_google_tag-platform` — "Use a data layer with event handlers"

**Fix:**
1. Add `dataLayer.push` on `/thank-you` page (or via Typeform/Calendly redirect completion webhook).
2. Create GTM trigger: **Custom Event** → Event name = `lead_submitted` (or `hubspot_form_submission` if you want to keep existing tag config).
3. Re-assign 7 conversion tags to this trigger.

---

## 2. HubSpot Lifecycle Bug (1184339785 vs customer)

**Issue:** Workflow sets `lifecyclestage` to `1184339785` (Schedule) instead of `opportunity` — blocks Closed Won from setting `customer`.

**Context7 Pattern (HubSpot):**
> When updating the `lifecyclestage` property, you can only set the value **forward** in the stage order. To set backward, first **clear** the existing value (manually or via workflow).

**Source:** `/websites/developers_hubspot` — "Update contacts > Lifecycle Stage Restrictions"

**Fix:**
- Workflow `deal-default-122237508` (Assessment Confirmed): Change action from `1184339785` to `opportunity`.
- Use **internal name** `opportunity`, not numeric ID.

---

## 3. HubSpot Deal Create/Update with Value & Currency

**Issue:** HubSpot CAPI sends 0 AED; deals need correct amount and currency.

**Context7 Pattern (HubSpot):**
```json
{
  "properties": {
    "amount": "1500.00",
    "closedate": "2019-12-07T16:50:06.678Z",
    "dealname": "New deal",
    "dealstage": "contractsent",
    "pipeline": "default"
  }
}
```

**Currency:** Set company currency via `PUT /settings/v3/currencies/company-currency` with `{"currencyCode": "AED"}`.

**Source:** `/websites/developers_hubspot` — "Create Deal with Properties", "Currencies API"

---

## 4. Meta CAPI: user_data Format (em, ph, fbc, fbp)

**Issue:** CAPI user data null; DT Lead / Meta Lead read WooCommerce fields.

**Context7 + Web Search Pattern:**
- **em, ph:** SHA256 hashed (lowercase, trimmed). Meta Parameter Builder Libraries handle this.
- **fbc, fbp:** Plain text, NOT hashed. From `_fbc` and `_fbp` cookies.
- **fbc:** Only when `fbclid` exists in URL — do not fabricate.
- **fbp:** From `_fbp` cookie; format `fb.{version}.{timestamp}`.

**Source:** developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters

---

## 5. Cloudflare Worker: Purchase Webhook

**Issue:** Need server-side webhook to receive HubSpot Closed Won → forward to Meta CAPI.

**Context7 Pattern (Cloudflare):**
```typescript
// 1. Enforce POST
if (request.method !== "POST") {
  return new Response("Method not allowed", { status: 405 });
}

// 2. Verify signature (HMAC-SHA256)
const { valid, body } = await verifyWebhookSignature(request, env.WEBHOOK_SECRET);
if (!valid) return new Response("Invalid signature", { status: 403 });

// 3. Parse JSON
const payload = JSON.parse(body);

// 4. Process and respond
return new Response("OK", { status: 200 });
```

**Source:** `/cloudflare/cloudflare-docs` — "TypeScript Webhook Handler for Cloudflare Worker"

---

## 6. Supabase Edge Function: Error Handling

**Issue:** Edge functions must return consistent error shape (500 + JSON).

**Context7 Pattern (Supabase):**
```typescript
Deno.serve(async (req) => {
  try {
    const result = await processRequest(req);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
```

**Source:** `/supabase/supabase` — "Handle Server-Side Errors in Supabase Edge Function"

---

## 7. PostgreSQL: NULL Handling in WHERE

**Issue:** Cancel filter; nullable columns in queries.

**Context7 Pattern (PostgreSQL):**
```sql
-- COALESCE for display fallback
SELECT COALESCE(description, short_description, '(none)') ...

-- Safe null comparison in WHERE
WHERE key IS NOT DISTINCT FROM quote_nullable(keyvalue)
```

**Source:** `/websites/postgresql` — "Handling Nulls in WHERE Clause with IS NOT DISTINCT FROM"

---

## 8. Supabase: Webhook → External API

**Issue:** Receive webhook, validate, forward to external API.

**Context7 Pattern (Supabase):**
- Use `standardwebhooks` for verification.
- `req.method !== "POST"` → 400.
- Parse `await req.text()`, verify with `wh.verify(payload, headers)`.
- On error: `return new Response(JSON.stringify({ error: {...} }), { status: 401, headers: { "Content-Type": "application/json" } })`.

**Source:** `/supabase/supabase` — "Implement Supabase Auth Email Hook with Resend"

---

## 9. GTM: Custom Event + Variables

**Issue:** Need `{{CJS Lead Value}}`, `{{CJS Predicted LTV}}`, `location_tier`.

**Context7 Pattern (GTM):**
- **Custom Event trigger:** Event name = `lead_submitted`.
- **Data Layer Variable:** `form_data.lead_value`, `form_data.location_tier`.
- **CJS Variable:** Compute from URL regex → tier → value (200/400/600/800).

**Source:** `/websites/developers_google_tag-platform` — "Send a Custom Event with dataLayer.push()"

---

## 10. HubSpot Workflow: Custom Action → Webhook

**Issue:** Trigger Cloudflare Worker on Deal Closed Won.

**Context7 Pattern (HubSpot):**
- Custom workflow action with `actionUrl` = Cloudflare Worker URL.
- `objectRequestOptions.properties`: `amount`, `closedate`, `dealname`, contact `email`, `phone`, `hs_analytics_source_data_2` (fbc/fbp if stored).

**Source:** `/websites/developers_hubspot` — "POST /api/v3/workflows/actions/custom"

---

## Execution Order (Context7-Verified)

| Step | Action | Library |
|------|--------|---------|
| 1 | GTM: dataLayer.push on /thank-you + Custom Event trigger | GTM |
| 2 | HubSpot: Assessment Confirmed → `opportunity` | HubSpot |
| 3 | GTM: GA4 value → `{{CJS Lead Value}}` | GTM |
| 4 | GTM: CAPI user_data → `form_data.*` | Meta CAPI |
| 5 | Cloudflare Worker: Purchase webhook + signature verify | Cloudflare |
| 6 | HubSpot: Custom workflow action → Worker URL on Closed Won | HubSpot |

---

*All solutions sourced from Context7 MCP `query-docs` except Meta CAPI (web search).*
