# 🎯 HubSpot Master Integration Guide - client-vital-suite

> **Last Updated:** December 17, 2025
> **Portal ID:** 7973797 (PersonalTrainersDubai)
> **API Key:** See Supabase secrets (`HUBSPOT_API_KEY`)

---

## 📊 Complete HubSpot Connection Architecture

Your project has **5 different HubSpot connection points**, each serving a specific purpose:

```
┌─────────────────────────────────────────────────────────────────┐
│                 HUBSPOT PORTAL 7973797                          │
│                 PersonalTrainersDubai                           │
└─────────────────────────────────────────────────────────────────┘
                              ▲
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ 1. SUPABASE     │  │ 2. CLAUDE.AI    │  │ 3. LOCAL MCP    │
│ Edge Functions  │  │ Official MCP    │  │ (Cursor/VSCode) │
│ (Production)    │  │ (Chat)          │  │                 │
│                 │  │                 │  │                 │
│ ∞ Unlimited     │  │ ~90 Tools       │  │ ~90 Tools       │
│ Custom Logic    │  │ Quick Queries   │  │ IDE Agents      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│  contacts | deals | call_records | appointments | leads         │
│  client_health_scores | sync_logs | sync_errors                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ AI AGENTS       │  │ FRONTEND UI     │  │ META CAPI       │
│ ptd-agent-gemini│  │ Dashboard       │  │ sync-hubspot-   │
│ ptd-agent-claude│  │ HubSpot Live    │  │ to-capi         │
│ smart-agent     │  │ PTD Control     │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🏆 Connection Capability Comparison

| Connection | Location | Tools/Actions | Best For |
|------------|----------|---------------|----------|
| **1. Supabase Functions** | `supabase/functions/` | ∞ Unlimited | Production automation, webhooks, custom logic |
| **2. Claude.ai Official** | claude.ai settings | ~90 tools | Quick CRM queries in chat |
| **3. Local MCP Server** | `~/Documents/hubspot-mcp-server/` | ~90 tools | Cursor/VSCode AI agents |
| **4. HubSpot CLI** | `~/.hubspot/` | ~20 commands | Theme uploads, CMS work |
| **5. Frontend API** | `src/integrations/` | Via Supabase | Browser UI operations |

---

## 1️⃣ Supabase Edge Functions (MOST POWERFUL)

**Location:** `supabase/functions/`

### HubSpot-Related Functions (9 total):

| Function | Lines | Purpose |
|----------|-------|---------|
| `sync-hubspot-to-supabase` | 563 | Main CRM sync (contacts, deals, calls) |
| `sync-hubspot-to-capi` | - | Convert lifecycle → Meta CAPI events |
| `fetch-hubspot-live` | - | Real-time queries (no cache) |
| `hubspot-command-center` | 602 | Operations hub, security monitoring |
| `reassign-owner` | - | Manual lead reassignment |
| `auto-reassign-leads` | - | SLA-based auto reassignment |
| `hubspot-webhook` | - | Incoming webhook receiver |
| `hubspot-anytrack-webhook` | - | AnyTrack attribution sync |
| `hubspot-analyzer` | - | Lead analysis & scoring |

### What `sync-hubspot-to-supabase` Syncs (139+ Properties):

```typescript
// Contact Properties Synced:
- Identity: email, phone, firstname, lastname
- Lifecycle: lifecyclestage, hs_lead_status, hs_is_unworked
- Attribution: utm_source, utm_medium, utm_campaign, utm_content, utm_term
- First/Last Touch: hs_analytics_first_url, hs_analytics_last_url
- Company: company_name, industry, company_size, website
- Revenue: total_revenue, num_associated_deals
- Engagement: num_notes, num_meetings, num_emails, num_emails_opened
- PTD Custom: assigned_coach, assessment_date, package_type, sessions_purchased
- And 100+ more...
```

### Sync Schedule:
- **Automated:** Every 15 minutes via pg_cron
- **Manual:** Via Dashboard → "Sync HubSpot" button
- **API:** `POST /functions/v1/sync-hubspot-to-supabase`

### Environment Variables Required:
```bash
HUBSPOT_API_KEY=<your-hubspot-api-key>
HUBSPOT_ACCESS_TOKEN=<your-hubspot-api-key>  # Same key
```

---

## 2️⃣ Claude.ai Official HubSpot MCP

**Location:** Claude.ai settings → Connectors → HubSpot

### Available Tools (~90):
```
hubspot_search_objects       hubspot_create_object      hubspot_update_object
hubspot_delete_object        hubspot_batch_create       hubspot_batch_update
hubspot_batch_upsert         hubspot_list_owners        hubspot_get_owner
hubspot_change_owner         hubspot_get_associations   hubspot_create_association
hubspot_create_engagement    hubspot_log_call           hubspot_log_email
hubspot_create_note          hubspot_create_task        hubspot_create_meeting
hubspot_get_engagement_history  hubspot_list_pipelines  hubspot_move_deal_stage
hubspot_list_properties      hubspot_create_property    hubspot_list_workflows
hubspot_enroll_in_workflow   ... and 60+ more
```

### Best For:
- Quick CRM lookups in conversation
- Creating notes/tasks on the fly
- Checking deal pipelines
- Owner management

### Limitations:
- No custom business logic
- No database writes
- No multi-API orchestration
- Rate limited by MCP protocol

---

## 3️⃣ Local MCP Server (Cursor/VSCode)

**Location:** `/Users/milosvukovic/Documents/hubspot-mcp-server/dist/server.js`

### Configuration File:
```
~/.cursor/mcp.json                    # Global Cursor config
/client-vital-suite-1/.vscode/mcp-config-example.json  # Project example
```

### Current Config (FIXED):
```json
{
  "mcpServers": {
    "hubspot-advanced": {
      "command": "node",
      "args": ["/Users/milosvukovic/Documents/hubspot-mcp-server/dist/server.js"],
      "env": {
        "HUBSPOT_ACCESS_TOKEN": "<your-hubspot-api-key>"
      }
    }
  }
}
```

### Schema Fix Applied:
The original `@modelcontextprotocol/server-hubspot` package does NOT exist on npm. 
We use a local server with fixed JSON schema (added `items` to array types).

---

## 4️⃣ HubSpot CLI

**Location:** `~/.hubspot/hubspot.config.yml`

### Current Config:
```yaml
defaultAccount: personal-trainers-dubai
accounts:
  personal-trainers-dubai:
    accountId: 7973797
    authType: personalaccesskey
    personalAccessKey: CiRuYTEtYTJmMi0...
```

### Available Commands:
```bash
hs auth         # Authentication
hs accounts     # Manage accounts
hs project      # Project management
hs sandbox      # Sandbox management
hs upload       # Upload files/themes
hs fetch        # Download assets
hs logs         # View logs
```

### Best For:
- HubSpot CMS development
- Theme uploads
- NOT for CRM operations

---

## 5️⃣ Frontend API Integration

**Location:** `src/integrations/supabase/`

### How Frontend Uses HubSpot:
```typescript
// Frontend does NOT call HubSpot directly
// Instead, it calls Supabase Edge Functions:

// Trigger sync
await supabase.functions.invoke('sync-hubspot-to-supabase');

// Get live data
await supabase.functions.invoke('fetch-hubspot-live', {
  body: { query: 'latest_contacts' }
});

// AI agent query
await supabase.functions.invoke('ptd-agent-gemini', {
  body: { message: 'Show leads not contacted today' }
});
```

---

## 🔧 What To Use For What

| Task | Use This | Command/Action |
|------|----------|----------------|
| Quick CRM lookup | Claude.ai MCP | "Search for John in HubSpot" |
| Create note on contact | Claude.ai MCP | `hubspot_create_note` |
| Bulk data sync | Supabase Function | `sync-hubspot-to-supabase` |
| Real-time dashboard | Supabase + Frontend | `/hubspot-live` page |
| AI-powered analysis | Supabase Functions | `ptd-agent-gemini` |
| Meta CAPI conversion | Supabase Function | `sync-hubspot-to-capi` |
| Lead reassignment | Supabase Function | `auto-reassign-leads` |
| Cursor/VSCode agent | Local MCP Server | Configure in `.cursor/mcp.json` |
| Upload HubSpot theme | HubSpot CLI | `hs upload` |

---

## 📁 Project File Locations

### Supabase Functions:
```
supabase/functions/
├── _shared/
│   ├── hubspot-manager.ts          # Basic API wrapper
│   └── hubspot-sync-manager.ts     # Queue-based sync with rate limiting
├── sync-hubspot-to-supabase/       # Main sync (563 lines)
├── sync-hubspot-to-capi/           # Meta CAPI events
├── fetch-hubspot-live/             # Real-time queries
├── hubspot-command-center/         # Operations hub
├── reassign-owner/                 # Manual reassignment
├── auto-reassign-leads/            # Auto SLA reassignment
├── hubspot-webhook/                # Webhook receiver
├── hubspot-anytrack-webhook/       # AnyTrack integration
└── hubspot-analyzer/               # Lead analysis
```

### MCP Configurations:
```
~/.cursor/mcp.json                           # Cursor global (Supabase, Vercel, Firebase)
~/Library/Application Support/Claude/claude_desktop_config.json  # Claude Desktop
/client-vital-suite-1/.vscode/mcp-config-example.json            # Project example (FIXED)
```

### Documentation:
```
MCP_HUBSPOT_FIX.md                  # Schema fix guide
QUICK_FIX_MCP_HUBSPOT.md            # Quick fix steps
HOW_TO_USE_FIX.md                   # Usage guide
.vscode/mcp-config-example.json     # Working example config
```

---

## ✅ Current Status (All Fixed)

| Component | Status | Notes |
|-----------|--------|-------|
| Supabase Functions | ✅ Working | 9 HubSpot functions deployed |
| Supabase Secrets | ✅ Set | `HUBSPOT_API_KEY` & `HUBSPOT_ACCESS_TOKEN` |
| Claude.ai MCP | ✅ Working | Connected via OAuth |
| Local MCP Server | ✅ Fixed | Schema bug patched |
| Project MCP Config | ✅ Fixed | Points to local server |
| HubSpot CLI | ✅ Working | Portal 7973797 |
| API Key | ✅ Valid | 816/625,000 calls used today |

---

## 🚀 Quick Commands

### Test API Key:
```bash
curl -s "https://api.hubapi.com/account-info/v3/api-usage/daily/private-apps" \
  -H "Authorization: Bearer <your-hubspot-api-key>"
```

### Test Local MCP Server:
```bash
node /Users/milosvukovic/Documents/hubspot-mcp-server/dist/server.js
# Should output: "HubSpot MCP Server running on stdio"
```

### List Supabase Secrets:
```bash
cd /Users/milosvukovic/client-vital-suite-1
npx supabase secrets list
```

### Deploy Functions:
```bash
cd /Users/milosvukovic/client-vital-suite-1
./deploy-all-functions.sh
# Or specific function:
npx supabase functions deploy sync-hubspot-to-supabase
```

---

## 🔑 API Keys Summary

| Key | Value | Used By |
|-----|-------|---------|
| Private App Token | `<stored in Supabase secrets>` | Supabase, MCP, Direct API |
| Personal Access Key | `CiRuYTEtYTJmMi0...` | HubSpot CLI only |
| Portal ID | `7973797` | All connections |

Both keys connect to the **same HubSpot portal**.

---

## 📞 Support

For issues:
1. Check `sync_logs` table in Supabase for sync errors
2. Check `sync_errors` table for detailed error info
3. Test API key with curl command above
4. Check Claude Desktop config if MCP not working

