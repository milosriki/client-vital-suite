# MCP Independence Plan - Remove Cursor Dependency

## Current Problem

**Local MCP Server Dependency:**
- MCP config points to: `/Users/milosvukovic/Documents/hubspot-mcp-server/dist/server.js`
- Only works in Cursor/VSCode IDE
- Not accessible from production/browser
- Hardcoded local file path

## Solution: Replace with Serverless Functions

### Architecture Change

```
BEFORE (Cursor-dependent):
Cursor IDE → Local MCP Server → HubSpot API
         (only works locally)

AFTER (Independent):
Browser/API → Supabase Edge Functions → HubSpot API
         (works everywhere, no IDE needed)
```

---

## Implementation Steps

### 1. Use Existing Supabase Edge Functions ✅

**Already Available:**
- `hubspot-command-center` - HubSpot operations hub
- `sync-hubspot-to-supabase` - Sync contacts/deals
- `fetch-hubspot-live` - Real-time queries
- `reassign-owner` - Owner management
- `auto-reassign-leads` - Automated reassignment

**These are ALREADY independent!** They work from:
- Browser (via fetch)
- Vercel API routes
- Direct HTTP calls
- Any HTTP client

### 2. Create Unified HubSpot API Route

**New File:** `api/hubspot.ts`

```typescript
// Unified HubSpot API proxy
// Replaces local MCP server dependency
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Proxy to Supabase Edge Function
  const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/hubspot-command-center`;
  
  // Forward request with service role key
  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(req.body),
  });
  
  return res.json(await response.json());
}
```

### 3. Update Frontend to Use API Route

**Replace MCP calls with:**
```typescript
// Instead of MCP tool
fetch('/api/hubspot', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_engagement',
    data: { ... }
  })
})
```

### 4. Remove Local MCP Dependency

**Delete/Archive:**
- `.vscode/mcp-config-example.json` (or mark as deprecated)
- Local MCP server reference

**Keep:**
- Supabase Edge Functions (already deployed)
- Vercel API routes (production-ready)

---

## Benefits

| Before (Local MCP) | After (Serverless) |
|-------------------|-------------------|
| ❌ Only works in Cursor | ✅ Works everywhere |
| ❌ Requires local file | ✅ Cloud-hosted |
| ❌ Not accessible from browser | ✅ Browser accessible |
| ❌ IDE-specific | ✅ IDE-independent |
| ❌ Hardcoded paths | ✅ Environment-based |

---

## Migration Checklist

- [ ] Create `/api/hubspot.ts` API route
- [ ] Test HubSpot operations via API route
- [ ] Update frontend components to use API route
- [ ] Remove `.vscode/mcp-config-example.json` or mark deprecated
- [ ] Document new HubSpot API endpoint
- [ ] Verify all HubSpot operations work independently

---

## New API Endpoints

### `/api/hubspot` (New)
- **Method:** POST
- **Purpose:** Unified HubSpot operations
- **Backend:** Supabase Edge Function `hubspot-command-center`
- **Auth:** Service role key (server-side only)

**Actions Supported:**
- `create_engagement` - Create notes, emails, tasks
- `search_contacts` - Search HubSpot contacts
- `create_contact` - Create new contact
- `update_contact` - Update contact
- `reassign_owner` - Change owner
- `sync_data` - Sync to Supabase

---

## Testing

```bash
# Test HubSpot API route
curl -X POST https://client-vital-suite.vercel.app/api/hubspot \
  -H "Content-Type: application/json" \
  -d '{"action": "search_contacts", "query": "test"}'
```

---

## Result

**Complete independence from Cursor IDE!**

All HubSpot operations now work:
- ✅ From browser
- ✅ From API clients
- ✅ From any HTTP client
- ✅ From production
- ✅ No local files needed
- ✅ No IDE dependency

