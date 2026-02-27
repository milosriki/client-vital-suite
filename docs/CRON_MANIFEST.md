# CRON MANIFEST — Client Vital Suite
> Source of truth for all pg_cron scheduled jobs
> Updated: 2026-02-27

## Active Cron Jobs

| Job Name | Schedule | Dubai Time | Edge Function | Purpose | Migration |
|----------|----------|------------|---------------|---------|-----------|
| `health-calculator` | `*/30 * * * *` | Every 30 min | `calculate-health-scores` | Legacy health scoring (TO BE DEPRECATED → `health-score-engine`) | 20251219 |
| `daily-health-score-calculator` | `0 2 * * *` | 06:00 AM | `health-score-engine` | v2 health scoring (5D RFM+) | 20251225 |
| `churn-predictor` | `30 2 * * *` | 06:30 AM | `ml-churn-score` | Sigmoid ML churn prediction | 20251219 |
| `ptd-self-learn` | `0 2 * * *` | 06:00 AM | `client-intelligence-engine` | Self-learning pattern detection | 20251219 |
| `ptd-24x7-monitor` | `*/5 * * * *` | Every 5 min | System health check | Uptime + sync error monitor | 20251219 |
| `daily-settings-check` | `5 3 * * *` | 07:05 AM | Settings validator | Verify app.settings are intact | 20251219 |
| `daily-business-intelligence` | `0 3 * * *` | 07:00 AM | `ai-ceo-master` | Executive briefing generation | 20251210 |
| `lead-reply-generator` | `0 */2 * * *` | Every 2 hours | `proactive-insights-generator` | Auto-generate lead reply scripts | 20251210 |
| `hourly-hubspot-sync` | `15 * * * *` | :15 past every hour | `hubspot-webhook` | HubSpot contact sync | 20251210 |
| `fetch-callgear-data` | `0 22 * * *` | 02:00 AM+1 | `fetch-callgear-data` | Daily call log pull | 20260203 |
| `sync-hubspot-daily-safety` | `0 23 * * *` | 03:00 AM+1 | HubSpot full sync | Safety net daily sync | 20260203 |
| `gps-pull-every-6h` | `0 */6 * * *` | Every 6 hours | GPS data pull | TinyMDM GPS ingestion | 20260224 |
| `gps-pattern-daily` | `0 22 * * *` | 02:00 AM+1 | GPS pattern analysis | Coach location pattern detection | 20260224 |
| `gps-cleanup-90d` | `0 3 * * 0` | Sun 07:00 AM | GPS data cleanup | Remove GPS data >90 days old | 20260224 |
| `gps-dwell-every-6h` | `30 */6 * * *` | Every 6h :30 | GPS dwell analysis | Coach dwell time calculation | 20260224 |

## Known Issues
- **Split-brain**: `health-calculator` (every 30min) and `daily-health-score-calculator` (daily) BOTH run. Only `daily-health-score-calculator` should remain.
- **Overlap**: `ptd-self-learn` and `daily-health-score-calculator` both run at `0 2 * * *` — potential race condition.
- **TODO**: Unschedule `health-calculator` once `health-score-engine` v3 is verified.
