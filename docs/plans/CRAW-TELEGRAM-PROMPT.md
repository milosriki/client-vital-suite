# COPY-PASTE TO CRAW VIA TELEGRAM
# Split into 2 messages if Telegram truncates (split at the --- marker)

---

Ship Vital Suite to 100%. All context verified 2026-02-23 by 6 parallel research agents against live codebase + production DB.

Read the full mission brief:
`cat /Users/milosvukovic/client-vital-suite/docs/plans/CRAW-MISSION-VITAL-SUITE-100PCT.md`

Executive summary of what's left:

**PHASE 1 — DEPLOY (30 min)**
- Push 20+ unpushed commits (build passes, verified)
- Apply 7 pending migrations (watch for timestamp collision at 20260213000005)
- Deploy all edge functions
- Regenerate types.ts

**PHASE 2 — SECURITY (1-2h)**
- meta-ads-proxy has ZERO auth — anyone can invoke Anthropic API + modify Meta Ads. Add verifyAuth.
- callgear-webhook has ZERO auth — anyone can POST fake call data. Add signature check.
- 29 more non-webhook EFs need verifyAuth. Spawn subagents to parallelize.

**PHASE 3 — DATA (2-4h)**
- Verify agent memory RPCs work after migration deploy (2,772 memories waiting)
- Backfill stripe_transactions (0 rows — stripe-backfill never called)
- Convert 2 marketing functions from INSERT to UPSERT (loss-analyst, scout)
- Add CPL/CPO metrics to financial-analytics (currently only has CAC)
- Create currency rate cron (org_memory_kv override mechanism exists but nobody writes to it)

**PHASE 4 — ATTRIBUTION (4-8h)**
- Add stripe_payment_id FK to deals table
- Add fb_ad_id columns to contacts (currently 3-hop indirect join via attribution_events)
- Fix VisualDNA data pipeline so ROAS shows actual values

**PHASE 5 — CLEANUP (2h)**
- 172 select("*") remaining — spawn subagents
- 70 orphaned remote EFs with no local source
- Optionally restore 3 high-value archived pages

CRITICAL — DO NOT:
- Delete ANTHROPIC_API_KEY (active in meta-ads-proxy)
- Delete LOVABLE_API_KEY (active in stripe-forensics)
- Remove enhanced_leads references (19 files depend on it)
- Merge enterprise worktree (457 files diverged)
- Redo Batches 0-6 (all verified complete)
- Try to rename generateWithClaude (doesn't exist — already generateWithAI)

Start with Phase 1. Report back after each phase with verification output.
