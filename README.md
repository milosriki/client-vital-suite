# Client Vital Suite - Agentic Intelligence Platform

This project is a comprehensive **Agentic AI Platform** for Personal Trainers Dubai (PTD), designed to automate business intelligence, client health tracking, and sales operations.

Built with a fully serverless **Supabase Edge Functions** architecture.

## 🚀 Key Features

- **Agentic Core**: 53+ specialized AI agents running on Supabase Edge Functions.
- **Live Dashboards**: Real-time React frontend for monitoring business health.
- **Facebook Ads Integration**: Live ad spend, ROAS, and performance tracking (Direct Marketing API).
- **HubSpot Sync**: Two-way sync for contacts, deals, and activities.
- **Stripe Intelligence**: Fraud detection and payout analysis.
- **Voice Chat**: Talk directly to your business data using Web Speech API.

## 🏗 Architecture

### Frontend

- **Framework**: React + Vite + TypeScript
- **UI Library**: Shadcn/ui + Tailwind CSS
- **Hosting**: Vercel (recommended) or any static host

### Backend (Supabase)

- **Database**: PostgreSQL with pgvector for AI memory.
- **Edge Functions**: 69+ Deno/TypeScript serverless functions.
- **Automation**: `pg_cron` handles all scheduled tasks (daily health scores, syncs, reports).

### Architecture: Living Being

This application uses a **"Living Being" architecture** where the UI behaves as a unified organism that responds to data changes in real-time, rather than constantly polling the database.

**How it works:**
-   **Real-time WebSockets**: Supabase RealtimeChannel subscriptions listen for database changes on critical tables (client_health_scores, deals, intervention_log, sync_errors, sync_logs, contacts, call_records, daily_summary).
-   **Central State Hook**: The `useVitalState` hook (initialized in `Layout.tsx`) manages all real-time subscriptions globally and automatically invalidates React Query cache when data changes.
-   **Instant UI Updates**: When data changes in the database, the UI updates instantly without requiring a page refresh or manual polling.

**Key Benefits:**
-   Reduced database load (no constant polling)
-   Instant UI feedback when data changes
-   Better user experience with real-time updates
-   Lower infrastructure costs

**DO NOT ADD `refetchInterval` TO QUERIES.**

All queries should use `staleTime: Infinity` and rely on the real-time subscriptions to handle cache invalidation. See `src/config/queryConfig.ts` for configuration details and examples.

## 🤖 Active Agents & Functions

| Function                  | Purpose                                        | Schedule   |
| :------------------------ | :--------------------------------------------- | :--------- |
| `health-calculator`       | Calculates client health scores (0-100)        | Daily 9 AM |
| `fetch-facebook-insights` | Syncs ad spend & ROAS from Meta                | Daily 2 AM |
| `business-intelligence`   | Aggregates daily KPIs                          | Daily 3 AM |
| `daily-report`            | Generates & sends executive summary            | Daily 6 PM |
| `agent-analyst`           | On-demand business analyst (Claude 3.5 Sonnet) | On Request |
| `stripe-forensics`        | Detects payout anomalies & fraud               | On Request |
| `callgear-sentinel`       | Real-time call monitoring & anti-fraud         | Webhook    |

## 🛠 Setup & Deployment

### 1. Prerequisites

- Supabase Project
- Facebook Marketing API Token
- HubSpot API Key
- Stripe Secret Key
- Anthropic API Key (for Claude agents)

### 2. Environment Variables (Supabase Secrets)

Set these in your Supabase Dashboard > Edge Functions > Secrets:

```bash
FB_ACCESS_TOKEN=...
FB_AD_ACCOUNT_ID=...
HUBSPOT_API_KEY=...
STRIPE_SECRET_KEY=...
ANTHROPIC_API_KEY=...
```

### LangSmith tracing (LangChain)

- Tracing for the super-agent orchestrator is the only place we call the LangSmith API (`supabase/functions/super-agent-orchestrator/index.ts` hits `https://api.smith.langchain.com`).
- To activate it, add `LANGSMITH_API_KEY` as a secret on the `super-agent-orchestrator` function (optionally set `LANGSMITH_PROJECT`/`LANGSMITH_ENDPOINT` if you use a custom workspace).
- If the key is absent, the function runs without sending any LangSmith traces.

### 3. Vercel Environment Variables

Set these in Vercel Dashboard > Project Settings > Environment Variables:

**Frontend (build-time):**

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

**Server-side (API routes):**

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> ⚠️ **Important**: After any env var change in Vercel, a **redeploy is required** for the new values to apply (push a commit or trigger a manual redeploy).

### 4. Deploy Functions

```bash
supabase functions deploy --no-verify-jwt
```

### 5. Deploy Database

```bash
supabase db push
```

### 6. Verify Deployment

After deployment, verify everything is wired correctly:

```bash
curl https://client-vital-suite.vercel.app/api/system-check
```

This endpoint checks:

- All required environment variables exist
- Supabase database connection works
- Edge Functions are reachable
- No localhost references in production URLs

### LangGraph Cloud deployments

- LangGraph Cloud requires a `langgraph.json` file in the repo root to discover your agent server entrypoint.
- This repo uses the existing `/api/agent` proxy as the default entrypoint. If you wire up a dedicated LangGraph agent server later, update `langgraph.json` with the new path (for example, `src/agents/server.ts:app`).
- Redeploy after editing `langgraph.json` so the LangGraph dashboard sees the config.

## 📊 Dashboards

- **/dashboard**: Main Executive View (Health, Revenue, Alerts)
- **/meta-dashboard**: Live Facebook Ads Performance (Spend vs ROAS)
- **/sales-pipeline**: HubSpot Funnel & Call Tracking
- **/stripe-intelligence**: Financial Forensics & Payouts

## 🔄 Architecture

All workflows run natively on Supabase via `pg_cron` scheduled tasks:

- **Scheduled Jobs**: pg_cron triggers Edge Functions for daily health scores, syncs, and reports
- **Real-time**: Supabase Realtime for live dashboard updates
- **AI Agents**: 5 specialized AI personas (ATLAS, SHERLOCK, REVENUE, HUNTER, GUARDIAN)

## 🤝 Support

For issues with the AI agents, check the `function_logs` in Supabase.

## 🔧 Troubleshooting

### Mock/Test Data in Production

If you see test data (emails like <test@example.com> or <fake@email.com>) on your production deployment:

1. Visit the Dashboard at `/dashboard` or `/overview`
2. Look for the amber "Test/Mock Data Detected" alert banner
3. Click "Clear & Sync from HubSpot" to remove test data and sync real data
4. Wait 10-30 seconds for the sync to complete

See [MOCK_DATA_CLEANUP_GUIDE.md](./MOCK_DATA_CLEANUP_GUIDE.md) for detailed instructions.

### Other Common Issues

- **Build Failures**: Run `npm install` to ensure all dependencies are installed
- **Supabase Connection**: Check environment variables in `.env`
- **Edge Function Errors**: Check logs in Supabase Dashboard > Edge Functions


## GitLens remote access

See [GITLENS_CONNECTION.md](./GITLENS_CONNECTION.md) for instructions to open this repository via GitLens Cloud using workspace ID `dbcfff91-ceb2-4390-9949-c53c7689c8ab`.
