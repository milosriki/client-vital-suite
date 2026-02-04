# Deployment Guide

Step-by-step deployment for WhatsApp-NLP-CRM integration with different provider combinations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option 1: HubSpot + Dialogflow](#option-1-hubspot--dialogflow-current-setup)
3. [Option 2: AISensy + Dialogflow + HubSpot](#option-2-aisensy--dialogflow--hubspot)
4. [Option 3: Provider-Agnostic (Recommended)](#option-3-provider-agnostic-recommended)
5. [Troubleshooting](#troubleshooting)
6. [Monitoring](#monitoring)
7. [Rollback](#rollback)
8. [Scaling](#scaling)

## Prerequisites

- Supabase project
- HubSpot account (for CRM)
- Google Cloud project (for Dialogflow)
- WhatsApp provider account (HubSpot/AISensy/KASPO)

## Option 1: HubSpot + Dialogflow (Current Setup)

### Step 1: HubSpot Configuration

```bash
# Get API key from HubSpot
# Settings → Integrations → Private Apps → Create

export HUBSPOT_API_KEY=pat-xxx
```

### Step 2: Dialogflow Setup

```bash
# Create Dialogflow ES agent
# Import intents from .agent/skills/skills/whatsapp-nlp-crm/references/dialogflow_intents.md

# Create service account
gcloud iam service-accounts create dialogflow-whatsapp
gcloud iam service-accounts keys create dialogflow-key.json \
  --iam-account=dialogflow-whatsapp@PROJECT_ID.iam.gserviceaccount.com

# Set Supabase secrets
supabase secrets set DIALOGFLOW_PROJECT_ID=your-project
supabase secrets set DIALOGFLOW_CREDENTIALS=$(cat dialogflow-key.json | base64)
```

### Step 3: Deploy Edge Functions

```bash
# Deploy webhook receiver
supabase functions deploy hubspot-webhook-receiver

# Deploy message sender
supabase functions deploy send-hubspot-message

# Get webhook URL
echo "https://your-project.supabase.co/functions/v1/hubspot-webhook-receiver"
```

### Step 4: Configure HubSpot Webhook

1. Go to HubSpot → Settings → Data Management → Webhooks
2. Create webhook subscription
3. URL: Your Edge Function URL
4. Subscribe to events:
   - `conversation.newMessage` (incoming messages)
   - `conversation.creation` (new conversations)

### Step 5: Test

```bash
# Send test message via HubSpot inbox
# Should trigger webhook → Dialogflow → AI response → HubSpot reply
```

## Option 2: AISensy + Dialogflow + HubSpot

### Step 1: AISensy Configuration

```bash
# Get API key from AISensy dashboard
# Settings → API Configuration

export AISENSY_API_KEY=xxx
export AISENSY_WEBHOOK_SECRET=xxx
```

### Step 2: Dialogflow Setup

Same as Option 1 (reuse Dialogflow agent)

### Step 3: Create Provider Classes

```bash
# Create provider abstraction
mkdir -p supabase/functions/_shared/providers

# Copy templates from references/provider_abstraction.md
# - providers/whatsapp_provider.ts
# - providers/aisensy_provider.ts
# - providers/factory.ts
```

### Step 4: Deploy Universal Webhook

```bash
# Create new webhook receiver
cat > supabase/functions/whatsapp-webhook-receiver/index.ts <<'EOF'
import { createWhatsAppProvider } from '../_shared/providers/factory.ts';
import { detectIntent } from '../_shared/dialogflow.ts';

Deno.serve(async (req) => {
  const provider = createWhatsAppProvider();
  const message = await provider.receiveWebhook(await req.json());
  const intent = await detectIntent(message.text, message.phone);
  const response = await generateResponse(intent, message);
  await provider.sendMessage(message.phone, response);
  return new Response('OK');
});
EOF

supabase functions deploy whatsapp-webhook-receiver
```

### Step 5: Configure AISensy Webhook

1. AISensy Dashboard → Settings → Webhook
2. URL: `https://your-project.supabase.co/functions/v1/whatsapp-webhook-receiver`
3. Events: `message.received`

### Step 6: Set Provider

```bash
supabase secrets set WHATSAPP_PROVIDER=aisensy
supabase secrets set AISENSY_API_KEY=xxx
supabase secrets set AISENSY_WEBHOOK_SECRET=xxx
```

### Step 7: Test

```bash
# Send WhatsApp message to your AISensy number
# Should trigger: AISensy webhook → Dialogflow → AI response → AISensy API
```

## Option 3: Provider-Agnostic (Recommended)

Combines Option 1 and Option 2 with runtime provider switching.

### Step 1: Deploy All Providers

```bash
# Create all provider implementations
# - HubSpotProvider
# - AISensyProvider
# - KASPOProvider (template)

# Deploy universal webhook
supabase functions deploy whatsapp-webhook-receiver
```

### Step 2: Configure All Providers

```bash
# Set all credentials
supabase secrets set HUBSPOT_API_KEY=xxx
supabase secrets set AISENSY_API_KEY=xxx
supabase secrets set AISENSY_WEBHOOK_SECRET=xxx
supabase secrets set KASPO_API_KEY=xxx
```

### Step 3: Switch Providers

```bash
# Use HubSpot
supabase secrets set WHATSAPP_PROVIDER=hubspot

# Or use AISensy
supabase secrets set WHATSAPP_PROVIDER=aisensy

# Redeploy (picks up new provider)
supabase functions deploy whatsapp-webhook-receiver
```

### Step 4: Multi-Provider Routing (Advanced)

```typescript
// Use different providers for different features
export function selectProvider(feature: string): WhatsAppProvider {
  if (feature === "payment" || feature === "catalogue") {
    return new AISensyProvider(); // AISensy has these features
  }
  return new HubSpotProvider(); // Default to HubSpot for reliability
}
```

## Common Issues

### Issue: Dialogflow not detecting intents

**Solution**:

```bash
# Check credentials
supabase secrets get DIALOGFLOW_PROJECT_ID
supabase secrets get DIALOGFLOW_CREDENTIALS

# Test intent detection locally
deno run scripts/test_dialogflow.ts "I want to book"
```

### Issue: HubSpot webhook not receiving messages

**Solution**:

1. Check webhook subscription is active
2. Verify URL is correct
3. Check HubSpot webhook logs
4. Test with curl:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/hubspot-webhook-receiver \
  -H "Content-Type: application/json" \
  -d '[{"messageId":"test","threadId":"123","messageText":"hello"}]'
```

### Issue: AISensy signature verification failing

**Solution**:

```bash
# Verify webhook secret matches
supabase secrets get AISENSY_WEBHOOK_SECRET

# Check signature header name (X-Signature or X-AISensy-Signature)
```

## Monitoring

### Edge Function Logs

```bash
# Real-time logs
supabase functions logs whatsapp-webhook-receiver --tail

# Filter errors
supabase functions logs whatsapp-webhook-receiver --level error
```

### HubSpot Activity

```bash
# Check contact was created
# HubSpot → Contacts → Search by phone

# Check deal was created
# HubSpot → Deals → Filter by "WhatsApp"

# Check conversation history
# HubSpot → Conversations → Inbox
```

### Dialogflow Analytics

```bash
# Go to Dialogflow Console → Analytics
# Check:
# - Intent detection accuracy
# - Fallback intent frequency
# - Session duration
```

## Rollback

### Revert to Previous Version

```bash
# List deployments
supabase functions list

# Rollback specific function
supabase functions deploy whatsapp-webhook-receiver --version previous
```

### Emergency Disable

```bash
# Pause all webhooks
supabase secrets set WEBHOOK_ENABLED=false

# Or switch to fallback provider
supabase secrets set WHATSAPP_PROVIDER=hubspot
```

## Scaling

### High Volume (>1000 messages/day)

```bash
# Enable caching
supabase secrets set ENABLE_REDIS_CACHE=true
supabase secrets set REDIS_URL=redis://xxx

# Rate limiting
supabase secrets set RATE_LIMIT_PER_MINUTE=60
```

### Multi-Region

```bash
# Deploy to multiple Supabase regions
# Use Cloudflare Workers for routing
```

## Checklist

- [ ] Dialogflow agent created with intents
- [ ] Service account key generated
- [ ] Supabase secrets configured
- [ ] Edge functions deployed
- [ ] Provider webhook configured
- [ ] Test message sent successfully
- [ ] HubSpot contact created
- [ ] Intent detected correctly
- [ ] AI response generated
- [ ] Reply sent via provider
- [ ] Monitoring enabled
- [ ] Rollback plan documented

## Status

**HubSpot Deployment**: ✅ Production
**AISensy Deployment**: ⏳ Testing
**Provider Abstraction**: ⏳ In Progress
