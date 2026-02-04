# Dialogflow ES Entity Extraction

Complete guide to entity types, slot filling, and parameter extraction for WhatsApp sales conversations.

## Table of Contents

1. [Entity Basics](#entity-basics)
2. [System Entities](#system-entities)
3. [Custom Entities](#custom-entities)
4. [Slot Filling](#slot-filling)
5. [Best Practices](#best-practices)

## Entity Basics

**Entity**: Type of data to extract from user input

**Example**:

```
User: "I want to book for Monday at 6pm"

Extracted Entities:
- date: "Monday" (@sys.date)
- time: "6pm" (@sys.time)
```

### Terminology

- **Entity Type**: General category (e.g., `@fitness_goal`)
- **Entity Entry**: Specific values with synonyms
  - Reference Value: `weight_loss`
  - Synonyms: "lose weight", "get lean", "slim down"

## System Entities

Built-in by Dialogflow (no configuration needed):

| Entity              | Extracts        | Examples                                    |
| ------------------- | --------------- | ------------------------------------------- |
| `@sys.date`         | Dates           | "Monday", "tomorrow", "next week", "Jan 15" |
| `@sys.time`         | Time            | "6pm", "morning", "3:30", "noon"            |
| `@sys.date-time`    | Combined        | "Monday at 6pm", "tomorrow morning"         |
| `@sys.number`       | Numbers         | "3", "three", "a couple"                    |
| `@sys.currency`     | Money           | "£50", "$100", "20 pounds"                  |
| `@sys.duration`     | Time periods    | "2 weeks", "3 months", "a year"             |
| `@sys.email`        | Email addresses | "john@example.com"                          |
| `@sys.phone-number` | Phone numbers   | "+44 7123 456789"                           |
| `@sys.any`          | Free text       | Captures anything                           |

### Example Usage

```javascript
// Intent with system entities
{
  "intent": "book_appointment",
  "parameters": {
    "date": {
      "type": "@sys.date",
      "required": true,
      "prompt": "What day works for you?"
    },
    "time": {
      "type": "@sys.time",
      "required": true,
      "prompt": "What time on $date?"
    }
  }
}
```

## Custom Entities

Create domain-specific entity types:

### Example 1: Fitness Goals

**Entity Type**: `@fitness_goal`

| Reference Value   | Synonyms                                                     |
| ----------------- | ------------------------------------------------------------ |
| `weight_loss`     | lose weight, get lean, slim down, fat loss, drop pounds      |
| `muscle_gain`     | build muscle, get bigger, bulk up, gain mass, get strong     |
| `general_fitness` | get fit, stay healthy, improve fitness, feel better          |
| `sport_specific`  | train for marathon, football fitness, cycling, swim training |

**Usage**:

```
User: "I want to get lean and build some muscle"

Extracted:
- goal: ["weight_loss", "muscle_gain"]
```

### Example 2: Objection Types

**Entity Type**: `@objection`

| Reference Value | Synonyms                                                 |
| --------------- | -------------------------------------------------------- |
| `price`         | expensive, costly, too much, pricy, can't afford, budget |
| `time`          | busy, no time, schedule, packed, hectic                  |
| `skepticism`    | not sure, doubt, will it work, uncertain, skeptical      |
| `commitment`    | think about it, need time, not ready, hesitant           |

### Example 3: Session Preferences

**Entity Type**: `@time_preference`

| Reference Value | Synonyms                                 |
| --------------- | ---------------------------------------- |
| `morning`       | morning, early, AM, sunrise, before work |
| `midday`        | lunch, midday, noon, afternoon           |
| `evening`       | evening, night, after work, PM, late     |

### Creating Custom Entities

1. **Dialogflow Console** → **Entities** → **Create Entity**
2. **Entity Name**: `fitness_goal`
3. **Add Entries**:

   ```
   Ref Value: weight_loss
   Synonyms: lose weight, get lean, slim down

   Ref Value: muscle_gain
   Synonyms: build muscle, get bigger, bulk up
   ```

4. **Enable Fuzzy Matching** (automatic synonym expansion)
5. **Save**

## Slot Filling

Dialogflow automatically prompts for missing required parameters.

### Example Flow

**Intent**: `book_appointment`

**Parameters**:

- `date` (@sys.date, required)
- `time` (@sys.time, required)

**Conversation**:

```
User: "I want to book a session"

Bot: "What day works for you?" [Prompting for date]

User: "Monday"

Bot: "What time on Monday?" [Prompting for time]

User: "6pm"

Bot: "Perfect! You're booked for Monday at 6pm."
```

### Slot Filling Configuration

```json
{
  "parameters": [
    {
      "name": "date",
      "entityType": "@sys.date",
      "required": true,
      "prompts": [
        "What day works for you?",
        "When would you like to start?",
        "Which day - Monday, Wednesday, or Friday?"
      ]
    },
    {
      "name": "time",
      "entityType": "@sys.time",
      "required": true,
      "prompts": [
        "What time on $date?",
        "Morning, midday, or evening?",
        "Prefer 9am, 1pm, or 6pm?"
      ]
    },
    {
      "name": "goal",
      "entityType": "@fitness_goal",
      "required": false
    }
  ]
}
```

### Advanced: Conditional Prompts

```typescript
// In fulfillment webhook
if (parameters.date && !parameters.time) {
  // Suggest times based on day
  if (parameters.date === "Monday") {
    return "Monday slots: 9am, 1pm, 6pm. Which works?";
  }
}
```

## Best Practices

### Entity Design

✅ **DO**:

- **Keep entries focused** (don't mix unrelated concepts)
- **Add comprehensive synonyms** (how users actually talk)
- **Use fuzzy matching** for automatic synonym expansion
- **Test with real data** (actual customer messages)

❌ **DON'T**:

- Create overly broad entities (@any_input)
- Skip common synonyms/slang
- Assume formal language only

### Slot Filling

✅ **DO**:

- Mark critical parameters as **required**
- Provide **3+ prompt variations** (avoid repetition)
- Use **context in prompts** ("What time on $date?")
- Give **specific options** ("9am, 1pm, or 6pm?")

❌ **DON'T**:

- Make all parameters required (overwhelming)
- Use generic prompts ("Please provide information")
- Ask for same info twice

### Parameter Naming

Use clear, descriptive names:

- ✅ `appointment_date`, `customer_name`, `fitness_goal`
- ❌ `param1`, `data`, `input`

### Example: Complete Intent with Entities

```json
{
  "name": "book_appointment",
  "trainingPhrases": [
    "book for Monday at 6pm",
    "schedule me",
    "I want to start"
  ],
  "parameters": [
    {
      "name": "date",
      "entityType": "@sys.date",
      "required": true,
      "prompts": [
        "What day works? Monday, Wednesday, Friday?",
        "When would you like to start?"
      ]
    },
    {
      "name": "time",
      "entityType": "@sys.time",
      "required": true,
      "prompts": [
        "What time on $date?",
        "Morning (9am), midday (1pm), or evening (6pm)?"
      ]
    },
    {
      "name": "goal",
      "entityType": "@fitness_goal",
      "required": false
    }
  ],
  "responses": ["Perfect! Booked for $date at $time. See you soon! 🎉"]
}
```

## Testing Entities

### Dialogflow Console

1. **Test Panel** → Enter message
2. **Check extracted parameters**
3. **Verify values are correctly mapped**

### Example Test Cases

```
Input: "Monday at 6pm"
Expected:
  date: "2026-02-10" (next Monday)
  time: "18:00:00"

Input: "I want to lose weight and build muscle"
Expected:
  goal: ["weight_loss", "muscle_gain"]

Input: "it's too expensive"
Expected:
  objection: "price"
```

## API Usage

```typescript
import { SessionsClient } from "@google-cloud/dialogflow";

const response = await sessionClient.detectIntent({
  session: sessionPath,
  queryInput: {
    text: { text: "book for Monday at 6pm", languageCode: "en-US" },
  },
});

const parameters = response[0].queryResult.parameters;
console.log(parameters);
// Output:
// {
//   date: "2026-02-10",
//   time: "18:00:00"
// }
```
