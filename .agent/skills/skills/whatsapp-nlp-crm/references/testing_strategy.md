# Testing Strategy

Comprehensive testing guide for provider abstraction, NLP accuracy, and CRM sync.

## Table of Contents

1. [Provider Abstraction Testing](#provider-abstraction-testing)
2. [Dialogflow NLP Testing](#dialogflow-nlp-testing)
3. [HubSpot CRM Testing](#hubspot-crm-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Performance Testing](#performance-testing)
6. [Automated Test Suite](#automated-test-suite)
7. [Testing Checklist](#testing-checklist)

## Provider Abstraction Testing

### Test 1: Provider Interface Compliance

```typescript
// scripts/test_provider_interface.ts
import { WhatsAppProvider } from "../supabase/functions/_shared/providers/whatsapp_provider.ts";
import { HubSpotProvider } from "../supabase/functions/_shared/providers/hubspot_provider.ts";
import { AISensyProvider } from "../supabase/functions/_shared/providers/aisensy_provider.ts";

async function testProvider(provider: WhatsAppProvider) {
  console.log(`Testing ${provider.getName()}...`);

  // Test 1: getName()
  assert(typeof provider.getName() === "string");

  // Test 2: sendMessage()
  try {
    await provider.sendMessage("+1234567890", "Test message");
    console.log("✅ sendMessage works");
  } catch (error) {
    console.error("❌ sendMessage failed:", error);
  }

  // Test 3: receiveWebhook()
  const mockPayload = createMockWebhookPayload(provider.getName());
  const message = await provider.receiveWebhook(mockPayload);
  assert(message.phone && message.text);
  console.log("✅ receiveWebhook works");

  // Test 4: verifySignature()
  const isValid = provider.verifySignature(mockRequest, "test-signature");
  console.log(`✅ verifySignature returns: ${isValid}`);
}

// Run tests
await testProvider(new HubSpotProvider(API_KEY));
await testProvider(new AISensyProvider(API_KEY, WEBHOOK_SECRET));
```

### Test 2: Provider Switching

```bash
# Test HubSpot
export WHATSAPP_PROVIDER=hubspot
deno run scripts/test_message_flow.ts

# Test AISensy
export WHATSAPP_PROVIDER=aisensy
deno run scripts/test_message_flow.ts

# Should behave identically (provider-agnostic)
```

## Dialogflow NLP Testing

### Test 3: Intent Detection Accuracy

```typescript
// scripts/test_dialogflow_accuracy.ts
const testCases = [
  // Discovery
  { input: "I want to get fit", expected: "discover_fitness_goals" },
  { input: "Tell me about training", expected: "discover_fitness_goals" },

  // Qualification
  { input: "I want to lose weight", expected: "qualify_commitment" },
  { input: "Build muscle", expected: "qualify_commitment" },

  // Objection
  { input: "How much does it cost?", expected: "handle_objection" },
  { input: "I need to think about it", expected: "handle_objection" },

  // Booking
  { input: "Book me for Monday at 6pm", expected: "book_appointment" },
  { input: "Yes let's do it", expected: "book_appointment" },
];

let passed = 0;
for (const test of testCases) {
  const result = await detectIntent(test.input);
  if (result.intent === test.expected) {
    console.log(`✅ "${test.input}" → ${result.intent}`);
    passed++;
  } else {
    console.error(
      `❌ "${test.input}" → ${result.intent} (expected ${test.expected})`,
    );
  }
}

console.log(`\nAccuracy: ${((passed / testCases.length) * 100).toFixed(1)}%`);
// Target: >90% accuracy
```

### Test 4: Entity Extraction

```typescript
const entityTests = [
  {
    input: "Monday at 6pm",
    expected: { date: "2026-02-10", time: "18:00" },
  },
  {
    input: "I want to lose weight and build muscle",
    expected: { goal: ["weight_loss", "muscle_gain"] },
  },
  {
    input: "3 times a week",
    expected: { frequency: 3 },
  },
];

for (const test of entityTests) {
  const result = await detectIntent(test.input);
  const parsed = parseEntities(result.entities);

  if (JSON.stringify(parsed) === JSON.stringify(test.expected)) {
    console.log(`✅ Entities extracted correctly`);
  } else {
    console.error(`❌ Expected: ${JSON.stringify(test.expected)}`);
    console.error(`   Got: ${JSON.stringify(parsed)}`);
  }
}
```

### Test 5: Multi-Turn Context

```typescript
const sessionId = crypto.randomUUID();

// Turn 1
const turn1 = await detectIntent("I want to get fit", sessionId);
assert(turn1.intent === "discover_fitness_goals");

// Turn 2 (should use context from turn 1)
const turn2 = await detectIntent("lose weight", sessionId);
assert(turn2.intent === "qualify_commitment");

// Turn 3 (should use context from turn 2)
const turn3 = await detectIntent("how much", sessionId);
assert(turn3.intent === "handle_objection");

console.log("✅ Multi-turn context works");
```

## HubSpot CRM Testing

### Test 6: Contact Sync

```typescript
const testPhone = "+1234567890";
const testData = {
  name: "Test User",
  intent: "discover_fitness_goals",
  conversationStage: "discovery",
};

// Create/update contact
const contactId = await syncWhatsAppContact(testPhone, testData);
assert(contactId);

// Verify in HubSpot
const contact = await hubspot.crm.contacts.basicApi.getById(contactId);
assert(contact.properties.phone === testPhone);
assert(contact.properties.whatsapp_intent === "discover_fitness_goals");

console.log("✅ Contact sync works");
```

### Test 7: Deal Creation

```typescript
const entities = {
  date: "2026-02-10",
  time: "18:00",
  goal: "weight_loss",
};

const dealId = await createBookingDeal(contactId, entities);
assert(dealId);

// Verify deal
const deal = await hubspot.crm.deals.basicApi.getById(dealId);
assert(deal.properties.dealstage === "appointmentscheduled");
assert(deal.properties.booking_date === "2026-02-10");

console.log("✅ Deal creation works");
```

### Test 8: Conversation Logging

```typescript
await logWhatsAppEngagement(contactId, {
  direction: "inbound",
  text: "Test message",
  timestamp: Date.now(),
});

// Verify note created
const notes = await hubspot.crm.objects.notes.searchApi.doSearch({
  filterGroups: [
    {
      filters: [
        {
          propertyName: "hs_note_body",
          operator: "CONTAINS",
          value: "Test message",
        },
      ],
    },
  ],
});

assert(notes.results.length > 0);
console.log("✅ Conversation logging works");
```

## End-to-End Testing

### Test 9: Complete Flow (HubSpot)

```bash
# 1. Send WhatsApp message (via HubSpot inbox)
# 2. Check webhook received
supabase functions logs hubspot-webhook-receiver --tail

# 3. Check Dialogflow detected intent
# 4. Check HubSpot contact created
# 5. Check AI response sent
# 6. Verify conversation logged
```

### Test 10: Complete Flow (AISensy)

```bash
# 1. Send WhatsApp message to AISensy number
# 2. Check webhook received
supabase functions logs whatsapp-webhook-receiver --tail

# 3. Check Dialogflow detected intent
# 4. Check HubSpot contact synced
# 5. Check AISensy API sent reply
# 6. Verify all data persisted
```

## Performance Testing

### Test 11: Response Time

```typescript
const start = Date.now();

const message = await provider.receiveWebhook(payload);
const intent = await detectIntent(message.text);
const response = await generateResponse(intent, message);
await provider.sendMessage(message.phone, response);

const duration = Date.now() - start;

console.log(`Total response time: ${duration}ms`);
// Target: <3000ms end-to-end
```

### Test 12: Concurrent Requests

```typescript
const concurrentUsers = 10;
const promises = [];

for (let i = 0; i < concurrentUsers; i++) {
  promises.push(
    handleWhatsAppMessage({
      phone: `+123456789${i}`,
      text: "I want to get fit",
    }),
  );
}

const results = await Promise.all(promises);
assert(results.every((r) => r.success));

console.log(`✅ Handled ${concurrentUsers} concurrent requests`);
```

## Automated Test Suite

### Run All Tests

```bash
# scripts/test_suite.sh
#!/bin/bash

set -e

echo "Running test suite..."

# Provider tests
deno test scripts/test_provider_interface.ts

# Dialogflow tests
deno test scripts/test_dialogflow_accuracy.ts
deno test scripts/test_entity_extraction.ts
deno test scripts/test_multi_turn_context.ts

# HubSpot tests
deno test scripts/test_hubspot_sync.ts
deno test scripts/test_deal_creation.ts
deno test scripts/test_conversation_logging.ts

# E2E tests
deno test scripts/test_complete_flow.ts

# Performance tests
deno test scripts/test_performance.ts

echo "✅ All tests passed!"
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test WhatsApp Integration

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: denoland/setup-deno@v1

      - name: Run tests
        env:
          HUBSPOT_API_KEY: ${{ secrets.HUBSPOT_API_KEY }}
          DIALOGFLOW_PROJECT_ID: ${{ secrets.DIALOGFLOW_PROJECT_ID }}
          DIALOGFLOW_CREDENTIALS: ${{ secrets.DIALOGFLOW_CREDENTIALS }}
        run: ./scripts/test_suite.sh
```

## Testing Checklist

Provider Abstraction:

- [ ] All providers implement WhatsAppProvider interface
- [ ] Provider switching works via env var
- [ ] No provider-specific code in business logic

Dialogflow NLP:

- [ ] Intent detection accuracy >90%
- [ ] Entity extraction works correctly
- [ ] Multi-turn context tracking works
- [ ] Fallback intent handles unknown inputs

HubSpot CRM:

- [ ] Contacts created/updated correctly
- [ ] Deals created on booking
- [ ] Conversations logged as notes
- [ ] Custom properties populated

End-to-End:

- [ ] Message received → Intent detected → Response sent
- [ ] Response time <3 seconds
- [ ] Concurrent requests handled
- [ ] Error handling works

## Status

**Provider Tests**: ⏳ Create test scripts
**Dialogflow Tests**: ⏳ Create accuracy tests
**HubSpot Tests**: ⏳ Create sync tests
**E2E Tests**: ⏳ Create flow tests
**CI/CD**: ⏳ Set up GitHub Actions
