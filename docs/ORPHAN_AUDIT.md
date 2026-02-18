# Orphan Edge Function Audit

**Date**: 2026-02-18  
**Total orphaned functions**: 44 (0 frontend references in `src/`)  
**Method**: `grep -r` across `src/**/*.ts(x)` + content inspection for webhook/cron/POST patterns

## Classification

### ✅ KEEP — Webhook / Cron / Integration Endpoints (16)

These have no frontend refs but are invoked externally (webhooks, crons, integrations):

| Function | Reason |
|---|---|
| `aisensy-orchestrator` | WhatsApp/AiSensy webhook handler |
| `antigravity-followup-engine` | Cron-triggered follow-up engine |
| `appointment-manager` | Webhook for appointment events |
| `aws-backoffice-sync` | Cron/webhook: AWS data sync |
| `daily-command-briefing` | Cron: daily CEO briefing |
| `fetch-facebook-leads` | Cron: Facebook lead ingestion |
| `followup-cron` | Cron: follow-up scheduler |
| `hubspot-webhook-receiver` | HubSpot webhook endpoint |
| `marketing-agent-validator` | Webhook: marketing validation |
| `ptd-atlas-trigger` | Cron/webhook trigger for Atlas |
| `rds-data-analyst` | Cron: RDS analytics pipeline |
| `send-hubspot-message` | Integration: HubSpot messaging |
| `sync-single-contact` | Integration: single contact sync |
| `ad-creative-analyst` | Webhook: ad creative analysis |
| `backfill-contacts` | Cron: contact backfill |
| `backfill-customers` | Cron: customer backfill |

### ⚠️ KEEP (REVIEW) — Agent Sub-functions (10)

Called by orchestrator or other edge functions, not directly from frontend:

| Function | Reason |
|---|---|
| `error-resolution-agent` | Sub-agent: auto error resolution |
| `multi-agent-orchestrator` | Core orchestrator for agent system |
| `ptd-agent-atlas` | Atlas CEO intelligence agent |
| `marketing-allocator` | Sub-agent: budget allocation |
| `marketing-analyst` | Sub-agent: marketing analysis |
| `marketing-historian` | Sub-agent: historical marketing data |
| `marketing-scout` | Sub-agent: market intelligence |
| `sales-objection-handler` | Sub-agent: sales objection handling |
| `weekly-ceo-report` | Scheduled report generator |
| `funnel-stage-tracker` | Pipeline stage tracking logic |

### 🗄️ ARCHIVE — One-time / Dead Code (18)

Safe to archive. These are setup scripts, backfills, or test utilities:

| Function | Reason |
|---|---|
| `backfill-deal-contacts` | One-time backfill (completed) |
| `backfill-deals-history` | One-time backfill (completed) |
| `debug-deploy` | Debug/test utility |
| `dedup-contacts` | One-time deduplication script |
| `deno.json` | Not a function (config file) |
| `hubspot-owner-intelligence` | Superseded by Atlas agent |
| `migrate-knowledge` | One-time migration script |
| `populate-baselines` | One-time data population |
| `populate-loss-analysis` | One-time data population |
| `schema-fixer` | One-time schema repair |
| `seed-knowledge` | One-time seed script |
| `setup-db` | One-time DB setup |
| `stripe-backfill` | One-time Stripe data backfill |
| `sync-hubspot-contacts` | Superseded by sync-single-contact |
| `sync-single-call` | One-time sync utility |
| `test-boot` | Test/debug utility |
| `track-assessment-outcome` | Unused assessment tracker |
| `validate-truth` | One-time validation utility |

## Recommendations

1. **Move ARCHIVE functions** to `supabase/functions/_archive/` when ready
2. **Review KEEP (REVIEW)** functions — confirm they're still called by orchestrator
3. **No deletions** — archive only, preserve git history
