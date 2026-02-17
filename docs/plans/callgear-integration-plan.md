# CallGear Integration Plan

## Current State
- Call data comes from HubSpot calling (31K records, 26K with setter attribution)
- HubSpot has basic call status (initiated/completed/missed) + duration
- No AI transcription, no quality scoring, no scenario analysis
- Recording URLs exist (9,181 calls) but point to HubSpot, not CallGear

## CallGear APIs Available

### 1. Data API (`dataapi.callgear.com/v2.0`)
- JSON-RPC protocol, POST method
- Requires IP whitelist + access key (generated in CallGear admin)
- Key methods: `get.calls`, `get.employees`, `get.campaigns`, `get.tracking_numbers`
- Rate limited by points (1 point per operation)
- Max 3 months date range per request

### 2. CA API — Call Analytics (`cg-dub-ca-api.callgear.ae/api/v1.0`)
- REST API, Bearer token auth
- **Scenarios**: Quality control checklists (e.g., "Did setter greet?", "Did setter ask for appointment?")
- **Scenario Points**: Key moments in each call
- **Scenario Results**: AI analysis of each call against scenarios
- **Tags**: Auto-tags (complaint, high-value, buying signal, negative sentiment)
- **Summaries**: AI-generated call summaries
- **Phrases & Words**: Key phrases extracted
- **Employee Metrics**: Per-agent performance from AI analysis

### 3. AICA Features (from callgear.ae/aica/)
- 100% call transcription
- Smart tagging (auto-categorize calls)
- AI summaries per call
- Agent performance reports
- CRM integration (auto-fill fields)
- Smart Player (jump to key moments)
- Lead saving alerts (compliance risks)
- Whale client finder (high-value deal detection)

## Integration Plan

### Phase 1: Data API Sync (Week 1)
- [ ] Get CallGear API key from Milos
- [ ] Whitelist server IP in CallGear admin
- [ ] Create edge function `sync-callgear-calls`
- [ ] Map CallGear fields to `call_records`:
  - call_id, direction, duration, status, recording_url
  - caller_number, callee_number
  - employee_id → setter mapping
  - tracking_number → campaign attribution
- [ ] Backfill last 90 days of CallGear data
- [ ] Set up daily sync cron

### Phase 2: AI Analysis Integration (Week 2)
- [ ] Create `call_ai_analysis` table:
  - call_id, scenario_id, scenario_score
  - summary_text, tags[], key_phrases[]
  - success_points[], failed_points[]
  - agent_metrics (greeting, script_adherence, closing)
- [ ] Create edge function `sync-callgear-analysis`
- [ ] Build custom scenarios for PTD Fitness:
  1. "Setter Greeting & Introduction" 
  2. "Needs Assessment" (location, goals, schedule)
  3. "Appointment Booking Attempt"
  4. "Objection Handling" (price, time, location)
  5. "Follow-up Agreement"
- [ ] Create `view_call_quality_scores` (per-setter quality metrics)

### Phase 3: In-House AI Layer (Week 3-4)
- [ ] Build our own analysis using Gemini SDK:
  - Transcription summary (if CallGear summary isn't good enough)
  - Intent detection (booking, inquiry, complaint, price check)
  - Sentiment analysis per speaker
  - Buying signal detection
  - Objection classification
  - Conversion probability scoring
- [ ] Feed analysis back to dashboard:
  - Per-call AI insights
  - Setter coaching suggestions
  - Manager alerts (missed opportunities, poor handling)

### Phase 4: Actionable Intelligence (Week 4+)
- [ ] "This setter missed 3 callbacks today — alert"
- [ ] "Lead X showed high buying signal but wasn't booked — follow up"
- [ ] "Setter Y's objection handling dropped 20% this week — review"
- [ ] "Top converting phrase this month: [X] — share with team"
- [ ] Auto-create follow-up tasks in HubSpot from AI analysis

## Prerequisites
- [ ] CallGear API credentials (key or login/password)
- [ ] IP whitelist for our Edge Functions (Supabase Mumbai IP range)
- [ ] CallGear AICA subscription (confirm active)
- [ ] Review existing CallGear scenarios (if any configured)

## Cross-Reference: HubSpot vs CallGear
| Feature | HubSpot | CallGear |
|---------|---------|----------|
| Call records | ✅ Basic | ✅ Full detail |
| Duration | ✅ (in ms) | ✅ (accurate) |
| Recording | ✅ HubSpot hosted | ✅ CallGear hosted |
| Transcription | ⚠️ Limited AI | ✅ Full AICA |
| Quality scoring | ❌ | ✅ Scenario-based |
| Smart tags | ❌ | ✅ Auto-tags |
| Summaries | ⚠️ Manual | ✅ AI-generated |
| Agent metrics | ❌ | ✅ Per-scenario |
| Employee mapping | ✅ owner_id | ✅ employee_id |

## Pixel Training Plan (Separate Doc)
After CallGear integration, combine:
1. CallGear call quality data
2. HubSpot deal outcomes
3. Facebook CAPI
→ Feed closed-deal events back to Facebook with proper attribution
→ Train pixel on "quality lead" signals, not just form fills
