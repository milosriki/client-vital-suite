# 🔄 HubSpot Workflow & Owner Reassignment Capabilities

## 📊 **CURRENT CAPABILITIES**

### ✅ **What the System CAN Do:**

1. **Track Owner Changes** ✅
   - Monitors owner reassignments in HubSpot
   - Tracks mass owner changes (anomaly detection)
   - Logs owner changes in `hubspot_contact_changes` table

2. **Detect Reassignment Needs** ✅
   - Identifies leads without owners
   - Tracks SLA breaches (20min breach detection)
   - Monitors leads stuck in stages
   - Detects inactive leads

3. **Sync Owner Data** ✅
   - Syncs owner information from HubSpot
   - Stores owner IDs and names
   - Tracks owner assignments in Supabase

4. **Analyze Workflows** ✅
   - Analyzes existing HubSpot workflows
   - Identifies inactive reassignment workflows
   - Detects workflow issues (infinite loops)

---

## ⚠️ **WHAT NEEDS TO BE ADDED**

### **1. Direct Owner Reassignment** ⚠️

**Current Status:** NOT IMPLEMENTED

**What's Needed:**
- Function to update HubSpot contact owners via API
- HubSpot API endpoint: `PATCH /crm/v3/objects/contacts/{contactId}`

**Implementation Required:**
```typescript
// Add to hubspot-command-center or new function
async function reassignOwner(contactId: string, newOwnerId: string) {
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hubspot_owner_id: newOwnerId
        }
      })
    }
  );
  return response.json();
}
```

---

### **2. Workflow Creation** ⚠️

**Current Status:** NOT IMPLEMENTED

**Why:** HubSpot workflows are complex objects that require:
- Workflow definition (JSON structure)
- Actions and triggers
- Enrollment criteria
- Branching logic

**Options:**

**Option A: HubSpot UI (Recommended)**
- Create workflows manually in HubSpot UI
- System can trigger them via property updates
- More reliable and easier to maintain

**Option B: HubSpot Workflows API**
- Use HubSpot Workflows API to create workflows programmatically
- Complex and requires deep HubSpot API knowledge
- Less reliable than UI creation

**Recommended Approach:**
1. Create workflow templates in HubSpot UI
2. System updates properties to trigger workflows
3. System monitors workflow execution

---

## 🎯 **RECOMMENDED SOLUTION**

### **Hybrid Approach: Property-Based Triggering**

Instead of creating workflows programmatically, the system can:

1. **Update Contact Properties** ✅ (Can implement)
   - Set `reassignment_needed = true`
   - Set `reassignment_reason = "SLA_BREACH"`
   - Set `reassignment_priority = "HIGH"`

2. **HubSpot Workflow Triggers** ✅ (Manual setup)
   - Create workflow in HubSpot UI that watches these properties
   - When property changes → workflow reassigns owner
   - More reliable than API-based workflow creation

3. **Direct Owner Update** ⚠️ (Needs implementation)
   - Update owner directly via HubSpot API
   - Faster than property-based triggering
   - Requires API implementation

---

## 🔧 **IMPLEMENTATION PLAN**

### **Phase 1: Direct Owner Reassignment** (Quick Win)

**Add Function:** `reassign-owner`

**Location:** `supabase/functions/reassign-owner/index.ts`

**Functionality:**
```typescript
serve(async (req) => {
  const { contact_id, new_owner_id, reason } = await req.json();
  
  // Update owner in HubSpot
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contact_id}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          hubspot_owner_id: new_owner_id
        }
      })
    }
  );
  
  // Log reassignment
  await supabase.from('reassignment_log').insert({
    contact_id,
    old_owner_id: current_owner,
    new_owner_id,
    reason,
    reassigned_at: new Date().toISOString()
  });
  
  return new Response(JSON.stringify({ success: true }));
});
```

**Usage:**
```typescript
// From AI agent or automation
await supabase.functions.invoke('reassign-owner', {
  body: {
    contact_id: '12345',
    new_owner_id: '67890',
    reason: 'SLA_BREACH_20MIN'
  }
});
```

---

### **Phase 2: Automated Reassignment Logic**

**Add Function:** `auto-reassign-leads`

**Functionality:**
1. Find leads needing reassignment:
   - No owner assigned
   - SLA breach (20min+)
   - Stuck in stage >7 days
   - No activity >48 hours

2. Determine new owner:
   - Round-robin rotation
   - Based on workload
   - Based on expertise

3. Reassign:
   - Call `reassign-owner` function
   - Log reassignment
   - Notify old/new owner

**Schedule:** Run every 15 minutes

---

### **Phase 3: Workflow Integration**

**Option A: Property-Based (Recommended)**

1. **System Updates Properties:**
   ```typescript
   await updateHubSpotContact(contactId, {
     reassignment_needed: true,
     reassignment_reason: 'SLA_BREACH',
     reassignment_priority: 'HIGH',
     reassignment_requested_at: new Date().toISOString()
   });
   ```

2. **HubSpot Workflow Watches Properties:**
   - Trigger: When `reassignment_needed` = true
   - Action: Reassign to next available owner
   - Action: Reset `reassignment_needed` = false

**Benefits:**
- ✅ Reliable (HubSpot handles reassignment)
- ✅ Easy to maintain (workflow in HubSpot UI)
- ✅ Can add complex logic in HubSpot
- ✅ No API complexity

**Option B: Direct API (Faster)**

1. **System Directly Updates Owner:**
   ```typescript
   await reassignOwner(contactId, newOwnerId);
   ```

2. **HubSpot Workflow Optional:**
   - Can trigger notifications
   - Can log reassignment
   - Can update properties

**Benefits:**
- ✅ Faster (no property delay)
- ✅ More control
- ✅ Can batch reassignments

---

## 📋 **CURRENT WORKFLOW ANALYSIS**

### **Existing Reassignment Workflow:**

**Workflow:** "Reassignation 20min breach"
**Status:** INACTIVE ❌
**Issue:** Infinite loop detected

**What It Should Do:**
1. Detect leads not contacted within 20 minutes
2. Reassign to next available setter
3. Log reassignment
4. Notify team

**Why It's Broken:**
- Infinite loop in logic
- No exit condition
- Triggers itself repeatedly

**Fix Needed:**
1. Add reassignment flag to prevent loops
2. Add max reassignment count
3. Add cooldown period
4. Test thoroughly before reactivation

---

## 🎯 **RECOMMENDED IMPLEMENTATION**

### **Step 1: Add Owner Reassignment Function** (1-2 hours)

**Create:** `supabase/functions/reassign-owner/index.ts`

**Features:**
- Update HubSpot contact owner
- Log reassignment
- Handle errors gracefully
- Return success/failure

---

### **Step 2: Add Auto-Reassignment Logic** (2-3 hours)

**Create:** `supabase/functions/auto-reassign-leads/index.ts`

**Logic:**
1. Find leads needing reassignment:
   ```sql
   SELECT * FROM contacts 
   WHERE 
     (hubspot_owner_id IS NULL OR hubspot_owner_id = '')
     OR (last_contacted_at IS NULL AND created_at < NOW() - INTERVAL '20 minutes')
     OR (lifecycle_stage = 'lead' AND updated_at < NOW() - INTERVAL '7 days')
   ```

2. Determine new owner:
   - Round-robin from available setters
   - Or based on workload
   - Or based on expertise

3. Reassign:
   ```typescript
   await supabase.functions.invoke('reassign-owner', {
     body: {
       contact_id: lead.hubspot_id,
       new_owner_id: nextOwner.id,
       reason: 'AUTO_REASSIGN_SLA_BREACH'
     }
   });
   ```

4. Schedule:
   - Run every 15 minutes via cron
   - Or trigger on-demand

---

### **Step 3: Fix Existing HubSpot Workflow** (1 hour)

**In HubSpot UI:**
1. Open workflow "Reassignation 20min breach"
2. Add reassignment flag check:
   - If `reassignment_flag` = true → Skip
   - Set `reassignment_flag` = true before reassigning
3. Add max reassignment count:
   - If `reassignment_count` >= 3 → Stop
4. Add cooldown:
   - Don't reassign if reassigned in last 1 hour
5. Test with sample leads
6. Activate workflow

---

### **Step 4: Create Property-Based Workflow** (30 min)

**In HubSpot UI:**
1. Create new workflow: "Auto Reassignment Trigger"
2. Trigger: When `reassignment_needed` = true
3. Actions:
   - Reassign to next available owner (round-robin)
   - Set `reassignment_needed` = false
   - Set `reassignment_date` = now
   - Increment `reassignment_count`
   - Send notification to new owner
4. Activate workflow

**System Updates Property:**
```typescript
await updateHubSpotContact(contactId, {
  reassignment_needed: true,
  reassignment_reason: 'SLA_BREACH_20MIN'
});
```

---

## ✅ **SUMMARY**

### **Current Capabilities:**
- ✅ Track owner changes
- ✅ Detect reassignment needs
- ✅ Sync owner data
- ✅ Analyze workflows

### **Can Be Added:**
- ⚠️ Direct owner reassignment (needs implementation)
- ⚠️ Automated reassignment logic (needs implementation)
- ⚠️ Property-based workflow triggering (needs property updates)

### **Cannot Do:**
- ❌ Create HubSpot workflows programmatically (use HubSpot UI instead)
- ❌ Complex workflow logic via API (use HubSpot UI)

### **Recommended Approach:**
1. **Add `reassign-owner` function** - Direct API reassignment
2. **Add `auto-reassign-leads` function** - Automated logic
3. **Fix existing HubSpot workflow** - Remove infinite loop
4. **Create property-based workflow** - Reliable triggering

**Result:** System can automatically reassign owners when needed! ✅

---

## 🚀 **QUICK START**

**To enable owner reassignment:**

1. **Deploy reassign-owner function:**
   ```bash
   supabase functions deploy reassign-owner --project-ref ztjndilxurtsfqdsvfds
   ```

2. **Deploy auto-reassign-leads function:**
   ```bash
   supabase functions deploy auto-reassign-leads --project-ref ztjndilxurtsfqdsvfds
   ```

3. **Schedule auto-reassignment:**
   ```sql
   SELECT cron.schedule(
     'auto-reassign-leads',
     '*/15 * * * *', -- Every 15 minutes
     $$
     SELECT net.http_post(
       url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/auto-reassign-leads',
       headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     );
     $$
   );
   ```

4. **Fix HubSpot workflow** (in HubSpot UI)

5. **Test:** Create test lead, wait 20 minutes, verify reassignment

---

**The system CAN reassign owners, but needs the functions implemented!** 🎯
