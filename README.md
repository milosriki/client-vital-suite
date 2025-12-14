# Client Vital Suite - Agentic Intelligence Platform

This project is a comprehensive **Agentic AI Platform** for Personal Trainers Dubai (PTD), designed to automate business intelligence, client health tracking, and sales operations.

It has been migrated from a legacy n8n-based architecture to a fully serverless **Supabase Edge Functions** architecture.

## 🚀 Key Features

-   **Agentic Core**: 53+ specialized AI agents running on Supabase Edge Functions.
-   **Live Dashboards**: Real-time React frontend for monitoring business health.
-   **Facebook Ads Integration**: Live ad spend, ROAS, and performance tracking (Direct Marketing API).
-   **HubSpot Sync**: Two-way sync for contacts, deals, and activities.
-   **Stripe Intelligence**: Fraud detection and payout analysis.
-   **Voice Chat**: Talk directly to your business data using Web Speech API.

## 🏗 Architecture

### Frontend
-   **Framework**: React + Vite + TypeScript
-   **UI Library**: Shadcn/ui + Tailwind CSS
-   **Hosting**: Vercel (recommended) or any static host

### Backend (Supabase)
-   **Database**: PostgreSQL with pgvector for AI memory.
-   **Edge Functions**: Deno/TypeScript serverless functions replacing all n8n workflows.
-   **Automation**: `pg_cron` handles all scheduled tasks (daily health scores, syncs, reports).

## 🤖 Active Agents & Functions

| Function | Purpose | Schedule |
| :--- | :--- | :--- |
| `health-calculator` | Calculates client health scores (0-100) | Daily 9 AM |
| `fetch-facebook-insights` | Syncs ad spend & ROAS from Meta | Daily 2 AM |
| `business-intelligence` | Aggregates daily KPIs | Daily 3 AM |
| `daily-report` | Generates & sends executive summary | Daily 6 PM |
| `agent-analyst` | On-demand business analyst (Claude 3.5 Sonnet) | On Request |
| `stripe-forensics` | Detects payout anomalies & fraud | On Request |
| `callgear-sentinel` | Real-time call monitoring & anti-fraud | Webhook |

## 🛠 Setup & Deployment

### 1. Prerequisites
-   Supabase Project
-   Facebook Marketing API Token
-   HubSpot API Key
-   Stripe Secret Key
-   Anthropic API Key (for Claude agents)

### 2. Environment Variables (Supabase Secrets)
Set these in your Supabase Dashboard > Edge Functions > Secrets:

```bash
FB_ACCESS_TOKEN=...
FB_AD_ACCOUNT_ID=...
HUBSPOT_API_KEY=...
STRIPE_SECRET_KEY=...
ANTHROPIC_API_KEY=...
```

### 3. Deploy Functions
```bash
supabase functions deploy --no-verify-jwt
```

### 4. Deploy Database
```bash
supabase db push
```

## 📊 Dashboards

-   **/dashboard**: Main Executive View (Health, Revenue, Alerts)
-   **/meta-dashboard**: Live Facebook Ads Performance (Spend vs ROAS)
-   **/sales-pipeline**: HubSpot Funnel & Call Tracking
-   **/stripe-intelligence**: Financial Forensics & Payouts

## 🔄 Legacy Migration Note
**n8n has been completely removed.** All workflows (Daily Calculator, Monthly Coach Review, etc.) now run natively on Supabase.
-   **Old**: n8n Webhook -> Postgres
-   **New**: pg_cron -> Edge Function -> Postgres

## 🤝 Support
For issues with the AI agents, check the `function_logs` in Supabase.
