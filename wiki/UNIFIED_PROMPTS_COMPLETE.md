# ✅ Unified Prompt System - Complete Implementation

## Status: Core Components Created ✅

All prompt components have been created with **LIVE DATA ONLY** focus. No mock or test data.

---

## 📁 Files Created

### 1. **`src/lib/lead-lifecycle-mapping.ts`** ✅
- Complete HubSpot stage ID mappings
- 12-stage lead journey flow
- Helper functions: `formatDealStage()`, `formatLifecycleStage()`
- **LIVE DATA ONLY**: Queries contacts, deals, call_records tables

### 2. **`src/lib/unified-data-schema.ts`** ✅
- Single source of truth for all agents
- Standard field names (email, lifecycle_stage, deal_stage, etc.)
- Data priority rules (AnyTrack > HubSpot > Facebook for attribution)
- **LIVE DATA ONLY**: Defines which tables to query

### 3. **`src/lib/prompts/ultimate-truth.ts`** ✅
- Data alignment rules for Facebook CAPI, HubSpot, AnyTrack
- Event matching logic (email, phone, external_id, time window)
- Confidence scoring (0-100)
- **LIVE DATA ONLY**: Queries events, contacts, attribution_events, capi_events_enriched

### 4. **`src/lib/prompts/roi-managerial.ts`** ✅
- Unit economics formulas (LTV, CAC, Contribution Margin, Payback Period)
- Ad spend optimization ($40K/month context)
- Bleed detection and scale signals
- Managerial response format
- **LIVE DATA ONLY**: Queries Stripe, HubSpot, attribution_events

### 5. **`src/lib/unified-prompt-builder.ts`** ✅
- Combines all prompt components
- Functions: `buildUnifiedPrompt()`, `buildClaudePrompt()`, `buildGeminiPrompt()`
- Configurable options (includeLifecycle, includeUltimateTruth, includeROI, etc.)
- **LIVE DATA ONLY**: All prompts enforce live data queries

---

## 🔧 Integration Steps

### For Edge Functions (Deno):

Since Edge Functions run in Deno and can't directly import from `src/lib`, you have two options:

**Option 1: Copy prompt strings to Edge Functions**
- Copy the prompt strings from the components
- Paste into Edge Function files
- Update as needed

**Option 2: Create shared Edge Function module**
- Create `supabase/functions/_shared/prompts.ts`
- Export prompt strings
- Import in other Edge Functions

### For Frontend/API Routes (Node.js):

Can directly import:
```typescript
import { buildClaudePrompt, buildGeminiPrompt } from '@/lib/unified-prompt-builder';
import { formatDealStage, formatLifecycleStage } from '@/lib/lead-lifecycle-mapping';
```

---

## 📋 Next Steps

### 1. Update `ptd-agent-claude` Edge Function
- Replace current `PTD_SYSTEM_KNOWLEDGE` with unified prompt
- Use `buildClaudePrompt()` logic
- Ensure all queries use LIVE data

### 2. Update `ptd-agent-gemini` Edge Function
- Replace current system prompt with unified prompt
- Use `buildGeminiPrompt()` logic
- Include chain-of-thought reasoning
- Ensure all queries use LIVE data

### 3. Update Other Agents
- `churn-predictor`: Add ROI calculations
- `intervention-recommender`: Add ROI to interventions
- `business-intelligence`: Add ultimate truth alignment
- `generate-lead-replies`: Add lifecycle context

### 4. Create Shared Prompt Module for Edge Functions
- Create `supabase/functions/_shared/unified-prompts.ts`
- Export prompt strings
- Import in all Edge Functions

---

## ✅ Key Features

### LIVE DATA ONLY ✅
- All prompts enforce: "ALWAYS query LIVE data from Supabase tables"
- No mock, cached, or test data allowed
- All queries use real tables: contacts, deals, call_records, attribution_events, etc.

### Unified Schema ✅
- Single source of truth for field names
- Consistent stage mappings across all agents
- Data priority rules when sources conflict

### ROI Focus ✅
- Every recommendation includes ROI calculation
- Quantifies impact in AED
- Considers $40K/month ad spend context

### Ultimate Truth ✅
- Aligns Facebook CAPI, HubSpot, AnyTrack data
- Event matching by email, phone, external_id
- Confidence scoring for alignments

### Lead Lifecycle ✅
- Complete 12-stage journey mapping
- HubSpot stage ID → human-readable names
- Tracks progression through all stages

---

## 🎯 Usage Example

```typescript
// In Edge Function or API Route
import { buildClaudePrompt } from '@/lib/unified-prompt-builder';

const systemPrompt = buildClaudePrompt({
  includeLifecycle: true,
  includeUltimateTruth: true,
  includeROI: true,
  includeWorkflows: true,
  knowledge: ragKnowledge, // From database
  memory: pastConversations, // From agent_memory table
  tools: availableTools, // Tool descriptions
});

// Use with Claude API
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: systemPrompt,
  messages: [...],
});
```

---

## 📊 Impact

- **Consistency**: All agents use same base knowledge
- **Accuracy**: LIVE data only, no mock data
- **ROI Focus**: Every recommendation includes ROI calculation
- **Alignment**: Ultimate truth engine aligns all data sources
- **Lifecycle**: Complete visibility into lead journey

---

**Status**: ✅ Core components complete, ready for agent integration
