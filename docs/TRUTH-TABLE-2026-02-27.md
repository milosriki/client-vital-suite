# TRUTH TABLE — What's Done vs What Remains
> Generated: 2026-02-27 13:55 GST | Source: Live codebase scan

## ✅ DONE (15 commits shipped)

| Wave | Item | Evidence |
|------|------|----------|
| Security | API auth + CORS lockdown | `rg "Access-Control-Allow-Origin.*\*" api/` → 0 |
| Security | Webhook HMAC verification (CallGear, AnyTrack, Calendly) | Commit 4369980 |
| Security | Math.random → crypto.randomUUID | `rg "Math.random" src/` → 1 (archived only) |
| Security | Qwen/Alibaba stripped from meta-ads-proxy | Commit 697f824 |
| Security | Hardcoded secrets removed from scripts | Commits aaf6e56, 00a1666 |
| Tests | 14/14 passing, 2 suites | `npx vitest run` → green |
| CI | Both GitHub Actions workflows green | Commit 203e26c fixed deno.lock |
| Models | gemini-2.0-flash → 0 refs | `rg "gemini-2.0-flash"` → 0 |
| Models | All engines on gemini-3.1 family | Commit 87f3782 |
| Health | client_health_scores → client_health_daily (137 refs) | `rg "client_health_scores"` → 0 |
| Health | Health-score-engine v3 + satisfaction placeholder | Commit d370ceb |
| CORS | 19 API routes locked to personaltrainersdubai.com | Commit 3b33858 |
| Docs | CRON_MANIFEST.md + WIRING_ANALYSIS.md | Commit da520f1 |
| Cleanup | Archived routes redirect to active pages | Commit 09839f4 |
| Deploy | Edge functions deployed + Vercel production live | CI green |

## 🔴 REMAINING (ranked by impact)

| # | Item | Count | Impact | Effort |
|---|------|-------|--------|--------|
| 1 | **14 migrations not applied to prod** | 14 SQL | CRITICAL — views/crons don't exist in prod | 30min |
| 2 | **api/brain.ts text-embedding-004** | 2 refs | RAG brain endpoint broken on new model | 15min |
| 3 | **LangSmith dead code** | 150 refs | Noise/confusion, ~5 files core | 1h |
| 4 | **remote_stub migrations** | 7 files | Noise in migration folder | 10min |
| 5 | **Uncommitted script changes** | 7 files | Drift risk | 5min |
| 6 | **VITE_PTD_INTERNAL_ACCESS_KEY in bundle** | 5 refs | Acceptable internal pattern per Milos | WONTFIX |
| 7 | **ESLint 400 errors (mostly `any`)** | 400 | Code quality, not functionality | 4-6h |
| 8 | **console.log in 55 files** | 55 | Noise in console | 2h |
| 9 | **Missing error boundaries (3 pages)** | 3 | Pages crash on error instead of fallback | 30min |
| 10 | **Test coverage gap** | 14/~200 | Confidence gap | 8h+ |

## 🧠 9 INTELLIGENCE ENGINES — ALL PRESENT

All 9 edge functions exist, deployed, and on correct models:
1. health-score-engine (v3) ✅
2. client-intelligence-engine ✅
3. coach-intelligence-engine ✅
4. ml-churn-score ✅
5. proactive-insights-generator ✅
6. ptd-brain-api ✅
7. ai-analyst-engine ✅
8. ai-ceo-master ✅
9. ptd-ultimate-intelligence ✅

## 🖥️ 28 ACTIVE PAGES — ALL ROUTED

60 routes in main.tsx: 28 active pages + 24 redirects from legacy URLs + login + 404

## KEY INSIGHT

The app is 90% done. The gap is NOT missing code — it's:
1. **14 pending migrations** that create views/crons the engines need
2. **1 embedding model ref** in the brain API
3. **Dead code noise** (LangSmith, stubs)

Apply migrations + fix brain.ts = app is functionally complete.
