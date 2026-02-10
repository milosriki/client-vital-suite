# Lisa Agent Orchestrator Refactor — Detailed Plan

## Status: Mid-refactor (battery died). All 13 shared modules are COMPLETE and production-ready.

---

## PHASE 1: Fix Critical Bugs (Must-fix before deploy)

### 1.1 — `response-parser.ts`: Missing `InternalThought` type
- **Bug:** Imports `InternalThought` from `smart-prompt.ts`, but that file exports `ConversationContext`, NOT `InternalThought`.
- **Fix:** Define `InternalThought` interface in `smart-prompt.ts` or inline it in `response-parser.ts`.
- **Impact:** CRITICAL — will crash at runtime.

### 1.2 — `dialogflow-fulfillment/index.ts`: Rate limiter API mismatch
- **Bug (Line ~48):** `checkRateLimit(ip, RATE_LIMITS.chat)` passes a string IP, but `checkRateLimit()` expects a `Request` object. Also checks return as boolean, but it returns `{ allowed, response, headers }`.
- **Fix:** Change to `checkRateLimit(req, RATE_LIMITS.chat).allowed`.
- **Impact:** CRITICAL — rate limiting completely broken.

### 1.3 — `aisensy-orchestrator/index.ts`: Stale comment artifact
- **Bug (Line ~84):** Contains `// ... (existing imports)` — a copy-paste artifact from the refactor session.
- **Fix:** Remove the comment.
- **Impact:** LOW — cosmetic only.

### 1.4 — `aisensy-orchestrator/index.ts`: Webhook secret bypass
- **Bug:** If `AISENSY_WEBHOOK_SECRET` env var is missing, ALL requests are silently accepted (returns `true`).
- **Fix:** Throw error instead of silently allowing. Log a CRITICAL warning.
- **Impact:** CRITICAL SECURITY — unsigned requests bypass auth.

### 1.5 — `observability.ts`: Duplicate model keys
- **Bug:** `claude-4-5-sonnet` defined twice, `gemini-3.0-flash` defined three times. Last value wins silently.
- **Fix:** Deduplicate. Keep correct pricing per model variant.
- **Impact:** MEDIUM — cost tracking will be wrong.

---

## PHASE 2: Complete the Orchestrator Refactors

### 2.1 — `aisensy-orchestrator/index.ts`
The refactor is ~90% done. Remaining work:
- [ ] Remove stale `// ... (existing imports)` comment
- [ ] Verify `EdgeRuntime.waitUntil()` availability (Supabase Edge Functions support it natively via `Deno.serve` context)
- [ ] Add fallback for `EdgeRuntime` not being available
- [ ] Verify `whatsapp_interactions` table column names match query (`message_text`, `response_text`, `phone_number`)
- [ ] Add basic retry for AISensy API delivery failure (1 retry with 2s delay)
- [ ] Test audio transcription path end-to-end

### 2.2 — `dialogflow-fulfillment/index.ts`
The refactor is ~95% done. Remaining work:
- [ ] Fix rate limiter call (Phase 1.2)
- [ ] Fix `RepairEngine.generateRepairPrompt()` call — passes empty `[]` for history, should pass actual chat context
- [ ] Validate `ask_atlas` tool call schema before executing
- [ ] Replace `"test-user"` phone fallback with proper error (reject request if no phone)
- [ ] Verify `syncToHubSpot()` error handling surfaces to caller

---

## PHASE 3: Integration Verification

### 3.1 — Type consistency across modules
- Verify `SentimentResult` type flows correctly from `sentiment.ts` → both orchestrators
- Verify `RepairResult` type flows correctly from `repair-engine.ts` → both orchestrators
- Verify `parseAIResponse()` return type matches what orchestrators expect

### 3.2 — Shared module API contracts
| Module | Method Used By AISensy | Method Used By Dialogflow | Verified |
|--------|----------------------|--------------------------|----------|
| smart-prompt | `buildSmartPrompt()` | `buildSmartPrompt()` | [ ] |
| response-parser | `parseAIResponse()` | `parseAIResponse()` | [ ] |
| lead-scorer | `calculateLeadScore()` | `calculateLeadScore()` | [ ] |
| sentiment | `SentimentTriage.analyze()` | `SentimentTriage.analyze()` | [ ] |
| repair-engine | `RepairEngine.detectLoop()` | `RepairEngine.detectLoop()` | [ ] |
| content-filter | `contentFilter.sanitize()` | N/A | [ ] |
| anti-robot | `AntiRobot.humanize()` | `AntiRobot.humanize()` | [ ] |
| unified-ai-client | `unifiedAI.chat()`, `.transcribeAudio()` | `unifiedAI.chat()` | [ ] |

### 3.3 — Database schema verification
- [ ] `conversation_intelligence` table: Confirm columns match upsert fields
- [ ] `whatsapp_interactions` table: Confirm columns match insert fields
- [ ] `agent_tasks` table: Confirm exists for `ask_atlas` tool delegation

---

## PHASE 4: Deploy to Supabase

### 4.1 — Deploy shared modules first (they're dependencies)
```bash
# These deploy automatically with any function that imports them
```

### 4.2 — Deploy functions in order
```bash
supabase functions deploy aisensy-orchestrator --no-verify-jwt
supabase functions deploy dialogflow-fulfillment --no-verify-jwt
```

### 4.3 — Verify environment variables are set
- [ ] `AISENSY_API_KEY`
- [ ] `AISENSY_WEBHOOK_SECRET`
- [ ] `HUBSPOT_API_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `GEMINI_API_KEY` (for unified-ai-client)

### 4.4 — Smoke test
- Send test WhatsApp message via AISensy → verify response
- Send test Dialogflow webhook → verify fulfillment response
- Check `conversation_intelligence` table for new record
- Check HubSpot for synced note

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `InternalThought` crash | 100% | Deploy fails | Fix in Phase 1.1 |
| Rate limiter crash | 100% | All Dialogflow requests fail | Fix in Phase 1.2 |
| Webhook bypass | Medium | Security hole | Fix in Phase 1.4 |
| EdgeRuntime missing | Low | Background sync lost | Add try/catch fallback |
| DB schema mismatch | Low | Silent data loss | Verify in Phase 3.3 |

---

## Estimated Work
- Phase 1 (Critical fixes): ~30 min
- Phase 2 (Complete refactors): ~45 min
- Phase 3 (Verification): ~20 min
- Phase 4 (Deploy + smoke test): ~15 min
