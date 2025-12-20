# Client Vital Suite - Agentic Intelligence Platform

This project is a comprehensive **Agentic AI Platform** for Personal Trainers Dubai (PTD), designed to automate business intelligence, client health tracking, and sales operations.

It has been migrated from a legacy n8n-based architecture to a fully serverless **Supabase Edge Functions** architecture.

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
- **Edge Functions**: Deno/TypeScript serverless functions replacing all n8n workflows.
- **Automation**: `pg_cron` handles all scheduled tasks (daily health scores, syncs, reports).

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

> ⚠️ **Important**: After changing environment variables, you must **redeploy** the Vercel project for changes to take effect. Push a commit or trigger a manual redeploy from the Vercel dashboard.

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

## 📊 Dashboards

- **/dashboard**: Main Executive View (Health, Revenue, Alerts)
- **/meta-dashboard**: Live Facebook Ads Performance (Spend vs ROAS)
- **/sales-pipeline**: HubSpot Funnel & Call Tracking
- **/stripe-intelligence**: Financial Forensics & Payouts

## 🔄 Legacy Migration Note

**n8n has been completely removed.** All workflows (Daily Calculator, Monthly Coach Review, etc.) now run natively on Supabase.

- **Old**: n8n Webhook -> Postgres
- **New**: pg_cron -> Edge Function -> Postgres

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

### VSCode MCP Tool Validation Error

If you encounter this error in VSCode:

```
Failed to validate tool mcp_hubspot-advan_hubspot_create_engagement: Error: tool parameters array type must have items.
```

This is an MCP (Model Context Protocol) server configuration issue. See our detailed fix guides:

- **Quick Fix**: [QUICK_FIX_MCP_HUBSPOT.md](./QUICK_FIX_MCP_HUBSPOT.md)
- **Comprehensive Guide**: [MCP_HUBSPOT_FIX.md](./MCP_HUBSPOT_FIX.md)
- **Example Config**: [.vscode/mcp-config-example.json](./.vscode/mcp-config-example.json)

**TL;DR**: The error means an MCP tool has an array parameter without the required `items` property in its JSON schema. Check your VSCode MCP configuration and ensure all array-type parameters include an `items` definition.

### Other Common Issues

- **Build Failures**: Run `npm install` to ensure all dependencies are installed
- **Supabase Connection**: Check environment variables in `.env`
- **Edge Function Errors**: Check logs in Supabase Dashboard > Edge Functions
