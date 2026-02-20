# Live API Services Report

**Generated:** 2026-02-19  
**Production URL:** https://client-vital-suite-milos-projects-d46729ec.vercel.app  
**Domain:** client-vital-suite.vercel.app

---

## Executive Summary

| Status | Count | Notes |
|--------|-------|------|
| 401 Unauthorized | ~50+ req/hour | `/api/brain`, `/api/threads`, `/api/health`, `/api/system-check` |
| 400 Bad Request | ~20+ req/day | `/api/brain` (missing/invalid action) |
| 500 Server Error | 12 (06:53–06:58) | `ERR_MODULE_NOT_FOUND` on `/api/brain` |
| 200 OK | 1 | `/api/health` (when auth bypassed) |

**Root cause:** `PTD_INTERNAL_ACCESS_KEY` is set in production. All API routes that use `checkAuth()` or inline auth require the `x-ptd-key` header. The frontend does **not** send this header for most calls (BrainVisualizer, GlobalBrain, etc.), so requests fail with 401.

---

## 1. Vercel API Routes — Live Status

| Endpoint | Auth Required | Last 1h Status | Notes |
|----------|---------------|----------------|-------|
| `/api/health` | No | 200 (when bypassed) | No auth in code; 401 from Vercel deployment protection |
| `/api/brain` | Yes (x-ptd-key) | 401 majority | BrainVisualizer polls every 30s → 2 req/min = 120/hr |
| `/api/threads` | Yes (checkAuth) | 401 | GlobalBrain page — load/create threads |
| `/api/query` | Yes (checkAuth) | 401 | GlobalBrain — submit question |
| `/api/system-check` | Yes | 401 | |
| `/api/agent` | Varies | — | FloatingChat, PTDControlChat, etc. |
| `/api/memory` | — | — | serverMemory.ts |
| `/api/session` | — | — | serverMemory.ts |
| `/api/user-memory` | — | — | permanentMemory.ts |
| `/api/events`, `/api/events/batch` | — | — | Meta CAPI |
| `/api/stripe/*` | — | — | Proxies to Supabase EF |
| `/api/hubspot` | — | — | Proxies to Supabase EF |
| `/api/intelligence` | — | — | Proxies to Supabase EF |

---

## 2. Runtime Logs (Last 24h)

### Error-level (500, 400)

- **06:53–06:58** — 12× `ERR_MODULE_NOT_FOUND` on `/api/brain` (500)
- **00:00–06:58** — Multiple 400 on `/api/brain` (DEP0169 punycode deprecation)
- **304** — Some cached responses (not errors)

### 401 Flood (Last 1h)

- `/api/brain` — ~40+ requests
- `/api/health` — ~10
- `/api/system-check` — ~10
- `/api/threads` — ~2

---

## 3. Frontend → API Wiring Gaps

| Component | File | Calls | Header Sent? | Result |
|-----------|------|-------|--------------|--------|
| BrainVisualizer | `src/components/BrainVisualizer.tsx` | `/api/brain?action=recent`, `action=stats` | No | 401 |
| GlobalBrain | `src/pages/GlobalBrain.tsx` | `/api/brain`, `/api/query` | No | 401 |
| GlobalBrainPage | `src/app/global-brain/page.tsx` | `/api/threads`, `/api/query` | No | 401 |
| FloatingChat | `src/components/FloatingChat.tsx` | `/api/agent` | getAuthHeaders (anon) | Depends |
| PTDControlChat | `src/components/ai/PTDControlChat.tsx` | `/api/agent` | Hardcoded x-ptd-key | Works |
| VoiceChat | `src/components/ai/VoiceChat.tsx` | `/api/agent` | Hardcoded x-ptd-key | Works |
| AIAssistantPanel | `src/components/ai/AIAssistantPanel.tsx` | `/api/agent` | Hardcoded x-ptd-key | Works |

**Fix:** Add `x-ptd-key` (from `import.meta.env.VITE_PTD_INTERNAL_ACCESS_KEY`) to all fetch calls in BrainVisualizer, GlobalBrain, and global-brain/page.tsx. Do NOT hardcode the key — use env var.

---

## 4. Supabase Edge Functions (Not Directly Tested)

These are invoked via `supabase.functions.invoke()` with the Supabase anon key (from `getAuthHeaders` or session). They do **not** go through Vercel API routes.

| Function | Used By | Status |
|----------|---------|--------|
| stripe-dashboard-data | RevenueIntelligence, StripeDashboardTab | Supabase auth |
| stripe-payouts-ai | StripeAIDashboard | Supabase auth |
| hubspot-live-query | TodaysActivity, PipelineHealth, etc. | Supabase auth |
| sync-hubspot-to-supabase | SyncStatusBadge, DashboardTab | Supabase auth |
| ai-ceo-master | use-ceo-data | Supabase auth |
| ptd-24x7-monitor | WarRoom | Supabase auth |
| business-intelligence | QuickActionsPanel, etc. | Supabase auth |
| ... (40+ total) | Various dashboards | Supabase auth |

**Note:** Supabase Edge Functions use the Supabase anon key from the client. They are not affected by `PTD_INTERNAL_ACCESS_KEY`. Status would need to be verified via Supabase dashboard or direct invoke tests.

---

## 5. Recommended Fixes (Priority)

1. **P0 — Brain/Threads/Query auth**
   - Add `x-ptd-key` to `BrainVisualizer`, `GlobalBrain` page, and any component calling `/api/brain`, `/api/threads`, `/api/query`.
   - Expose key via `VITE_PTD_INTERNAL_ACCESS_KEY` (or server-side proxy) if browser must call these.

2. **P1 — Health endpoint**
   - Confirm whether 401 is from Vercel deployment protection or route-level auth. If deployment protection, document that external health checks need Vercel auth.

3. **P2 — Brain polling**
   - Implement exponential backoff in BrainVisualizer (already planned) to reduce 401 volume when auth is broken.

4. **P3 — DEP0169**
   - Punycode deprecation comes from `@supabase/supabase-js`. Track upstream fix; treat as warning only.

---

## 6. How to Re-run Live Check

```bash
# With PTD key (if set)
curl -H "x-ptd-key: $PTD_INTERNAL_ACCESS_KEY" \
  https://client-vital-suite-milos-projects-d46729ec.vercel.app/api/health

curl -H "x-ptd-key: $PTD_INTERNAL_ACCESS_KEY" \
  "https://client-vital-suite-milos-projects-d46729ec.vercel.app/api/brain?action=stats"

# Vercel runtime logs
# Use MCP: mcp_vercel_get_runtime_logs with projectId, teamId
```
