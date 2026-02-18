# PRD: Predictive Intelligence Engine

## Context
PTD Fitness has 218 active packages, 259 active clients, 6,589 recent sessions.
We have `client_packages_live` with sessions_per_week, remaining_sessions, days_until_depleted.
We have `training_sessions_live` with 90 days of session history per client.
We have `deals` with AED values and `daily_business_metrics` with 90 days of trends.

## The Predictive Models (Edge Functions)

### 1. Churn Prediction Score (0-100)
Inputs per client:
- sessions_per_week trend (increasing/decreasing/stable)
- days_since_last_session
- remaining_sessions / pack_size ratio
- future_booked count
- historical cancellation rate (cancelled sessions / total sessions)

Formula:
```
churn_risk = (
  days_since_last * 0.3 +
  (1 - sessions_ratio) * 0.25 +
  decline_trend * 0.2 +
  (1 - has_future_booking) * 0.15 +
  cancel_rate * 0.1
) * 100
```

### 2. Revenue Projection (Next 30/60/90 days)
Based on:
- Packages expiring within window (days_until_depleted)
- Historical renewal rate (from deals closedwon with same contacts)
- Package values
- Projection = sum(package_value * renewal_probability) for each window

### 3. Coach Effectiveness Score
Based on:
- Client retention (% of clients still active after 90 days)
- Session completion rate
- Client frequency improvement (did clients train more after starting with this coach?)
- Churn rate of their clients vs average

## Tasks

- [ ] Create `supabase/functions/predict-churn/index.ts` — calculates churn score for each client in `client_packages_live`, stores result in a `churn_predictions` column (add via ALTER TABLE) or a new `client_predictions` table
- [ ] Create `supabase/functions/revenue-forecast/index.ts` — calculates 30/60/90 day revenue projections, stores in `revenue_forecasts` table
- [ ] Create `src/pages/PredictiveIntelligence.tsx` — dashboard showing: churn risk heatmap, revenue forecast chart (bar chart 30/60/90), coach effectiveness leaderboard, top 10 at-risk clients with recommended actions
- [ ] Add route + nav item
- [ ] Build passes, git commit + push
