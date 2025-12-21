# Predictive Intelligence Implementation (Supabase + Vercel, no Docker required)

This roadmap turns the current rule-based health scores into ML-driven predictions while keeping the browser-only + Supabase Edge + Vercel deployment model intact. It uses lightweight ONNX inference at the edge plus external APIs for heavier models.

## Architecture at a glance
- **Event path:** Webhook (Stripe/HubSpot/Calendly/CallGear) → Supabase Edge Function → feature lookup (Postgres) → edge inference (ONNX) **or** external API → persist prediction → trigger action (email/Slack/HubSpot task) → realtime dashboards.
- **Models:** XGBoost/LightGBM exported to ONNX (≤50 MB, int8 quantized). Use ONNX Runtime for Deno or Transformers.js for compact NLP (sentiment).
- **Deployment:** Edge Functions in `/supabase/functions/*` handle scoring; Vercel `/api/*` can orchestrate batch jobs or expose prediction APIs. No Docker needed.

## Quick win sequence (0–8 weeks)
1) **Weeks 1–2:**
   - Enable Stripe Smart Retries + Card Updater.
   - Create `prediction_features` table (feature store) and `prediction_scores` table (log scores + model_version + thresholds).
   - Add nightly feature refresh edge function to compute: `visits_last_30d`, `no_show_rate_60d`, `days_since_last_call`, `stripe_failures_90d`, `sentiment_trend_30d`, `response_time_to_outreach`, `pricing_page_revisits`, `engagement_velocity`.
   - Ship OpenAI few-shot prompts (no training) for churn + lead + payment-risk as a baseline; store outputs for later backtesting.

2) **Month 1:**
   - Export Python-trained XGBoost models to ONNX; quantize to int8 if >10 MB.
   - Add edge inference helper (Deno + ONNX Runtime) and wrap in functions: `churn_predictor`, `lead_score_predictor`, `payment_failure_predictor`.
   - Run ML scores **in parallel** with rule-based scores; store both in `prediction_scores` with `ground_truth` once outcomes arrive.

3) **Months 2–3:**
   - Add SHAP explanations (precompute with Python, store top features per score) so UI can show "why" alongside the number.
   - Introduce survival analysis (Cox) for time-to-close; serve via external API if too heavy for edge.
   - Implement tiered pre-dunning + outreach playbooks driven by `payment_failure_risk` buckets.

4) **Month 4+:**
   - Automate monthly retraining; trigger when drift metrics exceed thresholds.
   - Add A/B testing of model versions; log lift curves and PR-AUC/ROC-AUC/Brier.

## Feature blueprint (highest-signal predictors)
- **Calendly:** show-rate %, no-show streaks, session frequency trend (30/60/90d), days since last session.
- **CallGear transcripts:** sentiment score + trend, client-initiated vs coach-initiated ratio, call duration trend, cancellation intent phrases.
- **Stripe:** payment success rate, dunning attempts, days-to-collect, days to card expiry, prior failures.
- **HubSpot:** days since last touch, touch frequency trend, activity sentiment (NLP on notes), deal stage velocity, application completeness + time-to-complete.
- **Web/app:** pricing page revisits, application revisit count, response latency to outreach.

## Model guidance
- Use **XGBoost** (or LightGBM) as the primary classifier; set `scale_pos_weight` for class imbalance and tune threshold for ~80% recall / 60%+ precision on churn.
- Optimize for **PR-AUC** and **Brier score** (probability calibration), not only ROC-AUC.
- For payment retry timing, differentiate soft vs hard declines; schedule retries around paydays for debit/insufficient funds.
- Keep hard business guardrails as rules (geo exclusion, competitor filtering) alongside ML probabilities.

## Inference + actions
- **Edge inference (ONNX):** run for lightweight scores (payment risk, lead quick-check). Keep model <50 MB; cache model in memory across invocations.
- **External API fallback:** use OpenAI/SageMaker for heavier churn/LTV models until ONNX versions are ready.
- **Actions:** write to `prediction_scores`, emit Supabase realtime events, enqueue notifications (Slack/email), and create HubSpot tasks based on risk tiers (`0.5–0.7` personal outreach, `>0.7` phone/SMS + payment plan options).

## Validation & drift control
- Log every prediction with: `features_used`, `model_version`, `prediction`, `probability`, `action_taken`, `outcome_at_t+X`.
- Track **population stability index** for feature drift and compare prediction distributions week-over-week.
- Backtest against historical outcomes; run champion/challenger models in parallel.
- Avoid leakage: only use features available at prediction time (exclude future-looking aggregates).

## UI & DX hooks (browser-first)
- Surface SHAP top-factors in dashboards next to scores ("85% risk because: -45% attendance, 2 missed payments, negative sentiment").
- Add console/agent prompts to run live checks: "Predict churn for client X" → calls `/api/predict/churn?client_id=...` → streams result.
- Keep everything runnable from Vercel + Supabase; no Docker required.
