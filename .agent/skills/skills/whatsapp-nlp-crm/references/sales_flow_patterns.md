# Sales Flow Patterns

Complete 4-stage sales conversation flows combining Dialogflow NLP with sales psychology for WhatsApp.

## Table of Contents

1. [Complete Sales Journey](#complete-sales-journey)
2. [Stage 1: Discovery](#stage-1-discovery-intent-discover_fitness_goals)
3. [Stage 2: Qualification](#stage-2-qualification-intent-qualify_commitment)
4. [Stage 3: Objection Handling](#stage-3-objection-handling-intent-handle_objection)
5. [Stage 4: Booking](#stage-4-booking-intent-book_appointment)
6. [Multi-Turn Example](#multi-turn-example-complete-flow)
7. [Context Tracking](#context-tracking)
8. [Sales Psychology Principles](#sales-psychology-principles)
9. [Testing Your Flows](#testing-your-flows)
10. [Best Practices](#best-practices)

## Complete Sales Journey

```
Discovery → Qualification → Objection Handling → Booking
```

Each stage uses different intents, entities, and psychological principles.

## Stage 1: Discovery (Intent: discover_fitness_goals)

### User Input Examples

- "I want to get fit"
- "How much does personal training cost?"
- "Tell me about your gym"

### Dialogflow Intent

```json
{
  "name": "discover_fitness_goals",
  "trainingPhrases": [
    "I want to get fit",
    "I need help with fitness",
    "Tell me about training"
  ],
  "parameters": [
    {
      "name": "goal",
      "entityType": "@fitness_goal",
      "isList": true
    }
  ],
  "outputContexts": [
    {
      "name": "discovery_complete",
      "lifespanCount": 5
    }
  ]
}
```

### AI Response (Sales Psychology)

Apply: **Empathy + Social Proof**

```typescript
const response = `
Hey! 💪 Totally get it - that's awesome you're ready to level up!

Quick Q: What's your main goal?
1️⃣ Lose weight & get lean
2️⃣ Build muscle & strength
3️⃣ General fitness & energy

(Most clients start with #1 or #2!)
`;
```

**Psychology**: Social proof ("most clients") reduces decision anxiety.

## Stage 2: Qualification (Intent: qualify_commitment)

### User Input Examples

- "Lose weight"
- "Build muscle"
- "I can do 3 times a week"

### Dialogflow Intent

```json
{
  "name": "qualify_commitment",
  "trainingPhrases": ["lose weight", "build muscle", "get stronger"],
  "parameters": [
    {
      "name": "goal",
      "entityType": "@fitness_goal"
    },
    {
      "name": "frequency",
      "entityType": "@sys.number"
    }
  ],
  "inputContexts": ["discovery_complete"],
  "outputContexts": [
    {
      "name": "qualification_complete",
      "lifespanCount": 5
    }
  ]
}
```

### AI Response (Sales Psychology)

Apply: **Scarcity + Commitment**

```typescript
const goal = entities.goal; // e.g., "lose weight"

const response = `
Perfect! ${goal} is TOTALLY doable 🔥

Real talk: 3x/week gets results FAST. 
Most clients see changes in 2-3 weeks.

But spots are limited this month...
Want me to check availability? (Yes/No)
`;
```

**Psychology**:

- Scarcity ("spots limited") creates urgency
- Commitment language ("3x/week") anchors expectation

## Stage 3: Objection Handling (Intent: handle_objection)

### User Input Examples

- "How much does it cost?"
- "I'm not sure I can afford it"
- "I need to think about it"

### Dialogflow Intent

```json
{
  "name": "handle_objection",
  "trainingPhrases": ["how much", "expensive", "need to think", "not sure"],
  "parameters": [
    {
      "name": "objection_type",
      "entityType": "@objection"
    }
  ],
  "inputContexts": ["qualification_complete"],
  "outputContexts": [
    {
      "name": "objection_handled",
      "lifespanCount": 3
    }
  ]
}
```

### Custom Entity: @objection

```json
{
  "name": "objection",
  "entries": [
    { "value": "price", "synonyms": ["expensive", "cost", "afford", "money"] },
    { "value": "time", "synonyms": ["busy", "schedule", "timing"] },
    { "value": "commitment", "synonyms": ["think about", "not sure", "maybe"] }
  ]
}
```

### AI Response (Sales Psychology)

Apply: **Value Reframing + Risk Reversal**

```typescript
const objectionType = entities.objection_type;

const responses = {
  price: `
I hear you! 💯

Here's the thing: Most people spend $200+/month on stuff that doesn't work.

Our clients get:
✅ Personalized training ($150 value)
✅ Nutrition plan ($100 value)  
✅ 24/7 support (priceless)

All for $500/month. That's $16/day for your health.

Plus → 30-day money-back guarantee. Zero risk.

Worth a shot? 🚀
`,
  time: `
Totally feel you on being busy! 

Our sessions are ONLY 45 min, 3x/week.
That's 2.2 hours total - less than ONE Netflix binge 😅

Plus, we fit YOUR schedule (even early AM/late PM).

Want me to find a time that works?
`,
  commitment: `
Smart to think it through! 👍

Here's what I'd do: 
Take 1 FREE trial session. See if you vibe with the trainer.

If you love it → awesome, let's book.
If not → no pressure at all.

Sound fair?
`,
};

return responses[objectionType] || responses.commitment;
```

**Psychology**:

- Price objection → Value stacking + Risk reversal
- Time objection → Time comparison (Netflix)
- Commitment objection → Low-risk trial

## Stage 4: Booking (Intent: book_appointment)

### User Input Examples

- "Ok let's do Monday at 6pm"
- "Yes I'm interested"
- "Book me for this week"

### Dialogflow Intent

```json
{
  "name": "book_appointment",
  "trainingPhrases": [
    "book for Monday at 6pm",
    "yes let's do it",
    "I'm interested"
  ],
  "parameters": [
    {
      "name": "date",
      "entityType": "@sys.date",
      "required": true,
      "prompts": ["What day works best? (Mon/Wed/Fri)"]
    },
    {
      "name": "time",
      "entityType": "@sys.time",
      "required": true,
      "prompts": ["What time? (6am-9pm available)"]
    }
  ],
  "inputContexts": ["objection_handled", "qualification_complete"],
  "outputContexts": [
    {
      "name": "booking_complete",
      "lifespanCount": 2
    }
  ]
}
```

### Slot Filling Flow

```
User: "Monday at 6pm"
→ Extracts: { date: "2026-02-10", time: "18:00" }

User: "Monday"
→ Missing time
→ AI: "What time? (6am-9pm available)"

User: "6pm"
→ Completes: { date: "2026-02-10", time: "18:00" }
```

### AI Response (Sales Psychology)

Apply: **Excitement + Next Steps**

```typescript
const { date, time } = entities;

const response = `
🎉 YESSS! You're ALL SET!

Monday, ${formatDate(date)} at ${formatTime(time)}

What happens next:
1️⃣ Confirmation text in 5 min
2️⃣ Trainer intro + location details
3️⃣ See you Monday! 💪

P.S. Bring water + towel. We'll handle the rest!

Ready to crush it? 🔥
`;

// Trigger confirmations
await sendConfirmationEmail(phone, date, time);
await createHubSpotDeal(contactId, { date, time });
```

**Psychology**:

- Excitement builds momentum
- Clear next steps reduce anxiety
- P.S. adds practical value

## Multi-Turn Example (Complete Flow)

```
👤 User: "I want to get fit"
🤖 AI: Discovery response (goals + social proof)

👤 User: "Lose weight"
🤖 AI: Qualification response (commitment + scarcity)

👤 User: "How much?"
🤖 AI: Objection response (value + risk reversal)

👤 User: "Ok let's try Monday at 6pm"
🤖 AI: Booking response (excitement + next steps)
   → Creates HubSpot contact & deal
   → Sends confirmation
```

## Context Tracking

### How Contexts Work

```typescript
// Turn 1: Discovery
await detectIntent("I want to get fit", sessionId);
// Sets context: discovery_complete (lifespan: 5)

// Turn 2: Qualification
await detectIntent("lose weight", sessionId);
// Uses context: discovery_complete
// Sets context: qualification_complete (lifespan: 5)

// Turn 3: Objection
await detectIntent("how much", sessionId);
// Uses context: qualification_complete
// Sets context: objection_handled (lifespan: 3)

// Turn 4: Booking
await detectIntent("Monday at 6pm", sessionId);
// Uses context: objection_handled
// Sets context: booking_complete (lifespan: 2)
```

### Session Management

```typescript
// Store session ID by phone number
const sessionCache = new Map<string, string>();

function getSessionId(phone: string): string {
  if (!sessionCache.has(phone)) {
    sessionCache.set(phone, crypto.randomUUID());
  }
  return sessionCache.get(phone)!;
}

// Use in webhook
const sessionId = getSessionId(message.phone);
const intent = await detectIntent(message.text, sessionId);
```

## Sales Psychology Principles

| Stage         | Principle                      | Implementation               |
| ------------- | ------------------------------ | ---------------------------- |
| Discovery     | Empathy + Social Proof         | "Most clients start with..." |
| Qualification | Scarcity + Commitment          | "Spots limited", "3x/week"   |
| Objection     | Value Stacking + Risk Reversal | Benefits list + guarantee    |
| Booking       | Excitement + Clarity           | Emojis + clear next steps    |

## Testing Your Flows

```bash
# Test each stage
echo "I want to get fit" | deno run test_flow.ts
echo "lose weight" | deno run test_flow.ts
echo "how much" | deno run test_flow.ts
echo "Monday at 6pm" | deno run test_flow.ts
```

## Best Practices

✅ **DO**:

- Keep responses under 3-4 lines (WhatsApp-friendly)
- Use emojis for emotion (1-2 per message)
- Ask ONE question at a time
- Include clear CTAs ("Yes/No", numbered options)
- Track context across turns

❌ **DON'T**:

- Send walls of text (breaks attention)
- Ask multiple questions in one message
- Skip sales psychology (feels robotic)
- Forget to close the loop (booking)

## Status

**Flows**: ✅ Complete (all 4 stages)
**Psychology**: ✅ Integrated
**Multi-Turn**: ✅ Context tracking
**Testing**: ⏳ Create test scripts
