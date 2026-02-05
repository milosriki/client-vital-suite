# Dialogflow ES Best Practices for Conversational Sales

## 1. Intent Design Strategy

### The "Granularity Goldilocks Zone"

- **Too Broad**: `User wants info` (Catch-all, low precision)
- **Too Narrow**: `User wants price for Tuesday at 5pm` (Overfit, hard to maintain)
- **Just Right**: `sales.inquiry.price` (Specific intent, flexible entities)

### Naming Conventions

Use a hierarchical naming scheme to organize intents logically:

- `sales.discovery` (Top level)
- `sales.discovery.goals` (Drill down)
- `sales.qualification.budget`
- `sales.booking.time_selection`
- `support.technical.login_issue`

## 2. Training Data Excellence

### The Rule of 15-20

Provide **15-20 diverse training phrases** for every intent.

- Mix lengths: "Book now" vs "I was wondering if I could schedule a session"
- Mix vocabulary: "Book", "Schedule", "Reserve", "Grab a slot"
- Mix parameter placement: "Monday at 5pm" (End), "At 5pm on Monday" (Start)

### "Anti-Patterns" to Avoid

- **Single-word Phrases**: Avoid training on just "price" or "book". Only use these if the intent is strictly keyword-based (which defeats the purpose of NLP).
- **Overlapping Phrases**: Ensure phrases in Intent A don't look exactly like Intent B.

## 3. Context Management (The Secret Sauce)

### Lifespan Discipline

- Default lifespan is **5 turns**. This is often too long for sales flows where topics shift rapidly.
- **Recommendation**: Set output context lifespan to **1 or 2** for rapid turns (e.g., asking for a date).
- **Resetting**: Use a "reset" intent/webhook logic to clear contexts if the user changes the subject completely ("Actually, forget booking, how much is it?").

## 4. Entity Extraction Strategy

### Composite Entities

Combine entities to capture complex information.

- Instead of just `@sys.date` and `@sys.time`, create a `@booking_slot` that wraps them. This helps in extracting "Next Tuesday afternoon".

### System vs Custom

- Always prefer **System Entities** (`@sys.date`, `@sys.geo-city`) for standard data.
- Use **Map Entities** (synonyms) for domain-specific terms (e.g., "PT", "Personal Training", "1-on-1" all mapping to `service_pt`).

## 5. Fulfillment & Webhooks

### The "Three-Second Rule"

- WhatsApp (via AISensy) expects a quick response. Ensure your webhook responds within **3 seconds**, or the user might retry/leave.
- **Async Processing**: If you need to do heavy lifting (CRM sync, complex calc), return a "One moment please..." response immediately, then send the actual result asynchronously via the AISensy API.

### Fail-Safe Logic

- Always wrap webhook logic in `try/catch`.
- If the webhook fails, Dialogflow should have a static response configured in the console as a fallback. Do not rely 100% on the webhook text.

## 6. Testing & Validation

### Validation Sets

- Keep a spreadsheet of "Golden Phrases" that _must_ always match correctly.
- Run a regression test (using the API) whenever you retrain the model to ensure you haven't broken existing intents.

### Confidence Thresholds

- By default, ML Threshold is 0.3.
- **Sales Advice**: Increase to **0.5 or 0.6** to avoid false positives. It's better to trigger a "Sorry, can you rephrase?" than to confidently book the wrong service.
