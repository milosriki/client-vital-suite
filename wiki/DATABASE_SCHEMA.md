# Database Schema — Key Tables & Views (Live Data)

## Core Tables
- `client_health_scores` — daily scores, zones, churn risk
- `contacts` — HubSpot contact properties
- `deals` — pipeline data
- `appointments` — scheduled bookings
- `call_records` — call tracking + transcripts
- `intervention_log` — interventions and outcomes

## Marketing & Attribution
- `attribution_events`, `facebook_ads_insights`, `facebook_campaigns`, `events`, `ultimate_truth_events`, `capi_events`

## Financial/Stripe
- `stripe_events`, `stripe_transactions`, `stripe_invoices`, `stripe_subscriptions`, `stripe_refunds`, `fraud_alerts`

## AI & Knowledge
- `agent_memory`, `agent_patterns`, `knowledge_base`, `knowledge_documents`, `proactive_insights`, `prepared_actions`

## Analytics Views
- `company_health_aggregates`, `at_risk_clients`, `coach_leaderboard`, `lead_lifecycle_view`, `ultimate_truth_dashboard`

## Scheduling Infrastructure
- `pg_cron` jobs for health scoring (9AM), Stripe forensics (2AM), BI aggregation (3AM), daily reports (6PM), hourly ultimate-truth alignment.

All data is live; no mock tables are referenced in production dashboards or agents.
