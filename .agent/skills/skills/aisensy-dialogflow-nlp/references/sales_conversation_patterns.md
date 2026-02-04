# Sales Conversation Patterns with NLP

Complete sales conversation flows combining Dialogflow ES NLP with sales psychology for WhatsApp.

## Complete Sales Flow

```
1. Discovery → 2. Qualification → 3. Objection Handling → 4. Booking
```

Each stage has specific intents, entities, and psychology-driven responses.

##Stage 1: Discovery

**Goals**: Identify pain points, establish rapport, demonstrate value

**Intent**: `discover_fitness_goals`

**Entities**: `@fitness_goal`

**Training Phrases**:

```
- "I need help getting fit"
- "Looking for a personal trainer"
- "Want to lose weight"
- "Interested in PT"
```

**NLP Response + Sales Psychology**:

```typescript
const response = `Hey ${name}! 💪

**Social Proof**: "We've helped 200+ clients crush their fitness goals"
**Value Demonstration**: "Most see results in just 2 weeks"
**Micro-Commitment**: "What's your main goal - weight loss, muscle gain, or general fitness?"

Emoji: Builds rapport
Question: Keeps conversation flowing
```

**Context Set**: `discovery_complete` (lifespan: 5)

---

## Stage 2: Qualification

**Goals**: Assess commitment, understand constraints, position PT as solution

**Intent**: `qualify_commitment`

**Entities**: `@sys.number` (frequency), `@sys.currency` (budget), `@time_preference`

**Training Phrases**:

```
- "I can train 3 times a week"
- "My budget is £500"
- "I'm available mornings"
```

**NLP Response + Sales Psychology**:

```typescript
const response = `Perfect! ${frequency} sessions/week is ideal for ${goal}. 🎯

**Empathy**: "I get it - fitting training into a busy life is tough"
**Value Alignment**: "That's why our ${package} is designed for people like you"
**Social Proof**: "Our ${frequency}x/week clients see fastest results"
**Next Step**: "Ready to book your first session? I have spots this week!"
```

**Context Set**: `qualified` (lifespan: 10)

---

## Stage 3: Objection Handling

**Goals**: Address concerns, reframe value, overcome resistance

**Intent**: `handle_objection`

**Entities**: `@objection` (price | time | skepticism | commitment)

**Training Phrases**:

```
- "That's too expensive"
- "I don't have time"
- "I'm not sure it will work"
```

**NLP Response by Objection Type**:

### Price Objection

```typescript
const response = `I totally get that, ${name}! 💰

**Empathy First**: "Budget matters"
**ROI Reframe**: "Think of it as £${per_session} per session - less than a night out"
**Results Focus**: "Most clients lose 10-15lbs in 8 weeks. What's that worth to you?"
**Risk Reversal**: "Plus, money-back guarantee if you don't see results"
**Binary Choice**: "We have 2 spots left this week - Monday 6pm or Friday 5pm?"
```

### Time Objection

```typescript
const response = `Totally understand - we're all busy! ⏰

**Validate**: "Time is precious"
**Efficiency**: "Sessions are JUST 45 min, 2-3x/week"
**Convenience**: "We fit around YOUR schedule"
**Results**: "Clients actually SAVE time by getting fit faster with a plan"
**Scarcity**: "I have morning slots (before work) - they go FAST"
```

### Skepticism

```typescript
const response = `Makes sense to be cautious! 🤔

**Validate**: "You should be skeptical - lots of gimmicks out there"
**Differentiation**: "That's why we offer [guarantee/trial]"
**Social Proof**: "Just helped Sarah lose 15lbs in 8 weeks (see her story)"
**Risk Reversal**: "ZERO risk - you only pay if you see results"
**Urgency**: "Try one session this week?"
```

**Context Set**: `objection_handled` (lifespan: 3)

---

## Stage 4: Booking

**Goals**: Lock in commitment, create urgency, confirm details

**Intent**: `book_appointment`

**Entities**: `@sys.date` (required), `@sys.time` (required)

**Slot Filling Prompts**:

```
Missing date: "Awesome! When works - Monday, Wednesday, or Friday?"
Missing time: "Great! Morning (9am), midday (1pm), or evening (6pm)?"
```

**NLP Response + Sales Psychology**:

```typescript
const response = `🎉 YOU'RE ALL SET, ${name}!

**Confirmation**: "${day} at ${time}"
**Scarcity**: "You got one of the last spots this week!"
**Next Steps**: "Check WhatsApp for:
  ✅ Confirmation
  ✅ What to bring
  ✅ Pre-session prep"
**Excitement**: "Can't wait to see you crush it! 💪"
```

**Context Set**: `booking_confirmed` (lifespan: 2)

---

## Complete Multi-Turn Example

```
User: "I'm interested in PT"
[Intent: discover_fitness_goals, Entities: none]
Bot: "Awesome! 💪 We've helped 200+ clients crush goals. Most see results in 2 weeks. What's your main goal - weight loss, muscle gain, or fitness?"

User: "Want to lose weight"
[Intent: discover_fitness_goals, Entities: goal=weight_loss]
Bot: "Perfect! Our weight loss clients typically drop 10-15lbs in 8 weeks. How often can you train - 2x, 3x, or 4x per week?"

User: "3 times a week"
[Intent: qualify_commitment, Entities: frequency=3]
Bot: "Ideal! 3x/week gets FAST results. Our £450/month package includes:
  ✅ 12 sessions/month
  ✅ Custom meal plan
  ✅ 24/7 WhatsApp support
Ready to book your first session?"

User: "That's a bit expensive"
[Intent: handle_objection, Entities: objection=price]
Bot: "I get that! Think of it as £37.50 per session - less than a night out. Plus, what's 10-15lbs weight loss worth to you?
Money-back guarantee if you don't see results.
I have 2 spots left - Monday 6pm or Friday 5pm?"

User: "Monday 6pm works"
[Intent: book_appointment, Entities: date=Monday, time=18:00]
Bot: "🎉 YOU'RE BOOKED! Monday at 6pm. Check WhatsApp for confirmation + prep tips. See you soon!"
```

---

## Context Management

Use contexts to track conversation stage:

```typescript
// After discovery
ctx.setContext("discovery_complete", 5); // 5 turns lifespan

// After qualification
ctx.setContext("qualified", 10);

// After objection handled
ctx.setContext("objection_handled", 3);

// After booking
ctx.setContext("booking_confirmed", 2);
```

## Hybrid: AISensy Flow + Dialogflow NLP

```typescript
// 1. Receive message via AISensy webhook
const message = payload.data.message.text;

// 2. Detect intent via Dialogflow
const { intent, entities, context } = await detectIntent(message);

// 3. Route to handler
if (intent === "book_appointment" && entities.date && entities.time) {
  // Structured booking via AISensy flow
  await triggerAISensyFlow("booking_confirmation", {
    date: entities.date,
    time: entities.time,
  });
} else {
  // Open-ended conversation via Dialogflow + Gemini
  const stage = detectSalesStage(intent, context);
  const psychologyPrompt = getPrompt(stage, { name, intent, entities });
  const aiResponse = await gemini.generate(psychologyPrompt);
  await sendAISensyMessage(sanitize(aiResponse));
}
```

##Best Practices

✅ **DO**:

- Combine NLP intent detection + sales psychology
- Use contexts to track conversation stage
- Implement slot filling for structured data
- Handle all 4 sales stages (discovery, qualification, objection, booking)
- Test with real customer messages

❌ **DON'T**:

- Skip objection handling intents
- Use generic responses (personalize with entities)
- Forget to set/use contexts
- Over-complicate flows (keep it conversational)
