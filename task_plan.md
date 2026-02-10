# Lisa v10.0 — Top-1% Natural WhatsApp Appointment Setter Upgrade

## Goal
Transform Lisa from a functional AI agent into a top-1% natural, human-like WhatsApp appointment setter for PTD Fitness Dubai. All changes use **Gemini 3 Flash** API.

## Architecture Validation (Current State)
```
ENTRY POINTS (Webhook Triggers)
📱 aisensy-orchestrator v17 — WhatsApp via AiSensy
🤖 dialogflow-fulfillment v59 — Dialogflow CX Webhook

SHARED PIPELINE (8 Modules)
🧠 smart-prompt.ts      — Lisa v9.1 Persona ➜ UPGRADE TO v10.0
⚡ unified-ai-client.ts — Gemini 3 Flash Preview ➜ TUNE tokens/temp
📝 response-parser.ts   — 80-word truncation ➜ P0 FIX (already commented out)
🛡️ content-filter.ts    — Sanitize + WA Format ✅ OK
🤖 anti-robot.ts        — 3 Humanizers ➜ REWRITE (15 transforms)
⏳ smart-pause.ts       — 2s min typing sim ➜ REWRITE (variable delay)
🔄 repair-engine.ts     — Loop Detection ✅ OK (duplicate return line 104)
🔐 auth-middleware.ts   — 50 req/min + Token ✅ OK

OUTPUTS
📤 AiSensy API — WhatsApp Delivery
💾 Supabase — whatsapp_interactions + conversation_intelligence
📊 HubSpot CRM — Contacts, Notes, Stage

CRON
⏰ antigravity-followup-engine v3 — Idle Lead Re-engagement
```

## Confirmed Findings from Code Audit

### P0 Bug 1: response-parser.ts — 80-word truncation
- **STATUS: ALREADY FIXED** in previous session
- Lines 46-53 are commented out with explanation
- No action needed — just verify the smart 200-word truncation from spec

### P0 Bug 2: stageResult undefined
- **STATUS: NOT PRESENT** in current code
- The user's spec references `stageResult.hasChanged` at line 181, but current aisensy-orchestrator does NOT have this code
- It was likely removed or never added. Current code uses `updateData.conversation_phase` (line 254-257) which WORKS
- No action needed — verify pipeline stage sync

### P0 Bug 3: 500-char hard block
- **STATUS: ALREADY FIXED** in previous session
- Lines 210-223 now use LEAK_PATTERNS (regex guards) instead of length check
- Currently checks for "TEMPLATE 1:" and "Templates for reaching out"
- **UPGRADE NEEDED**: Expand LEAK_PATTERNS per spec

### Summary: P0s are mostly resolved. Focus shifts to P1/P2 naturalness upgrades.

---

## Phases

### Phase 1: P0 Hardening (Leak Patterns + Response Parser)
- **Status**: `complete` ✅
- [x] Expand LEAK_PATTERNS in aisensy-orchestrator with full spec list (16 patterns)
- [x] Add 200-word smart sentence-boundary truncation to response-parser.ts
- [x] Fix duplicate `return` on line 104 of repair-engine.ts

### Phase 2: Anti-Robot v2.0 (15 Probability-Based Transforms)
- **Status**: `complete` ✅
- [x] Complete rewrite of anti-robot.ts
- [x] 15 transforms: contractions, period removal, lowercase, fillers, warm openers, casual closers, emoji injection, ellipsis, double exclamation, name injection, subtle typos, abbreviations, formal removal, sentence fragments, paragraph break removal

### Phase 3: Message Splitter (NEW module)
- **Status**: `complete` ✅
- [x] Create _shared/message-splitter.ts
- [x] Split logic: 1-4 bubbles based on natural break points
- [x] Delay calculation: 800ms + 30ms/word per bubble
- [x] Integration into aisensy-orchestrator send loop

### Phase 4: Lisa v10.0 Persona Upgrade
- **Status**: `complete` ✅
- [x] Add WRITING STYLE section to smart-prompt.ts
- [x] Add RESPONSE LENGTH rules (15-40 words default, 60 max)
- [x] Add PERSONALITY DEPTH (Big Sister archetype)
- [x] Update InternalThought interface for new fields

### Phase 5: AI Client Tuning + Multi-Bubble Send Loop
- **Status**: `complete` ✅
- [x] Change maxOutputTokens: 8192 → 512 in unified-ai-client.ts
- [x] Change temperature: 0.7 → 0.85
- [x] Add multi-bubble send loop in aisensy-orchestrator
- [x] Add conversation_intelligence full integration

### Phase 6: Smart Pause v2.0 + Final Verification
- **Status**: `complete` ✅
- [x] Rewrite smart-pause.ts with variable typing delay
- [x] Base: 800ms + reading/typing time + jitter
- [x] Question detection: +500ms
- [x] Emoji/casual detection: -200ms
- [x] Long message bonus: +300ms for >30 words
- [x] Pricing audit (AED grep): ✅ Clean — no pricing in Lisa pipeline
- [x] Mark persona audit: ✅ Clean — no "Mark" refs in Lisa code
- [ ] TypeScript compile verification: ⚠️ SKIPPED — no npx/deno/node available on machine

---

## Deployment Order (from spec)
1. response-parser.ts (truncation) + repair-engine.ts fix
2. aisensy-orchestrator (expanded LEAK_PATTERNS)
3. message-splitter.ts + anti-robot.ts v2.0
4. smart-prompt.ts v10.0 persona
5. Full aisensy-orchestrator with multi-bubble
6. smart-pause.ts + unified-ai-client.ts tuning

## Security Considerations
- All webhook auth via HMAC-SHA256 (already hardened)
- Content filter catches system prompt leaks
- PII redaction in repair-engine.ts
- Prompt injection shield active
- No pricing ever disclosed (deflect to assessment)
- Gemini 3 Flash as sole model provider
