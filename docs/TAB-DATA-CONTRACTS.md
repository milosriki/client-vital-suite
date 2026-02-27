# TAB DATA CONTRACTS (Research Baseline)

Date: 2026-02-27
Status: Research-first draft (no fix actions in this document)

## Contract fields used
- Primary Source
- Secondary/Fallback
- Required Fields (minimum)
- Join Keys
- Freshness SLA
- Failure/Empty-State Policy
- Source Badge
- Current Gaps
- Priority

---

## MAIN GROUP

### AI Intelligence (`/intelligence`)
- Primary Source: Supabase computed intelligence tables
- Secondary: AWS-derived health marts
- Required Fields: coach/client aggregates, risk flags, trend deltas
- Join Keys: `client_id`, `coach_id`, `report_date`
- Freshness SLA: <= 24h
- Failure Policy: show stale marker + last successful snapshot timestamp
- Source Badge: `Supabase (AWS-derived)`
- Current Gaps: mixed source assumptions in widgets
- Priority: P1

### Command Center (`/command-center`)
- Primary Source: Supabase ops snapshots + campaign funnel mart
- Secondary: live fallback queries
- Required Fields: ad_spend, leads, bookings, closed_won, campaign rows, snapshot_date
- Join Keys: `date`, `campaign_id`, `source`
- Freshness SLA: <= 6h
- Failure Policy: card-level fallback + no global crash
- Source Badge: `Supabase Aggregated`
- Current Gaps: prior null snapshot handling instability
- Priority: P0

### Marketing (`/marketing`)
- Primary Source: Meta + HubSpot + attribution marts (served from Supabase)
- Secondary: edge-function computed payload
- Required Fields: ROAS, CPL, top performers, leakage, projection metrics
- Join Keys: `campaign_id`, `adset_id`, `date`
- Freshness SLA: <= 6h
- Failure Policy: null-safe number formatting, tab-level error isolation
- Source Badge: `Meta + HubSpot`
- Current Gaps: `toFixed` runtime family historically frequent
- Priority: P0

### Pipeline (`/sales-pipeline`)
- Primary Source: HubSpot deal/contact lifecycle
- Secondary: CallGear call outcome reconciliation
- Required Fields: stage, owner, source, status, timestamps
- Join Keys: `hubspot_contact_id`, `deal_id`, `owner_id`
- Freshness SLA: <= 15m
- Failure Policy: missing owner/status flagged row-level
- Source Badge: `HubSpot`
- Current Gaps: stage/status completeness and owner drift
- Priority: P1

### Revenue (`/revenue`)
- Primary Source: Stripe + HubSpot closed-won linkage
- Secondary: package value fallback
- Required Fields: paid_amount, currency, date, deal/client linkage
- Join Keys: `stripe_customer_id`, `hubspot_contact_id`, `deal_id`
- Freshness SLA: <= 24h
- Failure Policy: show unlinked payment bucket
- Source Badge: `Stripe + HubSpot`
- Current Gaps: backfill completeness
- Priority: P1

### Attribution (`/attribution`)
- Primary Source: attribution marts (Meta+HubSpot)
- Secondary: marketing fallback
- Required Fields: source, medium, campaign, conversion outcome
- Join Keys: `lead_id`, `contact_id`, `campaign_id`
- Freshness SLA: <= 24h
- Failure Policy: unresolved attribution bucket
- Source Badge: `Meta + HubSpot`
- Current Gaps: route currently shared with marketing page
- Priority: P1

### Clients (`/clients`)
- Primary Source: AWS-derived activity + health canonical layer
- Secondary: HubSpot enrichment fields
- Required Fields: health score/tier, sessions_30d, cancel_rate, owner
- Join Keys: `client_id`, `hubspot_contact_id`
- Freshness SLA: <= 24h
- Failure Policy: stale badge + last update shown
- Source Badge: `AWS-derived`
- Current Gaps: schema-contract drift history
- Priority: P0

### Coaches (`/coaches`)
- Primary Source: AWS coach activity + GPS/trust layers
- Secondary: call/revenue overlays
- Required Fields: active_load, cancel_rate, trust_score, sessions_14d
- Join Keys: `coach_id`, `coach_name_normalized`, `date`
- Freshness SLA: <= 24h
- Failure Policy: unknown mappings explicitly flagged
- Source Badge: `AWS + GPS`
- Current Gaps: location normalization quality (`UNKNOWN`)
- Priority: P1

### Risks (`/interventions`)
- Primary Source: intervention engine output
- Secondary: direct risk query
- Required Fields: risk_type, severity, owner, due_date
- Join Keys: `entity_id`, `risk_id`
- Freshness SLA: <= 24h
- Failure Policy: unresolved queue fallback
- Source Badge: `Supabase Risk Engine`
- Current Gaps: contract not fully documented
- Priority: P2

### Daily Ops (`/daily-ops`)
- Primary Source: ops snapshot table/view
- Secondary: reconstructed metrics if snapshot missing
- Required Fields: snapshot_date, summary KPIs, anomalies
- Join Keys: `snapshot_date`
- Freshness SLA: daily (<= 24h)
- Failure Policy: explicit “no snapshot” state, no null crash
- Source Badge: `Supabase Ops Snapshot`
- Current Gaps: historical null `snapshot_date` failures
- Priority: P0

### Client Activity (`/client-activity`)
- Primary Source: AWS sessions + package remaining
- Secondary: HubSpot touchpoint overlays
- Required Fields: recent sessions, no-show/cancel flags, package status
- Join Keys: `client_id`, `date`
- Freshness SLA: <= 24h
- Failure Policy: table still renders if enrichment missing
- Source Badge: `AWS-derived`
- Current Gaps: field contract inconsistencies
- Priority: P1

### Predictions (`/predictions`)
- Primary Source: prediction engine outputs
- Secondary: default risk tiers
- Required Fields: risk_score, confidence, reason factors
- Join Keys: `client_id`, `model_version`, `score_date`
- Freshness SLA: daily
- Failure Policy: confidence + stale warning
- Source Badge: `Supabase Predictions`
- Current Gaps: factor null safety still needs audit
- Priority: P1

### Alert Center (`/alert-center`)
- Primary Source: alert engine queue
- Secondary: rule-generated live alert fallback
- Required Fields: alert_type, severity, entity, created_at, status
- Join Keys: `alert_id`, `entity_id`
- Freshness SLA: near real-time (<= 15m)
- Failure Policy: open alerts fallback list
- Source Badge: `Supabase Alerts`
- Current Gaps: mixed-source confidence labeling
- Priority: P1

### Coach GPS (`/coach-locations`)
- Primary Source: TinyMDM-derived `mdm_*` + visit builder outputs
- Secondary: AWS session window crosscheck
- Required Fields: lat/lng/time, visit window, session match status
- Join Keys: `device_id`, `coach_id`, `timestamp`
- Freshness SLA: <= 6h (cron cadence)
- Failure Policy: no-map-data state + stale age
- Source Badge: `TinyMDM + AWS`
- Current Gaps: naming/location normalization edges
- Priority: P1

### Meta Ads (`/meta-ads`)
- Primary Source: Meta MCP
- Secondary: cached ads mart
- Required Fields: spend, impressions, leads, CPL, ROAS, campaign hierarchy
- Join Keys: `campaign_id`, `adset_id`, `ad_id`, `date`
- Freshness SLA: <= 6h
- Failure Policy: partial campaign rendering allowed
- Source Badge: `Meta`
- Current Gaps: depends on token/connection health
- Priority: P1

### Lead Tracking / Follow-Up (`/lead-tracking`, `/lead-follow-up` redirect)
- Primary Source: HubSpot contacts/deals + owner metadata
- Secondary: CallGear call recency overlays
- Required Fields: lead status, owner, source, stage, last call, follow-up due
- Join Keys: `hubspot_contact_id`, `phone`, `deal_id`
- Freshness SLA: <= 15m
- Failure Policy: orphan contacts/deals explicitly listed
- Source Badge: `HubSpot (+CallGear)`
- Current Gaps: status coverage gaps + deal association gaps
- Priority: P0

### Attribution Leaks / Workflow Strategy (redirects)
- Primary Source: attribution reconciliation + workflow performance marts
- Secondary: command center summaries
- Required Fields: leak_count, root_cause, workflow step outcomes
- Join Keys: `contact_id`, `deal_id`, `workflow_id`
- Freshness SLA: daily
- Failure Policy: redirect page must display ownership badge
- Source Badge: `Attribution/Workflow`
- Current Gaps: hidden via redirects without explicit ownership labels
- Priority: P2

---

## MORE GROUP

### Sales Tracker (`/sales-tracker`)
- Primary Source: HubSpot closed-won + setter metrics
- Secondary: AWS coach activity overlays
- Current Gaps: month-over-month context clarity when previous=0
- Priority: P1

### Call Analytics / Call Deep Dive (`/calls`, `/enterprise/call-analytics`)
- Primary Source: CallGear event truth
- Secondary: HubSpot call outcomes
- Current Gaps: recording coverage and call outcome reconciliation
- Priority: P0

### Setter Command (`/setter-command-center`)
- Primary Source: HubSpot + call cadence metrics
- Secondary: internal delegation analytics
- Current Gaps: owner/contact integrity checks
- Priority: P1

### War Room / Audit Trail / Strategy / System Health / Health Detail / Coach Stats
- Primary Source: Supabase canonical marts and operational telemetry
- Secondary: direct source fallbacks by module
- Current Gaps: documentation + source badges consistency
- Priority: P1/P2

---

## Next Research Deliverable
- `REGRESSION-FIX-LOG.md` with evidence-linked P0/P1 queue (no implementation entries yet).
