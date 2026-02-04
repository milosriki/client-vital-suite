# HubSpot CRM Integration

Complete guide to syncing WhatsApp conversations with HubSpot CRM for lead tracking and management.

## Table of Contents

1. [Purpose](#purpose)
2. [Contact Sync](#contact-sync)
3. [Deal Creation](#deal-creation)
4. [Conversation Tracking](#conversation-tracking)
5. [Complete Workflow](#complete-workflow)
6. [Custom Properties](#custom-properties)
7. [Best Practices](#best-practices)
8. [Error Handling](#error-handling)
9. [Rate Limits](#rate-limits)

## Purpose

Automatically create and update HubSpot contacts, deals, and conversation history from WhatsApp interactions to maintain complete sales pipeline visibility.

## Contact Sync

### Create/Update Contact from WhatsApp

```typescript
import { Client } from "@hubspot/api-client";

const hubspot = new Client({ accessToken: HUBSPOT_API_KEY });

async function syncWhatsAppContact(
  phone: string,
  data: {
    name?: string;
    intent?: string;
    conversationStage?: string;
    entities?: any;
  },
) {
  const email = `${phone.replace("+", "")}@whatsapp.placeholder.com`;

  // Search for existing contact by phone
  const searchResults = await hubspot.crm.contacts.searchApi.doSearch({
    filterGroups: [
      {
        filters: [
          {
            propertyName: "phone",
            operator: "EQ",
            value: phone,
          },
        ],
      },
    ],
    limit: 1,
  });

  const properties = {
    phone,
    firstname: data.name?.split(" ")[0] || "WhatsApp",
    lastname: data.name?.split(" ").slice(1).join(" ") || "Contact",
    email,
    hs_lead_status: getLeadStatus(data.conversationStage),
    lifecycle_stage: getLifecycleStage(data.intent),
    whatsapp_intent: data.intent,
    whatsapp_stage: data.conversationStage,
  };

  if (searchResults.results.length > 0) {
    // Update existing
    const contactId = searchResults.results[0].id;
    await hubspot.crm.contacts.basicApi.update(contactId, { properties });
    return contactId;
  } else {
    // Create new
    const response = await hubspot.crm.contacts.basicApi.create({ properties });
    return response.id;
  }
}

function getLeadStatus(stage?: string): string {
  const mapping: Record<string, string> = {
    discovery: "NEW",
    qualification: "OPEN",
    objection: "IN_PROGRESS",
    booking: "QUALIFIED",
  };
  return mapping[stage || ""] || "NEW";
}

function getLifecycleStage(intent?: string): string {
  if (intent === "book_appointment") return "opportunity";
  if (intent === "qualify_commitment") return "marketingqualifiedlead";
  return "lead";
}
```

## Deal Creation

### Auto-Create Deal from Booking Intent

```typescript
async function createBookingDeal(
  contactId: string,
  entities: {
    date?: string;
    time?: string;
    goal?: string;
  },
) {
  const dealName = `WhatsApp Booking - ${entities.date || "TBD"}`;

  const deal = await hubspot.crm.deals.basicApi.create({
    properties: {
      dealname: dealName,
      pipeline: "default",
      dealstage: "appointmentscheduled",
      amount: "500", // Default package price
      closedate: formatCloseDate(entities.date),
      service_type: entities.goal || "general_fitness",
      booking_date: entities.date,
      booking_time: entities.time,
    },
    associations: [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 3, // Contact to Deal
          },
        ],
      },
    ],
  });

  return deal.id;
}

function formatCloseDate(date?: string): string {
  if (!date)
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // Parse natural language date and convert to ISO
  return new Date(date).toISOString();
}
```

## Conversation Tracking

### Log WhatsApp Messages as Engagement

```typescript
async function logWhatsAppEngagement(
  contactId: string,
  message: {
    direction: "inbound" | "outbound";
    text: string;
    timestamp: number;
  },
) {
  await hubspot.crm.objects.notes.basicApi.create({
    properties: {
      hs_timestamp: new Date(message.timestamp).toISOString(),
      hs_note_body: formatNote(message),
      hubspot_owner_id: await getBotOwnerId(),
    },
    associations: [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: 202, // Note to Contact
          },
        ],
      },
    ],
  });
}

function formatNote(message: any): string {
  const emoji = message.direction === "inbound" ? "📥" : "📤";
  return `${emoji} **WhatsApp Message**\n\n${message.text}\n\n---\n*Via AI Sales Agent*`;
}

async function getBotOwnerId(): Promise<string> {
  // Return your bot/service account owner ID
  // or fetch from HubSpot API
  return Deno.env.get("HUBSPOT_BOT_OWNER_ID") || "";
}
```

## Complete Workflow

```typescript
// In webhook receiver
export async function handleWhatsAppMessage(incomingMessage: IncomingMessage) {
  // 1. Detect intent
  const { intent, entities } = await detectIntent(incomingMessage.text);

  // 2. Determine conversation stage
  const stage = getConversationStage(intent);

  // 3. Sync to HubSpot
  const contactId = await syncWhatsAppContact(incomingMessage.phone, {
    name: incomingMessage.name,
    intent,
    conversationStage: stage,
    entities,
  });

  // 4. Log incoming message
  await logWhatsAppEngagement(contactId, {
    direction: "inbound",
    text: incomingMessage.text,
    timestamp: incomingMessage.timestamp,
  });

  // 5. Create deal if booking intent
  if (intent === "book_appointment" && entities.date && entities.time) {
    await createBookingDeal(contactId, entities);
  }

  // 6. Generate AI response
  const response = await generateSalesResponse(
    intent,
    entities,
    incomingMessage,
  );

  // 7. Log outgoing message
  await logWhatsAppEngagement(contactId, {
    direction: "outbound",
    text: response,
    timestamp: Date.now(),
  });

  return { contactId, intent, response };
}

function getConversationStage(intent: string): string {
  const stages: Record<string, string> = {
    discover_fitness_goals: "discovery",
    qualify_commitment: "qualification",
    handle_objection: "objection",
    book_appointment: "booking",
  };
  return stages[intent] || "discovery";
}
```

## Custom Properties

### Required HubSpot Contact Properties

Create these custom properties in HubSpot:

| Property Name                 | Type             | Description                                                       |
| ----------------------------- | ---------------- | ----------------------------------------------------------------- |
| `whatsapp_intent`             | Single-line text | Latest detected intent                                            |
| `whatsapp_stage`              | Dropdown         | Conversation stage (discovery, qualification, objection, booking) |
| `whatsapp_last_message`       | Multi-line text  | Last message received                                             |
| `whatsapp_conversation_count` | Number           | Total message count                                               |

### Required Deal Properties

| Property Name  | Type             | Description                                   |
| -------------- | ---------------- | --------------------------------------------- |
| `service_type` | Dropdown         | Fitness goal (weight_loss, muscle_gain, etc.) |
| `booking_date` | Date             | Scheduled session date                        |
| `booking_time` | Single-line text | Scheduled session time                        |
| `lead_source`  | Dropdown         | Set to 'WhatsApp AI Agent'                    |

## Best Practices

✅ **DO**:

- Create contact immediately on first message
- Update contact properties on every intent change
- Log all messages as notes/engagements
- Create deals only when booking intent confirmed
- Use custom properties for WhatsApp-specific data

❌ **DON'T**:

- Skip contact creation (lose conversation context)
- Create duplicate contacts (search by phone first)
- Forget to associate notes/deals with contacts
- Hardcode owner IDs (use env vars)

## Error Handling

```typescript
async function safeHubSpotSync(operation: () => Promise<any>) {
  try {
    return await operation();
  } catch (error: any) {
    console.error("HubSpot sync failed:", error);

    // Log but don't block WhatsApp flow
    await logError({
      service: "hubspot_crm",
      operation: "sync",
      error: error.message,
      timestamp: Date.now(),
    });

    // Continue even if CRM sync fails
    return null;
  }
}

// Usage
await safeHubSpotSync(() => syncWhatsAppContact(phone, data));
```

## Rate Limits

HubSpot has rate limits:

- **10 requests/second** (burst)
- **100,000 requests/day**

Implement queuing for high-volume:

```typescript
import PQueue from "p-queue";

const hubspotQueue = new PQueue({
  concurrency: 5,
  interval: 1000,
  intervalCap: 10,
});

await hubspotQueue.add(() => syncWhatsAppContact(phone, data));
```

## Status

**Integration Points**:

- ✅ Contact creation/update
- ✅ Deal creation
- ✅ Message logging as notes
- ⏳ Custom properties (manual setup required)
- ⏳ Rate limiting (implement if high volume)
