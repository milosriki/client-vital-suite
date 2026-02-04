# Dialogflow ES Intent Design for Sales Conversations

Intent patterns and best practices for building natural language understanding in WhatsApp sales agents.

## Table of Contents

1. [Intent Structure](#intent-structure)
2. [Sales-Specific Intents](#sales-specific-intents)
3. [Training Phrases](#training-phrases)
4. [Parameters \u0026 Slot Filling](#parameters--slot-filling)
5. [Best Practices](#best-practices)

## Intent Structure

Each intent should represent ONE specific user goal:

```
Intent Name: book_appointment
Training Phrases:
  - "I want to book a session"
  - "When can I start training?"
  - "Schedule me for Monday"

Parameters:
  - @sys.date (required)
  - @sys.time (required)
  - service_type (@service_type entity, optional)

Responses:
  - "Great! I have spots available. Prefer morning or evening?"
  - "Perfect! Let's get you scheduled. Any specific time?"
```

## Sales-Specific Intents

### 1. Discovery Stage

**Intent**: `discover_fitness_goals`

```
Training Phrases (10-20 variations):
- "I want to get fit"
- "Looking for a personal trainer"
- "Need help losing weight"
- "Want to build muscle"
- "Interested in your services"
- "How does PT work?"
- "Tell me about your program"
- "What do you offer?"

Parameters:
- goal: @fitness_goal (weight_loss | muscle_gain | general_fitness | sport_specific)

Response Example:
"That's awesome! 💪 We specialize in [goal]. Most clients see results in 2-4 weeks. What's your main goal - weight loss, muscle gain, or general fitness?"
```

### 2. Qualification Stage

**Intent**: `qualify_commitment`

```
Training Phrases:
- "I can train 3 times a week"
- "My budget is around £500"
- "I'm available mornings"
- "I prefer outdoor training"

Parameters:
- frequency: @sys.number (sessions per week
)
- budget: @sys.currency
- schedule_preference: @time_preference (morning | afternoon | evening)
- location_preference: @location_type (gym | outdoor | home)

Response Example:
"Perfect! [frequency] sessions per week is ideal for [goal]. Our packages start at [price_range]. Ready to book your first session?"
```

### 3. Objection Handling

**Intent**: `handle_objection`

```
Training Phrases:
- "That's too expensive"
- "I don't have time"
- "I'm not sure if it will work"
- "Can I think about it?"
- "I need to check my schedule"

Parameters:
- objection_type: @objection (price | time | skepticism | commitment)

Response Examples (by objection type):
- Price: "I get that! Think of it as £X per session - less than a night out. Plus, most see [specific result] in [timeframe]."
- Time: "Totally understand! Our sessions are just 45 min, 2-3x/week. We fit around YOUR schedule."
- Skepticism: "Makes sense to be cautious! That's why we offer [guarantee/trial]. Zero risk."
```

### 4. Booking Stage

**Intent**: `book_appointment`

```
Training Phrases:
- "I'm ready to book"
- "When can I start?"
- "Monday at 6pm works"
- "Schedule me for this week"
- "Let's do it!"

Parameters:
- date: @sys.date (required)
- time: @sys.time (required)
- duration_weeks: @sys.number (optional)

Slot Filling Prompts:
- For missing date: "Awesome! When would you like your first session? Monday, Wednesday, or Friday?"
- For missing time: "Great choice! Morning (9am), midday (1pm), or evening (6pm)?"

Response:
"🎉 You're ALL SET! [Date] at [Time]. I'll send confirmation + prep tips. See you soon!"
```

### 5. Follow-up Intent (Context-Dependent)

**Parent Intent**: `book_appointment`  
**Follow-up Intent**: `confirm_booking`

```
Context: booking_confirmed (lifespan: 2)

Training Phrases:
- "Yes, confirmed"
- "That works!"
- "Perfect"
- "Change it to Tuesday"

Parameters:
- confirmation: @sys.yes_no
- new_date: @sys.date (if changing)

Response:
"Confirmed! 📅 See you [Date] at [Time]. Check your WhatsApp for prep details."
```

## Training Phrases

### Best Practices

✅ **DO**:

- Provide **10-20 training phrases** per intent
- Include **variations**: formal/informal, questions/statements
- Use **real customer language** (test with actual messages)
- Add **typos and abbreviations** ("wanna", "gonna", "tmrw")
- Include **implicit requests** ("I'm interested")

❌ **DON'T**:

- Use only formal language
- Create overly similar phrases
- Skip edge cases
- Forget negative examples (if needed)

### Example Set (Discovery Intent)

```
Formal:
- "I would like information about personal training"
- "Could you tell me about your services?"

Informal:
- "wanna get fit"
- "need a trainer"
- "looking for PT"

Questions:
- "How does it work?"
- "What do you offer?"
- "Do you have availability?"

Statements:
- "I want to start training"
- "Interested in your program"

Implicit:
- "I'm here from the ad"
- "Saw your post"
```

## Parameters \u0026 Slot Filling

### System Entities (Built-in)

| Entity          | Use Case                          |
| --------------- | --------------------------------- |
| `@sys.date`     | "Monday", "next week", "tomorrow" |
| `@sys.time`     | "6pm", "morning", "1:30"          |
| `@sys.number`   | "3 times a week", "£500"          |
| `@sys.currency` | "£50", "$100"                     |
| `@sys.any`      | Capture any text (name, feedback) |

### Custom Entities

**Entity**: `@fitness_goal`

```
Entries:
- weight_loss: "lose weight", "get lean", "slim down", "fat loss"
- muscle_gain: "build muscle", "get bigger", "bulk up", "gain mass"
- general_fitness: "get fit", "stay healthy", "improve fitness"
- sport_specific: "train for marathon", "football fitness"
```

**Entity**: `@objection`

```
Entries:
- price: "expensive", "costly", "too much", "pricy"
- time: "busy", "no time", "schedule", "packed"
- skepticism: "not sure", "doubt", "will it work"
- commitment: "think about it", "need time", "not ready"
```

### Slot Filling Example

```
Intent: book_appointment

Required Parameters:
- date: @sys.date
- time: @sys.time

User: "I want to book a session"
Bot: "Awesome! When would you like to start?" [Prompt for date]

User: "Monday"
Bot: "Perfect! What time on Monday?" [Prompt for time]

User: "6pm"
Bot: "You're all set for Monday at 6pm!"
```

## Best Practices

### Intent Naming

Use pattern: `{stage}_{action}`

- `discover_fitness_goals`
- `qualify_commitment`
- `handle_objection`
- `book_appointment`
- `cancel_booking`

### Intent Scope

**One intent per user goal**:

- ❌ `general_inquiry` (too broad)
- ✅ `discover_fitness_goals`, `ask_pricing`, `check_availability`

### Fallback Intent

Always customize `Default Fallback Intent`:

```
Responses:
- "Hmm, I didn't quite catch that. Are you interested in booking, pricing, or have a question?"
- "Sorry! Can you rephrase? I can help with bookings, pricing, or general questions."
```

### Testing

Test intents with:

1. **Exact training phrases** (should match 100%)
2. **Variations** (similar wording)
3. **Edge cases** (typos, slang)
4. **Cross-intent confusion** (ensure no overlap)

Dialogflow Console → Test panel → Enter messages

Goal: **>90% accuracy** on real customer messages
