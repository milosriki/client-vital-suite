# Vercel API Agent Proxy Setup

## Overview

Created `/api/agent.ts` to proxy agent requests through Vercel, enabling:
- ✅ **Vercel logs visibility** - See all agent calls in Vercel dashboard
- ✅ **Single endpoint** - Frontend calls `/api/agent` instead of Supabase directly
- ✅ **Server-side secrets** - Uses `SUPABASE_SERVICE_ROLE_KEY` (never exposed to browser)
- ✅ **No VITE_* vars** - All secrets are server-only

## Setup Instructions

### 1. Set Environment Variables in Vercel

Go to Vercel Dashboard → Project → Settings → Environment Variables:

```
SUPABASE_URL=https://ztjndilxurtsfqdsvfds.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important:** These are server-only variables. Do NOT use `VITE_*` prefix.

### 2. Deploy to Vercel

The API route will be automatically deployed with your next Vercel deployment:

```bash
git add api/agent.ts
git commit -m "feat: add Vercel API proxy for agent"
git push
```

### 3. Update Frontend (Optional)

Currently, frontend calls Supabase directly:
```typescript
await supabase.functions.invoke("ptd-agent-claude", { ... })
```

To use the Vercel proxy instead:
```typescript
const response = await fetch('/api/agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userMessage,
    thread_id: threadId,
    messages: chatHistory // optional
  })
});

const data = await response.json();
```

## API Endpoint

**URL:** `POST /api/agent`

**Request Body:**
```json
{
  "message": "Your question here",
  "thread_id": "optional-thread-id",
  "messages": [] // optional chat history
}
```

**Response:**
```json
{
  "response": "AI agent response text",
  "duration_ms": 1234
}
```

## Benefits

1. **Vercel Logs** - All agent calls appear in Vercel dashboard logs
2. **Security** - Service role key never exposed to browser
3. **Monitoring** - Easy to track usage, errors, and performance
4. **Flexibility** - Can add rate limiting, caching, or other middleware

## Current Status

- ✅ API route created: `api/agent.ts`
- ✅ TypeScript types: Uses `@vercel/node` (already installed)
- ⚠️ Environment variables: Need to be set in Vercel dashboard
- ⚠️ Frontend: Still using direct Supabase calls (can be updated later)

## Testing

After deployment, test the endpoint:

```bash
curl -X POST https://your-app.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, agent!"}'
```

## Logs Location

View logs in Vercel Dashboard:
- Project → Deployments → [Latest] → Functions → `/api/agent`

Or via CLI:
```bash
vercel logs --follow
```

