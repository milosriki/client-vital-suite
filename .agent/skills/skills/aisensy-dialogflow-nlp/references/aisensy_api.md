# AISensy API Reference

Complete guide to AISensy WhatsApp Business API integration.

## Authentication

**API Key Location**: AIS

ensy Dashboard → Manage → API Key

```typescript
const AISENSY_API_KEY = Deno.env.get("AISENSY_API_KEY");
```

## Send Message API

**Endpoint**: `POST https://backend.aisensy.com/campaign/t1/api/v2`

### Required Fields

| Field          | Type   | Description               | Example           |
| -------------- | ------ | ------------------------- | ----------------- |
| `apiKey`       | string | Your AISensy API key      | `"abc123xyz..."`  |
| `campaignName` | string | Name of LIVE API campaign | `"PTD_AI_Sales"`  |
| `destination`  | string | Phone with country code   | `"+917428526285"` |
| `userName`     | string | Recipient name            | `"John Doe"`      |

### Optional Fields

| Field            | Type   | Description              | Example                                         |
| ---------------- | ------ | ------------------------ | ----------------------------------------------- |
| `source`         | string | Lead origin tracking     | `"Website"`, `"Facebook Ads"`                   |
| `media`          | object | Media file details       | `{ url: "https://...", filename: "image.jpg" }` |
| `templateParams` | array  | Template variable values | `["John", "Monday 6pm"]`                        |
| `tags`           | array  | Auto-assign tags         | `["lead", "interested"]`                        |
| `attributes`     | object | Custom user attributes   | `{ companyname: "Acme" }`                       |

### Complete Example

```typescript
async function sendAISensyMessage(
  phone: string,
  message: string,
  options = {},
) {
  const payload = {
    apiKey: AISENSY_API_KEY,
    campaignName: "PTD_AI_Sales",
    destination: phone, // Must include country code
    userName: options.name || "Customer",
    source: options.source || "WhatsApp Sales Agent",
    media: options.media || {},
    templateParams: options.templateParams || [],
    tags: options.tags || ["ai_conversation"],
    attributes: {
      last_message: message,
      conversation_stage: options.stage || "discovery",
      ...options.attributes,
    },
  };

  const response = await fetch(
    "https://backend.aisensy.com/campaign/t1/api/v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AISENSY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      `AISensy API error: ${response.status} - ${await response.text()}`,
    );
  }

  return response.json();
}
```

## Media Constraints

| Media Type | Size Limit | Format              |
| ---------- | ---------- | ------------------- |
| Image      | 5 MB       | JPG, PNG, GIF       |
| Video      | 16 MB      | MP4, 3GPP           |
| Audio      | 16 MB      | MP3, OGG, AMR       |
| Document   | 100 MB     | PDF, DOC, XLS, etc. |

## Error Handling

```typescript
try {
  await sendAISensyMessage(phone, message);
} catch (error) {
  if (error.message.includes("503")) {
    // Retry with exponential backoff
    await retryWithBackoff(() => sendAISensyMessage(phone, message));
  } else {
    // Log and alert
    console.error("AISensy API failed:", error);
    await notifyAdmin(error);
  }
}
```

## Rate Limits

- **No official rate limit** documented
- **Best Practice**: Implement backoff for 503 errors
- **Recommended**: Max 10 req/sec per campaign

## Best Practices

✅ **DO**:

- Always include country code in destination (`+1`, `+91`, etc.)
- Set meaningful `source` for tracking
- Use `tags` for lead segmentation
- Validate phone format before sending

❌ **DON'T**:

- Send without user opt-in (WhatsApp policy violation)
- Hardcode API keys in code
- Skip error handling
- Send media over size limits
