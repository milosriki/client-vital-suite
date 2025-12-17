# Client Vital Suite - System Status

> Single source of truth. Run `./check-cli-connections.sh` to verify.

## Quick Commands
```bash
# Verify everything
./check-cli-connections.sh

# Deploy everything
vercel --prod && ./deploy-all-functions.sh

# Test endpoints
curl https://client-vital-suite.vercel.app/api/health
```

## Component Status

| Component | Count | Verify Command |
|-----------|-------|----------------|
| Supabase Functions | 80+ | `supabase functions list` |
| Vercel API Routes | 4 | `curl .../api/health` |
| MCP Servers | 4 | See `mcp.json` |
| Database Tables | 30+ | Supabase Dashboard |

## MCP Servers (mcp.json)

| Server | Package | Tools |
|--------|---------|-------|
| hubspot-advanced | Local server | ~90 |
| supabase | @supabase/mcp-server-supabase | ~50 |
| firebase | firebase-tools experimental:mcp | ~40 |
| vercel | vercel-mcp-server | ~30 |

## Key Integrations

| Integration | Status | Secret Key |
|-------------|--------|------------|
| HubSpot | Portal 7973797 | `HUBSPOT_API_KEY` |
| Stripe | Connected | `STRIPE_SECRET_KEY` |
| Meta CAPI | Via Stape | `FB_ACCESS_TOKEN` |
| Supabase | ztjndilxurtsfqdsvfds | Auto-provided |

## Data Flow
```
HubSpot/Stripe/CallGear → Webhooks → Supabase Functions → Database
                                                              ↓
                                         AI Agents ← RAG/Memory
                                              ↓
                                    Frontend Dashboard (Vercel)
```

## If Something Breaks

1. Run `./check-cli-connections.sh` - fixes 90% of issues
2. Re-deploy: `vercel --prod` (frontend) + `./deploy-all-functions.sh` (backend)
3. Check secrets in Supabase Dashboard → Edge Functions → Secrets
