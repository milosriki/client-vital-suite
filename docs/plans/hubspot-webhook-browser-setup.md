# HubSpot Webhook — Complete Setup Playbook

> **For:** Antigravity `browser_subagent` + developer (code fixes)
> **Date:** 2026-02-15
> **Estimated time:** 15-20 minutes (browser) + 30 min (code fixes)
> **Risk:** MEDIUM — requires both UI changes AND code deployment

---

## EXECUTIVE SUMMARY — What Was Wrong

The original instructions covered only the webhook URL change. Research uncovered **12 additional issues** that must be fixed for webhooks to actually work:

| # | Issue | Severity | Type |
|---|-------|----------|------|
| 1 | Target URL points to broken handler | CRITICAL | Browser (HubSpot UI) |
| 2 | `hubspot-webhook-receiver` missing from `config.toml` — Supabase rejects ALL requests with 401 | **CRITICAL BLOCKER** | Code fix |
| 3 | `HUBSPOT_CLIENT_SECRET` not set — anyone can send fake webhook events | CRITICAL | Environment variable |
| 4 | `manual_link_deal_contact` RPC doesn't exist in database — deal linking will fail | HIGH | SQL migration |
| 5 | `return;` instead of `continue;` in WhatsApp branch — drops remaining events in batch | HIGH | Code fix |
| 6 | No per-event try/catch — one bad event kills entire batch | HIGH | Code fix |
| 7 | Signature verification uses deprecated V1 (no replay protection) | HIGH | Code fix |
| 8 | Missing 2 webhook subscriptions (deal association, call creation) | MEDIUM | Browser (HubSpot UI) |
| 9 | Required scopes may not all be enabled | MEDIUM | Browser (HubSpot UI) |
| 10 | No `eventId` deduplication — duplicate events cause duplicate processing | MEDIUM | Code fix (future) |
| 11 | Synchronous processing risks HubSpot's 5-second timeout | MEDIUM | Architecture (future) |
| 12 | `HUBSPOT_ACCESS_TOKEN` vs `HUBSPOT_API_KEY` naming inconsistency | LOW | Environment variable |

---

## EXECUTION ORDER

```
PHASE 1: Code Fixes (MUST do BEFORE changing webhook URL)
  ├── 1A: Add hubspot-webhook-receiver to config.toml (BLOCKER)
  ├── 1B: Create manual_link_deal_contact RPC migration
  ├── 1C: Fix return → continue in receiver
  ├── 1D: Add per-event try/catch in receiver
  └── 1E: Deploy: supabase functions deploy hubspot-webhook-receiver && supabase db push

PHASE 2: Environment Variables
  ├── 2A: Set HUBSPOT_CLIENT_SECRET in Supabase
  └── 2B: Verify HUBSPOT_API_KEY is set

PHASE 3: Browser — HubSpot UI (Antigravity browser_subagent)
  ├── 3A: Verify required scopes on Scopes tab
  ├── 3B: Change webhook Target URL
  ├── 3C: Add 2 new event subscriptions
  ├── 3D: Copy Client Secret from Auth tab
  └── 3E: Verify changes persisted

PHASE 4: Verification
  ├── 4A: Wait 5 minutes (HubSpot config propagation delay)
  ├── 4B: Test with contact edit
  └── 4C: Check Supabase edge function logs
```

**DO NOT change the webhook URL (Phase 3B) until Phase 1 code fixes are deployed. Otherwise HubSpot will send events to the new URL, Supabase will reject them all with 401, and HubSpot will retry 10 times over 24 hours — flooding your endpoint.**

---

# PHASE 1: Code Fixes (Developer — Before Browser Steps)

## 1A: Add `hubspot-webhook-receiver` to `config.toml`

**Why this is critical:** Supabase Edge Functions default to `verify_jwt = true`. HubSpot cannot provide a Supabase JWT. Without this entry, every webhook request gets rejected with 401 by the Supabase gateway **before your code even runs**. The old `hubspot-webhook` already has this configured at line 252 of `config.toml`.

**File:** `supabase/config.toml`

**Add after the existing `hubspot-webhook` entry (around line 254):**
```toml
[functions.hubspot-webhook-receiver]
verify_jwt = false
```

---

## 1B: Create `manual_link_deal_contact` RPC

**Why:** The receiver calls `supabase.rpc("manual_link_deal_contact", {...})` on line 85 for `deal.associationChange` events. **This function does not exist in any migration.** Every deal association webhook will fail silently.

**Create migration file:** `supabase/migrations/20260215_manual_link_deal_contact.sql`

```sql
-- Links a HubSpot deal to its contact via HubSpot IDs
-- Called by hubspot-webhook-receiver on deal.associationChange events
CREATE OR REPLACE FUNCTION public.manual_link_deal_contact(
  p_deal_id TEXT,
  p_contact_id TEXT
) RETURNS void AS $$
BEGIN
  UPDATE deals
  SET contact_id = c.id,
      updated_at = NOW()
  FROM contacts c
  WHERE deals.hubspot_deal_id = p_deal_id
    AND c.hubspot_contact_id = p_contact_id
    AND (deals.contact_id IS NULL OR deals.contact_id != c.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 1C: Fix `return;` → `continue;` in WhatsApp Branch

**Why:** Lines 110, 134, and 183 use `return;` inside a `for` loop. When any of these trigger, the function exits immediately — **dropping all remaining events in the batch**. HubSpot sends up to 100 events per batch. If event #3 is a WhatsApp message with missing API key, events #4-100 are silently lost.

**File:** `supabase/functions/hubspot-webhook-receiver/index.ts`

| Line | Current | Fix |
|------|---------|-----|
| 110 | `return;` | `continue;` |
| 134 | `return;` | `continue;` |
| 183 | `return;` | `continue;` |

---

## 1D: Add Per-Event Try/Catch

**Why:** Currently, if ONE event in a batch throws an unhandled error (e.g., deal association fails because contact doesn't exist), the entire batch fails with 500. HubSpot retries the entire batch, including events that already succeeded — causing duplicate processing.

**File:** `supabase/functions/hubspot-webhook-receiver/index.ts`

**Wrap the `for` loop body (lines 44-240) in a try/catch:**

```typescript
for (const event of events) {
  try {
    const { subscriptionType, objectId, propertyName, propertyValue } = event;
    console.log(`Processing ${subscriptionType} for object ${objectId}`);

    // ... existing event handling code ...

  } catch (eventError: unknown) {
    console.error(`❌ Error processing event ${event.eventId || 'unknown'}:`, eventError);
    // Continue processing remaining events — don't kill the batch
  }
}
```

---

## 1E: Deploy Code Fixes

```bash
# 1. Deploy the edge function with config.toml fix
supabase functions deploy hubspot-webhook-receiver

# 2. Push the migration
supabase db push

# 3. Verify the RPC exists
supabase db execute "SELECT proname FROM pg_proc WHERE proname = 'manual_link_deal_contact';"
```

---

# PHASE 2: Environment Variables

## 2A: Set `HUBSPOT_CLIENT_SECRET`

**Why:** Without this, signature verification is skipped entirely (line 30-39 of receiver). Anyone who knows your Supabase function URL can send fake webhook events. The secret is found in HubSpot UI under the private app's **Auth** tab.

**Where to find it:** Phase 3D below (browser step) will copy it from HubSpot.

**Where to set it:** Supabase Dashboard → Project Settings → Edge Functions → Secrets
```
HUBSPOT_CLIENT_SECRET = <value from HubSpot Auth tab>
```

**Alternative (CLI):**
```bash
supabase secrets set HUBSPOT_CLIENT_SECRET=<value>
```

## 2B: Verify `HUBSPOT_API_KEY` Is Set

The receiver uses this for WhatsApp conversations (line 106). Some other functions use `HUBSPOT_ACCESS_TOKEN`. Both should be set to the same private app access token value.

```bash
# Check if set
supabase secrets list | grep HUBSPOT
```

---

# PHASE 3: Browser Steps — HubSpot UI (Antigravity `browser_subagent`)

> **Prerequisites:**
> - Logged into HubSpot (Portal ID: `7973797`)
> - Admin or Super Admin access
> - Phase 1 code fixes DEPLOYED

---

## STEP 3A: Verify Required Scopes

**Navigate to:**
```
https://app.hubspot.com/private-apps/7973797/14692628
```

**Click the "Scopes" tab.**

**Verify ALL of these scopes are enabled (checked) and marked as "Required":**

| Scope | Needed For | Priority |
|-------|-----------|----------|
| `crm.objects.contacts.read` | Contact sync (webhook + backfill) | REQUIRED |
| `crm.objects.contacts.write` | Health score updates, contact modifications | REQUIRED |
| `crm.objects.deals.read` | Deal sync (webhook + backfill) | REQUIRED |
| `crm.objects.deals.write` | Deal updates | RECOMMENDED |
| `crm.objects.calls.read` | Call sync (new webhook subscription) | REQUIRED |
| `crm.objects.calls.write` | CallGear call creation | REQUIRED |
| `crm.objects.owners.read` | Owner/coach mapping in sync functions | REQUIRED |
| `crm.objects.notes.read` | Note fetching in hubspot-manager | RECOMMENDED |
| `crm.objects.notes.write` | Note creation | RECOMMENDED |
| `crm.objects.tasks.write` | Task creation | RECOMMENDED |
| `crm.objects.meetings.read` | Meeting sync | RECOMMENDED |
| `conversations.read` | WhatsApp thread/message fetching | REQUIRED (for WhatsApp) |
| `conversations.write` | WhatsApp AI replies | REQUIRED (for WhatsApp) |

**Critical:** Scopes must be marked **"Required"** (not just "Optional") for webhook event subscriptions to work. If any REQUIRED scope above is missing, add it.

**If you add new scopes:** The private app access token may need to be regenerated. If so, update `HUBSPOT_API_KEY` and `HUBSPOT_ACCESS_TOKEN` in Supabase secrets.

**Verification:** Take screenshot of Scopes tab showing all checked scopes.

---

## STEP 3B: Navigate to Webhooks Tab

**Click the "Webhooks" tab** in the private app settings.

**Expected result:** Webhook configuration panel showing:
- A **Target URL** field
- A **Max concurrent requests** setting (should show `10`)
- A list of **event subscriptions**

**Verification:** Take screenshot showing the current Target URL and all settings.

---

## STEP 3C: Change the Target URL

**Current (BROKEN) value:**
```
https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/hubspot-webhook
```

**New (CORRECT) value:**
```
https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/hubspot-webhook-receiver
```

**Action:**
1. Click on the Target URL input field
2. Select all text (Ctrl+A / Cmd+A)
3. Delete the selected text
4. Type or paste exactly: `https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/hubspot-webhook-receiver`
5. Click **Save**

**The ONLY difference is the suffix:**
- OLD: `hubspot-webhook`
- NEW: `hubspot-webhook-receiver`

**Leave "Max concurrent requests" at 10** (this is the default and HubSpot's per-private-app limit).

**Verification:** Take screenshot of URL field after save. Verify it ends with `-receiver`.

---

## STEP 3D: Copy Client Secret from Auth Tab

**Navigate to the "Auth" tab** of the private app.

**Look for:** A field labeled "Client secret" or "App secret" with a "Show secret" or "Copy" button.

**Action:**
1. Click "Show secret" (or equivalent)
2. Copy the secret value (UUID format like `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy`)
3. **Save this value** — it needs to be set as `HUBSPOT_CLIENT_SECRET` in Supabase (Phase 2A)

**Verification:** Take screenshot showing the secret exists (redact the actual value in screenshots).

---

## STEP 3E: Review Existing Event Subscriptions

**Go back to the "Webhooks" tab.**

**Current subscriptions (7 total) — these should already exist:**

| # | Object Type | Event Type | Property |
|---|-------------|------------|----------|
| 1 | Contact | Property change | `lifecyclestage` |
| 2 | Contact | Creation | — |
| 3 | Contact | Merge | — |
| 4 | Contact | Association change | — |
| 5 | Contact | Property change | `callback_scheduled_time` |
| 6 | Deal | Creation | — |
| 7 | Deal | Property change | `dealstage` |

**Verification:** Scroll through and verify all 7 exist. Take screenshot.

---

## STEP 3F: Add New Subscription — Deal Association Change

**Action:** Click "Create subscription" or "Add subscription" button.

**Configure:**
- **Object type:** `Deal`
- **Event type:** `Association change`

**Steps:**
1. Click create/add subscription button
2. Select object type: **Deal**
3. Select event type: **Association change**
4. Save

**What this does:** When a deal gets linked to a contact in HubSpot, this triggers the receiver which calls `manual_link_deal_contact` RPC (created in Phase 1B) to auto-link the deal in Supabase.

**Verification:** Take screenshot showing new subscription in list.

---

## STEP 3G: Add New Subscription — Call Creation

**Action:** Click "Create subscription" button again.

**Configure:**
- **Object type:** `Call` (may appear as "Calls" or under "Engagements")
- **Event type:** `Creation`

**Steps:**
1. Click create/add subscription button
2. Select object type: **Call**
3. Select event type: **Creation**
4. Save

**Note:** If "Call" is not available as an object type, this requires the `crm.objects.calls.read` scope (Step 3A). If the scope is enabled and Call still isn't available, skip — it's nice-to-have.

**Verification:** Take screenshot showing both new subscriptions.

---

## STEP 3H: Verify Final State

**Expected: 9 subscriptions total (or 8 if Call wasn't available)**

| # | Object Type | Event Type | Property | Handler |
|---|-------------|------------|----------|---------|
| 1 | Contact | Property change | `lifecyclestage` | sync-single-contact |
| 2 | Contact | Creation | — | sync-single-contact |
| 3 | Contact | Merge | — | (ignored) |
| 4 | Contact | Association change | — | (ignored) |
| 5 | Contact | Property change | `callback_scheduled_time` | sync-single-contact |
| 6 | Deal | Creation | — | sync-single-deal |
| 7 | Deal | Property change | `dealstage` | celebration log |
| 8 | **Deal** | **Association change** | — | **manual_link_deal_contact RPC** |
| 9 | **Call** | **Creation** | — | **sync-single-call** |

**Save all changes if there's a final Save button.**

**Verify persistence:** Navigate to a different tab ("Basic info"), then back to "Webhooks". Confirm URL and subscriptions are still correct.

**Take final screenshot.**

---

# PHASE 4: Verification

## 4A: Wait for Propagation

**HubSpot caches webhook configuration for up to 5 minutes.** After making changes, wait at least 5 minutes before testing.

---

## 4B: Test With Contact Edit

**In HubSpot UI:**
1. Navigate to: `https://app.hubspot.com/contacts/7973797`
2. Open any contact
3. Change any property (e.g., edit phone number, add a note)
4. Save

**This fires `contact.propertyChange` → `hubspot-webhook-receiver` → `sync-single-contact`**

---

## 4C: Check Supabase Edge Function Logs

**Navigate to:** Supabase Dashboard → Edge Functions → `hubspot-webhook-receiver` → Logs

**Expected log entries:**
```
[HubSpot Webhook] Received 1 events
Processing contact.propertyChange for object 12345
Triggering sync for contact 12345
```

**If you see these → webhook is working.**

**If you see nothing:**
- Wait another 5 minutes (propagation delay)
- Check that `verify_jwt = false` is deployed in config.toml (Phase 1A)
- Check HubSpot → Private App → Webhooks → look for failed deliveries

**If you see 401 errors:**
- `config.toml` entry is missing (Phase 1A not deployed)

**If you see "Invalid HubSpot Signature" / 401:**
- `HUBSPOT_CLIENT_SECRET` is set to the wrong value
- Compare with the secret from Phase 3D

**If you see "HUBSPOT_CLIENT_SECRET not set - Signature verification skipped":**
- Phase 2A not done yet. Set the secret in Supabase.

---

# HubSpot Webhook Technical Reference

## Behavior You Must Know

| Setting | Value | Notes |
|---------|-------|-------|
| **Response timeout** | **5 seconds** | Must respond 200 within 5s or HubSpot retries |
| **Max events per batch** | **100** | Receiver gets array of up to 100 events per POST |
| **Concurrent requests** | **10** (per app) | Max 10 in-flight POSTs simultaneously |
| **Retry policy** | **10 retries over 24 hours** | Only on 5xx/timeout. 4xx = permanent failure (no retry) |
| **No-retry status codes** | 400, 401, 403, 404, 405 | These stop retries permanently |
| **Config propagation** | **Up to 5 minutes** | Changes don't take effect immediately |
| **Subscription limit** | 1,000 per app | Currently using 9 of 1,000 |
| **Signature version** | V1 (current code) | Should upgrade to V3 for replay protection |

## Signature Verification Versions

| Version | Algorithm | Header | Output | Replay Protection |
|---------|-----------|--------|--------|-------------------|
| **V1** (current) | SHA-256(secret + body) | `X-HubSpot-Signature` | Hex | NO |
| V2 | SHA-256(secret + method + URI + body) | `X-HubSpot-Signature` v2 | Hex | NO |
| **V3** (recommended) | HMAC-SHA256(secret, method + URI + body + timestamp) | `X-HubSpot-Signature-v3` | Base64 | YES (5-min window) |

---

## Identifiers

| Item | Value |
|------|-------|
| Private App ID | `14692628` |
| Portal ID | `7973797` |
| Supabase Project | `ztjndilxurtsfqdsvfds` |
| Receiver function | `supabase/functions/hubspot-webhook-receiver/index.ts` |
| Verifier | `supabase/functions/_shared/hubspot-verifier.ts` |
| Config | `supabase/config.toml` (line ~254) |

---

## Rollback Plan

If the new webhook causes issues:

1. **HubSpot UI:** Change Target URL back to `hubspot-webhook` (old handler)
2. **HubSpot UI:** Remove Deal Association Change + Call Creation subscriptions
3. **Code:** No code rollback needed — config.toml and migration are additive

---

## Future Improvements (Not Required Now)

| Priority | Improvement | Why |
|----------|------------|-----|
| HIGH | Upgrade signature verification to V3 (HMAC + timestamp) | Prevents replay attacks |
| HIGH | Add `eventId` deduplication table | Prevents duplicate event processing |
| MEDIUM | Move all processing to `EdgeRuntime.waitUntil()` | Ensures <5s response time under heavy load |
| MEDIUM | Handle `deal.propertyChange` (not just dealstage log) | Full deal sync on any property change |
| LOW | Handle `contact.deletion` / `deal.deletion` | Clean up stale records |
| LOW | Handle `contact.merge` | Merge contacts in Supabase when merged in HubSpot |
| LOW | Add Zod schema validation on webhook payload | Type safety for incoming events |
