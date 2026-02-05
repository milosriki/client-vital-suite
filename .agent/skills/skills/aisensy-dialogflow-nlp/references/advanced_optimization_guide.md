# Advanced Dialogflow Optimization & Tuning Guide

## 1. Handling "Out of Scope" (The False Positive Problem)

### The Problem

Users often say things your bot isn't trained for. If your agent tries to match these to sales intents, it looks stupid.

### The Solution: "Negative Examples" Fallback

1. Creates a `sys.fallback` intent.
2. But effectively, create a **Shadow Intent** called `smalltalk.garbage` or `general.noise`.
3. Train it with phrases that are clearly _not_ sales related but common (e.g., "What is the weather?", "Who won the game?", "I like pizza").
4. This acts as a "magnet" for irrelevant input, keeping your sales intents clean.

## 2. The "Slot Filling" Trap

### Why it fails in Sales

Dialogflow's built-in "Slot Filling" (checking boxes for required params) loops endlessly if the user asks a question instead of answering.

- Bot: "What date?"
- User: "How much is it?"
- Bot: "What date?" (Annoying!)

### The "Webhook Slot Filling" Strategy

**Disable** built-in slot filling for complex sales flows. Instead:

1. Intent: `booking.request` (captures whatever checks user gave).
2. Webhook:
   - Check: Do I have date? No.
   - Response: "I can verify the price for you, but first I need to know a rough date?"
3. This allows the webhook to handle the _logic_ of missing data intelligently, allowing for topic switches.

## 3. Hybrid Classification (Keywords + ML)

### When ML isn't enough

Sometimes precise product codes or specific ID numbers confuse the ML model.

### Strategy

1. Use **Regex Entities** for IDs (e.g., Order ID `#[0-9]{4}`).
2. If regex matches, trust it 100% over ML intent confidence.
3. In your webhook, check entities first. If a valid Order ID is present, force-route to "Order Status" logic, even if the intent score was low.

## 4. Sentiment Analysis Routing

### Detecting Frustration

Enable Google Cloud Sentiment Analysis.

- If `sentiment.score < -0.4`:
- **IMMEDIATE HANDOFF**: Do not try to sell.
- Route to `handoff.human` intent.
- Tag user in AISensy as `frustrated_lead`.

## 5. Automated "Confusion Matrix" Testing

### How to tune professionally

Run a script that sends 100 test phrases against your agent.

- Create a matrix: Expected Intent vs Actual Intent.
- Identify "Confused Pairs": e.g., `pricing` and `booking` often overlapping.
- **Fix**: Look at training phrases for both. Remove ambiguous phrases that could mean either. Make them distinct.

## 6. Variable Response Timing

### Mimicking Humans

- Don't reply instantly to long messages.
- Webhook Logic:
  - If response length < 50 chars -> 1s delay.
  - If response length > 200 chars -> 3s delay.
- This psychological trick makes the "Sales Agent" feel more thoughtful and less robotic.
