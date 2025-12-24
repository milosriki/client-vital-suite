# 📊 DATA UNIFICATION & API CALL ANALYSIS

**Generated**: December 24, 2025  
**Purpose**: Map all data sources, API calls, hardcoded data, and create unified access strategy

---

## 🔍 CURRENT STATE ANALYSIS

### 1. **HubSpot Analyzer - HARDCODED DATA FOUND** ⚠️

**File**: `src/pages/HubSpotAnalyzer.tsx`

**Hardcoded Metrics** (Lines 14-29):

```typescript
const criticalMetrics = {
  totalWorkflows: 201, // ❌ HARDCODED
  activeWorkflows: 52, // ❌ HARDCODED
  inactiveWorkflows: 149, // ❌ HARDCODED
  totalProperties: 1990, // ❌ HARDCODED
  contactProperties: 729, // ❌ HARDCODED
  dealProperties: 505, // ❌ HARDCODED
  revenueAtRisk: 575000, // ❌ HARDCODED
  monthlyRevenueLoss: 634070, // ❌ HARDCODED
  buriedPremiumLeads: 275000, // ❌ HARDCODED
  potentialRecovery: 1200000, // ❌ HARDCODED
  slaBreachRate: 100, // ❌ HARDCODED
  blankLeadPercentage: 20, // ❌ HARDCODED
};
```

**Recommendation**: Replace with LIVE API calls to HubSpot Workflows API + Analytics

---

## 📡 API CALLS MAPPING

### **HubSpot API Calls**

| Component                  | Current API Endpoint                         | Data Fetched                           | Status    |
| -------------------------- | -------------------------------------------- | -------------------------------------- | --------- |
| `HubSpotCommandCenter.tsx` | `hubspot-command-center` Edge Function       | User activity, security events, logins | ✅ LIVE   |
| `HubSpotAnalyzer.tsx`      | ❌ None (hardcoded)                          | Workflows, properties, metrics         | ❌ STATIC |
| `HubSpotLiveData.tsx`      | Supabase `contacts`, `call_records`, `staff` | Contacts, calls, leads                 | ✅ LIVE   |
| `SalesPipeline.tsx`        | `sync-hubspot-to-supabase`                   | Contacts, deals, leads                 | ✅ LIVE   |
| `api/hubspot.ts`           | Routes to multiple Edge Functions            | Engagements, contacts, search          | ✅ LIVE   |

**HubSpot Edge Functions**:

- `hubspot-command-center` - Security & user activity
- `sync-hubspot-to-supabase` - Full CRM sync
- `fetch-hubspot-live` - Real-time data
- `reassign-owner` - Owner reassignment

**HubSpot API Routes** (from `supabase/functions/_shared/hubspot-sync-manager.ts`):

- `/crm/v3/objects/contacts` - Contact properties
- `/crm/v3/objects/deals` - Deal properties
- `/crm/v3/engagements/calls` - Call engagements (includes CallGear data)
- `/crm/v3/owners` - Owner/user data
- `/automation/v4/workflows` - Workflow data (⚠️ NOT CURRENTLY USED)

---

### **CallGear API Calls**

| Component            | Edge Function                                | Data Fetched                        | Status  |
| -------------------- | -------------------------------------------- | ----------------------------------- | ------- |
| Call tracking system | `fetch-callgear-data`                        | Call records, durations, recordings | ✅ LIVE |
| CallGear monitoring  | `callgear-sentinel`, `callgear-live-monitor` | Real-time call monitoring           | ✅ LIVE |
| CallGear supervisor  | `callgear-supervisor`                        | Call quality, supervisor data       | ✅ LIVE |

**CallGear API Endpoint**: `https://dataapi.callgear.com/v2.0` (JSON-RPC)

**CallGear → HubSpot Integration**:

- CallGear pushes call data to HubSpot via native integration
- HubSpot stores CallGear data as custom properties on call engagements
- Properties: `full_talk_record_link`, `total_talk_duration`, `call_finish_reason`, etc.

---

### **Stripe API Calls**

| Component                | Edge Function          | Data Fetched                 | Status  |
| ------------------------ | ---------------------- | ---------------------------- | ------- |
| `StripeIntelligence.tsx` | `stripe-payouts-ai`    | Payment analysis, chat       | ✅ LIVE |
| `StripeAIDashboard.tsx`  | `stripe-payouts-ai`    | Payout data, AI chat         | ✅ LIVE |
| Stripe forensics scripts | Direct Stripe REST API | Refunds, transfers, accounts | ✅ LIVE |

**Stripe Functions**:

- `stripe-dashboard-data` - Balance, metrics, payments
- `stripe-payouts-ai` - AI-powered analysis
- `stripe-payout-controls` - Payout management
- `stripe-history` - Historical data
- `stripe-find-charges` - Charge search
- `enrich-with-stripe` - Enrich contacts with payment data

---

## 🔄 DATA FLOW & UNIFICATION

### **Current Architecture**

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  CallGear   │────────▶│  HubSpot    │────────▶│  Supabase   │
│  (Calls)    │         │   (CRM)     │         │  (Central)  │
└─────────────┘         └─────────────┘         └─────────────┘
                              │                         ▲
                              │                         │
                        ┌─────────────┐                 │
                        │   Stripe    │─────────────────┘
                        │ (Payments)  │
                        └─────────────┘
```

**Data Priority** (from `src/lib/unified-data-schema.ts`):

1. **Attribution**: AnyTrack > HubSpot > Facebook
2. **PII (Contact Data)**: HubSpot > AnyTrack > Facebook
3. **Conversion**: HubSpot deals.closed_won is source of truth
4. **Call Data**: CallGear → HubSpot → Supabase
5. **Payment Data**: Stripe → Supabase

### **Unified Data Tables** (Supabase)

| Table                        | Source             | Purpose          |
| ---------------------------- | ------------------ | ---------------- |
| `contacts`                   | HubSpot            | Contact CRM data |
| `deals`                      | HubSpot            | Deal pipeline    |
| `call_records`               | CallGear → HubSpot | Call history     |
| `contact_activities`         | HubSpot            | Activity log     |
| `sync_queue`                 | Internal           | Sync tracking    |
| `hubspot_audit_log_logins`   | HubSpot            | Security audit   |
| `hubspot_audit_log_security` | HubSpot            | Security events  |
| `daily_summaries`            | Aggregated         | Daily metrics    |

---

## 🎯 UNIFIED API CALL STRATEGY

### **Problem**: Duplicated API Calls Across Dashboards

**Current Issues**:

- Multiple components fetch same HubSpot data independently
- No centralized cache for cross-platform data
- HubSpot Analyzer uses static/hardcoded data
- Chat AI cannot access unified context (CallGear + HubSpot + Stripe)

### **Solution**: Unified Data Service Layer

Create `/api/unified-data.ts` that:

1. Fetches data from **all sources** (HubSpot, CallGear, Stripe)
2. **Caches results** to avoid duplicate API calls
3. **Enriches data** across platforms (e.g., contact + calls + payments)
4. Provides **single endpoint** for dashboards and AI chat

---

## 🚀 IMPLEMENTATION PLAN

### **Phase 1: Fix HubSpot Analyzer (PRIORITY 1)**

**Replace hardcoded data with LIVE API calls**:

1. **Fetch Workflows** from HubSpot API:

   ```typescript
   // GET /automation/v4/workflows
   const workflows = await fetchHubSpotWorkflows();
   const totalWorkflows = workflows.length;
   const activeWorkflows = workflows.filter((w) => w.enabled).length;
   ```

2. **Fetch Properties** from HubSpot API:

   ```typescript
   // GET /crm/v3/properties/contacts
   // GET /crm/v3/properties/deals
   const properties = await fetchHubSpotProperties();
   ```

3. **Calculate Metrics** from Supabase data:
   ```typescript
   // Query Supabase for revenue, lead metrics
   const metrics = await calculateRevenue AtRisk();
   ```

**Action**: Create new Edge Function `hubspot-workflow-analyzer`

---

### **Phase 2: Unified Data API (PRIORITY 2)**

**Create** `/api/unified-data.ts`:

```typescript
/**
 * Unified Data API
 *
 * Actions:
 * - get_contact_360: Get contact with calls, deals, payments
 * - get_dashboard_data: Get all dashboard data (cached)
 * - get_chat_context: Get enriched context for AI chat
 * - search_unified: Search across all platforms
 */
```

**Example**: Get Contact 360 View

```typescript
POST /api/unified-data
{
  "action": "get_contact_360",
  "email": "john@example.com"
}

Response:
{
  "contact": { /* HubSpot contact data */ },
  "calls": [ /* CallGear call history */ ],
  "deals": [ /* HubSpot deals */ ],
  "payments": [ /* Stripe charges */ ],
  "activities": [ /* HubSpot activities */ ]
}
```

---

### **Phase 3: Smart Caching Layer (PRIORITY 3)**

**Implement Redis/Memory Cache**:

- Cache HubSpot data for 5 minutes
- Cache Stripe data for 10 minutes
- Cache CallGear data for 2 minutes
- Invalidate cache on updates

**Cache Keys**:

- `hubspot:contact:{email}`
- `callgear:calls:{phone}`
- `stripe:customer:{email}`
- `unified:dashboard:overview`

---

### **Phase 4: AI Chat Context Enrichment (PRIORITY 4)**

**Update AI Chat** to use unified data API:

```typescript
// Before (limited context):
const context = {
  balance: stripeData?.balance,
  metrics: stripeData?.metrics,
};

// After (unified context):
const context = await fetch("/api/unified-data", {
  method: "POST",
  body: JSON.stringify({
    action: "get_chat_context",
    timeframe: "last_30_days",
  }),
});

// Context now includes:
// - HubSpot contacts, deals, workflows
// - CallGear call analytics
// - Stripe payment data
// - Cross-platform correlations
```

**AI can now answer questions like**:

- "Show me all contacts with failed calls AND no payment"
- "Which HubSpot owner has the highest CallGear talk time?"
- "Correlate Stripe refunds with HubSpot deal losses"

---

## 📋 ACTION ITEMS SUMMARY

### **Immediate (This Week)**

- [ ] **Replace hardcoded data** in `HubSpotAnalyzer.tsx`
  - Create `hubspot-workflow-analyzer` Edge Function
  - Fetch workflows, properties, metrics from HubSpot API
  - Calculate revenue/lead metrics from Supabase

### **Short-term (Next Week)**

- [ ] **Create unified data API** (`/api/unified-data.ts`)

  - Implement `get_contact_360` action
  - Implement `get_dashboard_data` action
  - Implement `get_chat_context` action

- [ ] **Add caching layer**
  - Use React Query for client-side caching
  - Use Supabase edge function cache for server-side
  - Implement cache invalidation

### **Medium-term (Next 2 Weeks)**

- [ ] **Update all dashboards** to use unified API

  - Refactor `StripeIntelligence.tsx` to use unified context
  - Refactor `HubSpotLiveData.tsx` to use unified context
  - Refactor `Dashboard.tsx` to use unified context

- [ ] **Enhance AI chat** with unified context
  - Update `ptd-agent-gemini` to call unified API
  - Add cross-platform query capabilities
  - Test complex multi-source queries

---

## 🔐 SECURITY & BEST PRACTICES

### **API Key Management** ✅

All keys properly stored in environment variables:

- `HUBSPOT_ACCESS_TOKEN` - HubSpot API
- `CALLGEAR_API_KEY` - CallGear API
- `STRIPE_SECRET_KEY` - Stripe API
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin

### **Rate Limiting**

- HubSpot: 10,000 calls/day → Use caching aggressively
- CallGear: No published limit → Monitor usage
- Stripe: No strict limit → Be reasonable

### **Data Privacy**

- Never log PII in console/logs
- Use masked data in error messages
- Encrypt sensitive data in Supabase

---

## 📊 EXPECTED IMPROVEMENTS

### **Performance**

- ⚡ **50% fewer API calls** via unified caching
- ⚡ **Faster dashboards** via shared data fetching
- ⚡ **Reduced latency** via edge function caching

### **User Experience**

- 🎯 **Real-time HubSpot Analyzer** (no hardcoded data)
- 🎯 **Smarter AI chat** (cross-platform context)
- 🎯 **Unified search** (find data across all platforms)

### **Developer Experience**

- 🛠️ **Single data API** for all dashboards
- 🛠️ **Consistent data format** across components
- 🛠️ **Easier debugging** via centralized logging

---

## 🔗 RELATED FILES

- `src/lib/unified-data-schema.ts` - Data schema & priority rules
- `src/lib/prompts/ultimate-truth.ts` - Truth alignment prompt
- `supabase/functions/_shared/hubspot-sync-manager.ts` - HubSpot sync
- `supabase/functions/fetch-callgear-data/index.ts` - CallGear sync
- `api/hubspot.ts` - HubSpot Vercel API
- `api/stripe.ts` - Stripe Vercel API
- `docs/CALLGEAR_API_COMPLETE_GUIDE.md` - CallGear integration docs

---

**Status**: Ready for implementation  
**Next Step**: Create `hubspot-workflow-analyzer` Edge Function
