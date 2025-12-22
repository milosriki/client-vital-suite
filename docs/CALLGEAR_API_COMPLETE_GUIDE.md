# 📚 CALLGEAR API COMPLETE KNOWLEDGE BASE

## PTD FITNESS ACCOUNT DETAILS

```
Account Name: YIN YOUNG SPORTS SERVICES
App ID: 69147
Timezone: Asia/Dubai
Admin Email: tejic93@gmail.com
HubSpot Portal: 7973797
```

---

## 🔑 ALL API CREDENTIALS & KEYS

### Data API (Statistics & Configuration)
```
URL:   https://dataapi.callgear.com/v2.0
Token: vu5cb5qys69p4ux18lee55beppjt2t4irpmvdogl
```

### Call API (Initiate & Manage Calls)
```
URL:   https://callapi.callgear.com/v4.0
Token: 0zi1wdi5hl5h40ou3ole552gqczwwi81etox7gfo
```

### Admin Account
```
Account Name:  ptdfitnessriki
Admin Email:   tejic93@gmail.com
App ID:        69147
Company:       YIN YOUNG SPORTS SERVICES
Timezone:      Asia/Dubai
```

### Admin Portals
```
Main Portal:      https://app.callgear.com
Alternate Portal: https://app.callgear.ae
Both access same data - use either
```

### SIP Server Configuration
```
Server:   sipve.callgear.ae
Port:     9061
Protocol: SIP over TLS
```

---

## 🔐 SIP LINE CREDENTIALS (Per Employee)

### Matthew Twigg
```
SIP Login:    0160078
SIP Password: wcnyAKFsC3
Server:       sipve.callgear.ae:9061
Virtual #:    +971 54 888 7327
Employee ID:  758631
Line ID:      633510
```

### Kim James
```
SIP Login:    0160079
Server:       sipve.callgear.ae:9061
Virtual #:    +971 50 202 2952
Employee ID:  813951
Line ID:      633513
```

### Salah Yehia
```
SIP Login:    0160080
Server:       sipve.callgear.ae:9061
Virtual #:    +971 50 156 3801
Employee ID:  805020
Line ID:      633516
```

### Mazen Moussa
```
SIP Login:    0160081
Server:       sipve.callgear.ae:9061
Virtual #:    +971 54 420 6006
Employee ID:  824847
Line ID:      633519
```

### Marko Antic
```
SIP Login:    0160083
Server:       sipve.callgear.ae:9061
Virtual #:    +971 54 444 9681
Employee ID:  829827
Line ID:      633525
```

### Philips Ad
```
SIP Login:    0160096
Server:       sipve.callgear.ae:9061
Virtual #:    +971 54 284 4455
Employee ID:  835776
Line ID:      633537
```

---

## 🔗 HUBSPOT INTEGRATION KEYS

### HubSpot Portal
```
Portal ID:    7973797
Portal URL:   https://app.hubspot.com/contacts/7973797
```

### Owner ID Mapping (HubSpot ↔ CallGear)
```
Salah Yehia:    HS=78722672  ↔ CG=805020
Kim James:      HS=80616467  ↔ CG=813951
Mazen Moussa:   HS=82655976  ↔ CG=824847
Matthew Twigg:  HS=452974662 ↔ CG=758631
Tea Vukovic:    HS=48899890  ↔ CG=835419
Milos Vukovic:  HS=48877837  ↔ CG=758649
```

---

## 🌐 CALLGEAR HAS 4 DIFFERENT APIs

| API | Purpose | Base URL |
|-----|---------|----------|
| **Data API** | Configuration, statistics, reports | https://dataapi.callgear.com/v2.0 |
| **Call API** | Initiate and manage calls | https://callapi.callgear.com/v4.0 |
| **Interactive Call Processing (ICP)** | Real-time call routing during calls | Webhook-based |
| **JavaScript API** | Website widget, click-to-call | Client-side JS |

---

## 📊 DATA API - FULL REFERENCE

### Available Methods (Tested & Working)

| Method | Description | Status |
|--------|-------------|--------|
| `get.account` | Account information | ✅ |
| `get.employees` | List all employees | ✅ |
| `get.virtual_numbers` | List virtual phone numbers | ✅ |
| `get.sip_lines` | List SIP line configurations | ✅ |
| `get.scenarios` | List call routing scenarios | ✅ |
| `get.tags` | List call tags | ✅ |
| `get.media_files` | List audio/media files | ✅ |
| `get.calls_report` | Get call history/reports | ✅ |
| `get.financial_call_legs_report` | Billing/cost reports | ✅ |
| `get.chats_report` | Chat communications | ✅ |

### Request Format (JSON-RPC 2.0)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "get.calls_report",
  "params": {
    "access_token": "YOUR_TOKEN",
    "date_from": "2025-12-22 00:00:00",
    "date_till": "2025-12-22 23:59:59",
    "limit": 1000,
    "offset": 0
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "data": [...],
    "metadata": {
      "total_items": 500,
      "limits": {
        "day_limit": 1000,
        "day_remaining": 918,
        "minute_limit": 250,
        "minute_remaining": 249
      }
    }
  }
}
```


---

## 📞 CALL REPORTS - get.calls_report

### Full Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Call record ID |
| `call_session_id` | string | Unique call session identifier |
| `start_time` | datetime | Call start time (YYYY-MM-DD HH:MM:SS) |
| `finish_time` | datetime | Call end time |
| `virtual_phone_number` | string | PTD virtual number used |
| `contact_phone_number` | string | Customer's phone number |
| `direction` | enum | `in` (inbound) or `out` (outbound) |
| `source` | enum | `sip`, `va`, `callback`, `scenario` |
| `is_lost` | boolean | True if call was not answered |
| `finish_reason` | string | Why call ended |
| `talk_duration` | number | Actual talk time in seconds |
| `total_duration` | number | Total call duration |
| `wait_duration` | number | Time waiting to connect |
| `employee_id` | number | CallGear employee ID |
| `employee_full_name` | string | Employee name |
| `scenario_id` | number | Routing scenario used |
| `call_records` | array | Recording URLs |
| `tags` | array | Call tags applied |
| `contact_id` | number | Contact ID if matched |

### Source Types Explained

| Source | Meaning |
|--------|---------|
| `sip` | Call made via SIP softphone/app |
| `va` | Inbound to virtual number |
| `callback` | Website callback request |
| `scenario` | Automated scenario call |
| `api` | Call initiated via API |

### Finish Reasons

| Reason | Meaning |
|--------|---------|
| `operator_disconnects` | Agent ended the call |
| `subscriber_disconnects` | Customer ended the call |
| `no_success_subscriber_call` | ❌ Call failed to connect |
| `success_finish` | Call completed successfully |
| `no_operators_available` | No agents available |
| `ivr_timeout` | IVR menu timeout |
| `abandoned_in_queue` | Caller hung up waiting |

### Example: Get Today's Calls

```bash
curl -s -X POST "https://dataapi.callgear.com/v2.0" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get.calls_report",
    "id": 1,
    "params": {
      "access_token": "vu5cb5qys69p4ux18lee55beppjt2t4irpmvdogl",
      "date_from": "2025-12-22 00:00:00",
      "date_till": "2025-12-22 23:59:59",
      "limit": 500
    }
  }'
```

### Example: Filter by Employee

```json
{
  "jsonrpc": "2.0",
  "method": "get.calls_report",
  "id": 1,
  "params": {
    "access_token": "YOUR_TOKEN",
    "date_from": "2025-12-22 00:00:00",
    "date_till": "2025-12-22 23:59:59",
    "filter": {
      "field": "employee_id",
      "operator": "=",
      "value": 758631
    }
  }
}
```

### Example: Filter by Virtual Number

```json
{
  "params": {
    "filter": {
      "field": "virtual_phone_number",
      "operator": "=",
      "value": "971548887327"
    }
  }
}
```


---

## 👥 PTD EMPLOYEES - CURRENT ACTIVE ROSTER

### Sales Team with SIP Lines

| Name | Employee ID | SIP Line | Virtual Number | HubSpot Owner ID |
|------|-------------|----------|----------------|------------------|
| **Matthew Twigg** | 758631 | 0160078 | +971 54 888 7327 | 452974662 |
| **Kim James** | 813951 | 0160079 | +971 50 202 2952 | 80616467 |
| **Salah Yehia** | 805020 | 0160080 | +971 50 156 3801 | 78722672 |
| **Mazen Moussa** | 824847 | 0160081 | +971 54 420 6006 | 82655976 |
| **Marko Antic** | 829827 | 0160083 | +971 54 444 9681 | - |
| **Philips Ad** | 835776 | 0160096 | +971 54 284 4455 | - |

### SIP Configuration Reference

```
Server: sipve.callgear.ae
Port: 9061
Protocol: SIP over TLS
Channels: 1 per line
Type: in_out (inbound + outbound)
```

---

## 📱 VIRTUAL NUMBERS - PTD INVENTORY

| Number | ID | Purpose |
|--------|-----|---------|
| +971 50 773 0330 | 95554 | Shiela |
| +971 54 444 9681 | 89980 | Marko Antic |
| +971 54 888 7327 | 89983 | Matthew Twigg |
| +971 50 328 8689 | 94768 | Available |
| +971 50 202 2952 | 101044 | Kim James |
| +971 50 783 6352 | 101047 | Available |
| +971 54 284 4455 | 89986 | Philips Ad |
| +971 50 156 3801 | 89989 | Salah Yehia |
| +971 50 881 3321 | 92596 | Available |
| +971 54 420 6006 | 89992 | Mazen Moussa |
| +971 56 664 6312 | 89998 | Available |

---

## 🔀 CALL ROUTING SCENARIOS

| Scenario ID | Name | Virtual Number |
|-------------|------|----------------|
| 40920 | Marko Antic | 971544449681 |
| 41394 | Twigg Matthew | 971548887327 |
| 41397 | A Philips | 971542844455 |
| 46434 | Shiela | 971507730330 |
| 58035 | Kim James | 971502022952 |
| 58038 | Salah Yehia | 971501563801 |
| 59397 | Moussa Mazen | 971544206006 |


---

## 📞 CALL API - INITIATE & MANAGE CALLS

### Available Methods

| Method | Description | Required Params |
|--------|-------------|-----------------|
| `start.employee_call` | Call to employee's SIP phone | `contact`, `employee_id` |
| `start.simple_call` | Call any external number | `contact`, `virtual_phone_number` |
| `start.scenario_call` | Call using routing scenario | `contact`, `scenario_id` |
| `start.vnumber_call` | Call to virtual number | `contact`, `virtual_phone_number` |
| `start.informer_call` | Play message to contact | `contact`, `media_file_id` |
| `make.call` | Transfer/consult during call | `call_session_id`, `contact` |
| `hold.call` | Put call on hold | `call_session_id` |
| `unhold.call` | Resume held call | `call_session_id` |
| `release.call` | End/disconnect call | `call_session_id` |
| `transfer.talk` | Transfer call | `call_session_id`, `contact` |
| `record.call` | Start/stop recording | `call_session_id` |
| `tag.call` | Add tag to call | `call_session_id`, `tag_id` |
| `list.calls` | Get active calls | - |

### Example: Initiate Employee Call

```json
{
  "jsonrpc": "2.0",
  "method": "start.employee_call",
  "id": 1,
  "params": {
    "access_token": "YOUR_TOKEN",
    "contact": "+971501234567",
    "employee_id": 758631,
    "virtual_phone_number": "971548887327"
  }
}
```

### Example: Simple Outbound Call

```json
{
  "jsonrpc": "2.0",
  "method": "start.simple_call",
  "id": 1,
  "params": {
    "access_token": "YOUR_TOKEN",
    "contact": "+971501234567",
    "virtual_phone_number": "971548887327"
  }
}
```

---

## 🔧 SIP LINE MANAGEMENT - get.sip_lines

### Response Fields

| Field | Description |
|-------|-------------|
| `id` | SIP line ID |
| `phone_number` | SIP login (e.g., "0160078") |
| `employee_id` | Linked employee |
| `employee_full_name` | Employee name |
| `virtual_phone_number` | Assigned virtual number |
| `status` | `active` or `inactive` |
| `billing_state` | Billing status |
| `physical_state` | Registration state (Russian: "Зарегистрирован" = Registered) |
| `channels_count` | Number of concurrent calls allowed |
| `type` | `in_out`, `in`, `out` |
| `ip_addresses` | Array of registered device IPs |

### IP Registration Details

Each SIP line shows registered devices:
```json
"ip_addresses": [
  {
    "ip": "87.201.21.125",
    "date_time": "2025-12-22T09:33:35"
  },
  {
    "ip": "87.200.225.204",
    "date_time": "2025-12-02T18:56:38"  // ← STALE!
  }
]
```

⚠️ **Multiple registrations = potential routing conflicts!**


---

## 🔍 FILTERING & SORTING

### Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `"field": "employee_id", "operator": "=", "value": 758631` |
| `!=` | Not equals | `"operator": "!="` |
| `<` | Less than | `"field": "talk_duration", "operator": "<", "value": 60` |
| `>` | Greater than | |
| `<=` | Less or equal | |
| `>=` | Greater or equal | |
| `like` | Contains (use %) | `"field": "contact_phone_number", "operator": "like", "value": "%55888%"` |
| `in` | In array | `"field": "employee_id", "operator": "in", "value": [758631, 805020]` |

### Complex Filter Example (AND)

```json
{
  "filter": {
    "filters": [
      {"field": "employee_id", "operator": "=", "value": 758631},
      {"field": "is_lost", "operator": "=", "value": false}
    ],
    "condition": "and"
  }
}
```

### Complex Filter Example (OR)

```json
{
  "filter": {
    "filters": [
      {"field": "employee_id", "operator": "=", "value": 758631},
      {"field": "employee_id", "operator": "=", "value": 805020}
    ],
    "condition": "or"
  }
}
```

### Sorting

```json
{
  "sort": [
    {"field": "start_time", "order": "desc"}
  ]
}
```

---

## 🔗 HUBSPOT INTEGRATION

### How CallGear → HubSpot Sync Works

1. **Call Initiated** → CallGear creates call record
2. **Call Processing** → CallGear tracks duration, recording
3. **Call Ends** → CallGear sends data to HubSpot via integration
4. **HubSpot Update** → Creates/updates call engagement

### HubSpot Owner ↔ CallGear Employee Mapping

| HubSpot Owner | HubSpot ID | CallGear Employee | CG ID |
|---------------|------------|-------------------|-------|
| Salah Yehia | 78722672 | Salah Yehia | 805020 |
| Kim James | 80616467 | Kim James | 813951 |
| Mazen Moussa | 82655976 | Mazen Moussa | 824847 |
| Matthew Twigg | 452974662 | Matthew Twigg | 758631 |

### Integration Settings Location

- CallGear Admin: `Account → Integrations → HubSpot`
- Settings include:
  - Create contacts automatically
  - Log calls to CRM
  - Push recordings
  - Employee ↔ Owner mapping

### Common Integration Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Calls not syncing | Integration disabled | Re-enable in CallGear |
| NULL metadata in HubSpot | API token expired | Refresh HubSpot token |
| Wrong owner assigned | Employee mapping incorrect | Update mapping |
| Missing recordings | Recording not pushed | Check integration settings |


---

## ⚠️ ERROR CODES REFERENCE

### Common Errors

| Code | Mnemonic | Description |
|------|----------|-------------|
| -32700 | `parse_error` | Invalid JSON |
| -32600 | `invalid_request` | Bad request structure |
| -32601 | `method_not_found` | Method doesn't exist |
| -32602 | `required_parameter_missed` | Missing required param |
| -32602 | `invalid_parameter_value` | Wrong value format |
| -32001 | `access_token_invalid` | Bad/expired token |
| -32001 | `access_token_expired` | Token expired |
| -32003 | `ip_not_whitelisted` | IP not authorized |
| -32003 | `forbidden` | No permission |
| -32029 | `limit_exceeded` | Rate limit hit |
| -32008 | `component_disabled` | Feature not enabled |

### Rate Limits

| Limit | Value | Reset |
|-------|-------|-------|
| Per Day | 1000 points | Midnight UTC |
| Per Minute | 250 points | 60 seconds |
| Method Weight | 1 point each | - |

---

## 🔔 WEBHOOKS / NOTIFICATIONS

### Available Notification Types

| Notification | Fires When |
|--------------|------------|
| `call_start` | Call initiated |
| `call_answer` | Call answered |
| `call_finish` | Call ended |
| `call_record_ready` | Recording available |
| `employee_answer` | Agent picks up |
| `employee_disconnect` | Agent hangs up |

### Webhook Payload Example (call_finish)

```json
{
  "notification_name": "call_finish",
  "notification_mnemonic": "call_finish",
  "virtual_phone_number": "971548887327",
  "notification_time": "2025-12-22T12:30:00Z",
  "contact_phone_number": "+971501234567",
  "call_session_id": "abc123xyz",
  "employee_full_name": "Matthew Twigg",
  "employee_id": 758631,
  "direction": "out",
  "talk_time_duration": 120,
  "total_time_duration": 145,
  "wait_time_duration": 25,
  "tag_names": ["Sale"]
}
```

---

## 🐛 TROUBLESHOOTING GUIDE

### Issue: Calls Failing with "no_success_subscriber_call"

**Symptoms:**
- 70-80% of calls fail
- `is_lost: true` in call report
- `finish_reason: "no_success_subscriber_call"`

**Causes:**
1. SIP line not registered
2. Multiple device registrations (conflict)
3. Network issues
4. Wrong caller ID

**Diagnosis:**
```bash
# Check SIP registration
curl -s -X POST "https://dataapi.callgear.com/v2.0" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get.sip_lines",
    "id": 1,
    "params": {"access_token": "YOUR_TOKEN"}
  }' | python3 -m json.tool
```

Look for:
- `physical_state: "Зарегистрирован"` = Registered ✅
- Multiple IPs in `ip_addresses` = Conflict ⚠️

**Fix:**
1. Remove stale registrations in CallGear Admin
2. Use only ONE device (web OR mobile)
3. Re-register SIP line

---

### Issue: HubSpot Shows NULL Call Data

**Symptoms:**
- Calls appear in HubSpot
- Duration, phone, recording = NULL
- Status shows "COMPLETED"

**Causes:**
1. CallGear → HubSpot sync broken
2. HubSpot API token expired
3. Integration misconfigured

**Diagnosis:**
1. Check CallGear has the data (via API)
2. Check HubSpot integration settings
3. Verify employee ↔ owner mapping

**Fix:**
1. Disconnect/reconnect HubSpot integration
2. Refresh OAuth tokens
3. Verify webhook URL is correct


---

## 🛠️ USEFUL CODE SNIPPETS

### Python: Get All Calls Today

```python
import requests
import json

def get_calls_today():
    url = "https://dataapi.callgear.com/v2.0"
    payload = {
        "jsonrpc": "2.0",
        "method": "get.calls_report",
        "id": 1,
        "params": {
            "access_token": "vu5cb5qys69p4ux18lee55beppjt2t4irpmvdogl",
            "date_from": "2025-12-22 00:00:00",
            "date_till": "2025-12-22 23:59:59",
            "limit": 500
        }
    }
    response = requests.post(url, json=payload)
    return response.json()['result']['data']
```

### Python: Filter by Employee

```python
def get_employee_calls(employee_id, date_from, date_till):
    payload = {
        "jsonrpc": "2.0",
        "method": "get.calls_report",
        "id": 1,
        "params": {
            "access_token": "YOUR_TOKEN",
            "date_from": date_from,
            "date_till": date_till,
            "filter": {
                "field": "employee_id",
                "operator": "=",
                "value": employee_id
            }
        }
    }
    return requests.post("https://dataapi.callgear.com/v2.0", json=payload).json()
```

### Bash: Quick Call Check

```bash
#!/bin/bash
# Check calls for Matthew today
curl -s -X POST "https://dataapi.callgear.com/v2.0" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get.calls_report",
    "id": 1,
    "params": {
      "access_token": "vu5cb5qys69p4ux18lee55beppjt2t4irpmvdogl",
      "date_from": "'$(date +%Y-%m-%d)' 00:00:00",
      "date_till": "'$(date +%Y-%m-%d)' 23:59:59",
      "filter": {
        "field": "virtual_phone_number",
        "operator": "=",
        "value": "971548887327"
      }
    }
  }' | python3 -m json.tool
```

---

## 📋 QUICK REFERENCE CARD

### API Endpoints

```
Data API:  https://dataapi.callgear.com/v2.0
Call API:  https://callapi.callgear.com/v4.0
Admin:     https://app.callgear.com (or .ae)
SIP:       sipve.callgear.ae:9061
```

### Key Methods

```
get.calls_report      → Call history
get.employees         → Team list
get.sip_lines         → SIP registrations
get.virtual_numbers   → Phone inventory
get.scenarios         → Call routing
start.employee_call   → Initiate call
```

### Employee Quick Lookup

```
Matthew = employee_id: 758631, SIP: 0160078, VN: 971548887327
Kim     = employee_id: 813951, SIP: 0160079, VN: 971502022952
Yehia   = employee_id: 805020, SIP: 0160080, VN: 971501563801
Mazen   = employee_id: 824847, SIP: 0160081, VN: 971544206006
Marko   = employee_id: 829827, SIP: 0160083, VN: 971544449681
Philips = employee_id: 835776, SIP: 0160096, VN: 971542844455
```

### Call Status Quick Check

```
is_lost: true  → Call failed/unanswered
is_lost: false → Call successful
source: sip    → Made via CallGear app
source: va     → Inbound call
```

---

## 📄 DOCUMENT INFO

```
Created: 2025-12-22
Author: Claude AI for PTD Fitness
Version: 1.0
Purpose: CallGear API integration reference
```

---

*End of CallGear API Complete Knowledge Base*
