# HubSpot Properties for Sessions & Package Subscriptions

## Direct HubSpot Contact Properties Available

Based on the sync function (`supabase/functions/sync-hubspot-to-supabase/index.ts`), here are the **direct HubSpot properties** you can access for sessions and package subscriptions:

---

## 📦 PACKAGE SUBSCRIPTION PROPERTIES

### Custom Properties (PTD-Specific)
These are **custom properties** that must be created in HubSpot:

1. **`package_type`** (Text)
   - **Description**: Type of package purchased (e.g., "12-week-transform", "6-month-premium")
   - **Location**: HubSpot Contact → Custom Properties
   - **Example Values**: "12-week-transform", "6-month-premium", "3-month-starter"
   - **Usage**: Categorizes client packages

2. **`sessions_purchased`** (Number)
   - **Description**: Total number of sessions purchased in the package
   - **Location**: HubSpot Contact → Custom Properties
   - **Example Values**: 12, 24, 36, 50
   - **Usage**: Tracks total sessions bought

3. **`outstanding_sessions`** (Number)
   - **Description**: Number of sessions remaining/unused
   - **Location**: HubSpot Contact → Custom Properties
   - **Example Values**: 0, 5, 12, 24
   - **Usage**: Tracks remaining sessions (calculated as: sessions_purchased - sessions_used)

---

## 📅 SESSION/MEETING PROPERTIES

### Standard HubSpot Properties (Built-in)

1. **`num_meetings`** (Number)
   - **Description**: Total count of meetings/sessions booked
   - **Location**: HubSpot Contact → Standard Properties
   - **Source**: Automatically calculated by HubSpot from meeting records
   - **Usage**: Total sessions completed/booked

2. **`hs_last_meeting_booked_date`** (Date)
   - **Description**: Date of the last meeting/session that was booked
   - **Location**: HubSpot Contact → Standard Properties
   - **Format**: ISO 8601 timestamp
   - **Usage**: Last session booking date

3. **`hs_next_activity_date`** (Date)
   - **Description**: Date of the next scheduled activity (meeting/session)
   - **Location**: HubSpot Contact → Standard Properties
   - **Format**: ISO 8601 timestamp
   - **Usage**: Next session scheduled date

---

## 🔗 RELATED PROPERTIES (For Context)

### Deal Properties (Associated Deals)
When a contact has associated deals, you can access:

1. **`num_associated_deals`** (Number)
   - Total number of deals linked to the contact
   - **Usage**: Count of package purchases

2. **`total_revenue`** (Number)
   - Total revenue from all associated deals
   - **Usage**: Package value in AED

3. **`associated_deal_ids`** (Array)
   - List of HubSpot Deal IDs
   - **Usage**: Link to deal records for package details

### Assessment/Scheduling Properties

1. **`assessment_scheduled`** (Boolean)
   - Whether assessment/intake session is scheduled
   - **Usage**: First session booking status

2. **`assessment_date`** (Date)
   - Date of scheduled assessment
   - **Usage**: First session date

---

## 📊 HOW TO ACCESS THESE PROPERTIES

### Via HubSpot API
```javascript
// Fetch contact with package/session properties
const properties = [
  'package_type',
  'sessions_purchased', 
  'outstanding_sessions',
  'num_meetings',
  'hs_last_meeting_booked_date',
  'hs_next_activity_date',
  'num_associated_deals',
  'total_revenue'
];

const response = await fetch(
  `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
  {
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
    },
    params: {
      properties: properties.join(',')
    }
  }
);
```

### Via Supabase Sync Function
These properties are automatically synced to the `contacts` table:
- `package_type` → `contacts.package_type`
- `sessions_purchased` → `contacts.sessions_purchased`
- `outstanding_sessions` → `contacts.outstanding_sessions`
- `num_meetings` → `contacts.num_meetings`
- `hs_last_meeting_booked_date` → `contacts.last_meeting_date`
- `hs_next_activity_date` → `contacts.next_meeting_date`

---

## ⚠️ IMPORTANT NOTES

### Custom Properties Must Be Created
The following properties are **NOT** standard HubSpot properties and must be **created manually** in HubSpot:
- `package_type`
- `sessions_purchased`
- `outstanding_sessions`

**To Create Custom Properties in HubSpot:**
1. Go to HubSpot → Settings → Properties → Contact Properties
2. Click "Create property"
3. Set:
   - **Internal name**: `package_type` (or `sessions_purchased`, `outstanding_sessions`)
   - **Label**: "Package Type" (or "Sessions Purchased", "Outstanding Sessions")
   - **Type**: Text (for package_type) or Number (for sessions)
   - **Field type**: Single-line text or Number

### Standard Properties Are Automatic
These properties are **automatically maintained** by HubSpot:
- `num_meetings` - Calculated from meeting records
- `hs_last_meeting_booked_date` - Updated when meetings are booked
- `hs_next_activity_date` - Updated when activities are scheduled

---

## 🔄 CALCULATED PROPERTIES (Not in HubSpot)

These are **calculated** in your system but NOT stored directly in HubSpot:

1. **`sessions_last_7d`** - Calculated from meeting records
2. **`sessions_last_30d`** - Calculated from meeting records
3. **`days_since_last_session`** - Calculated from `hs_last_meeting_booked_date`
4. **`sessions_used`** - Calculated as: `sessions_purchased - outstanding_sessions`

---

## 📋 COMPLETE PROPERTY LIST FOR SESSIONS & PACKAGES

### Direct HubSpot Properties (Available Now)
| Property Name | Type | Source | Description |
|--------------|------|--------|-------------|
| `package_type` | Text | Custom | Package type name |
| `sessions_purchased` | Number | Custom | Total sessions bought |
| `outstanding_sessions` | Number | Custom | Sessions remaining |
| `num_meetings` | Number | Standard | Total meetings count |
| `hs_last_meeting_booked_date` | Date | Standard | Last meeting date |
| `hs_next_activity_date` | Date | Standard | Next scheduled activity |
| `num_associated_deals` | Number | Standard | Number of deals |
| `total_revenue` | Number | Standard | Total deal value |
| `assessment_scheduled` | Boolean | Custom | Assessment booked |
| `assessment_date` | Date | Custom | Assessment date |

### Calculated Properties (In Your System)
| Property Name | Type | Calculated From | Description |
|--------------|------|----------------|-------------|
| `sessions_last_7d` | Number | Meeting records | Sessions in last 7 days |
| `sessions_last_30d` | Number | Meeting records | Sessions in last 30 days |
| `sessions_used` | Number | `sessions_purchased - outstanding_sessions` | Sessions completed |
| `days_since_last_session` | Number | `hs_last_meeting_booked_date` | Days since last session |
| `package_health_score` | Number | `outstanding_sessions / sessions_purchased` | Package utilization |

---

## 🎯 RECOMMENDED WORKFLOW

### For Tracking Sessions:
1. **Use `num_meetings`** for total count
2. **Use `hs_last_meeting_booked_date`** for recency
3. **Use `hs_next_activity_date`** for upcoming sessions
4. **Calculate** `sessions_last_7d` and `sessions_last_30d` from meeting records

### For Tracking Packages:
1. **Use `package_type`** for categorization
2. **Use `sessions_purchased`** for total sessions
3. **Use `outstanding_sessions`** for remaining count
4. **Use `total_revenue`** from associated deals for package value
5. **Calculate** `sessions_used` = `sessions_purchased - outstanding_sessions`

---

## 🔍 WHERE TO FIND IN HUBSPOT UI

1. **Contact Record** → Properties Tab
   - Scroll to "Custom Properties" section for `package_type`, `sessions_purchased`, `outstanding_sessions`
   - Scroll to "Activity" section for `num_meetings`, `hs_last_meeting_booked_date`
   - Scroll to "Deal Information" section for `num_associated_deals`, `total_revenue`

2. **Deal Record** (Associated Deal)
   - Deal amount = Package value
   - Deal stage = Package purchase status
   - Deal close date = Package purchase date

---

## 💡 BEST PRACTICES

1. **Keep `outstanding_sessions` Updated**: Update this property whenever a session is completed
2. **Link Deals**: Always create a deal when a package is purchased (links to `total_revenue`)
3. **Use Meetings**: Book all sessions as HubSpot meetings (auto-updates `num_meetings`)
4. **Sync Regularly**: Run `sync-hubspot-to-supabase` function to keep data in sync

---

## 🚀 QUICK REFERENCE

**To get all session/package data for a contact:**
```sql
SELECT 
  email,
  package_type,
  sessions_purchased,
  outstanding_sessions,
  num_meetings,
  last_meeting_date,
  next_meeting_date,
  total_revenue,
  num_associated_deals
FROM contacts
WHERE email = 'client@example.com';
```

**To calculate sessions used:**
```sql
SELECT 
  email,
  sessions_purchased,
  outstanding_sessions,
  (sessions_purchased - outstanding_sessions) as sessions_used,
  ROUND((outstanding_sessions::numeric / NULLIF(sessions_purchased, 0)) * 100, 1) as package_utilization_pct
FROM contacts
WHERE sessions_purchased > 0;
```

