# PTD Marketing Intelligence — Tracking Plan

> **Owner:** Antigravity (Claude) | **Version:** 1.0 | **Date:** 2026-02-10

## Event Taxonomy (object_action pattern)

| Event                  | Description                | Properties                                               | Trigger                                             | Decision Supported      |
| :--------------------- | :------------------------- | :------------------------------------------------------- | :-------------------------------------------------- | :---------------------- |
| `lead_created`         | New lead entered system    | `email, utm_source, utm_campaign, fb_ad_id, fb_adset_id` | HubSpot contact webhook                             | CPL, lead volume        |
| `assessment_booked`    | Assessment scheduled       | `email, coach_name, scheduled_date, fb_ad_id`            | HubSpot deal stage → Assessment Scheduled           | Book rate per creative  |
| `assessment_completed` | Attended assessment in AWS | `email, coach_name, training_date, fb_ad_id`             | AWS truth-alignment run (status=Completed/Attended) | Ghost rate, True CPA    |
| `assessment_ghosted`   | Booked but didn't attend   | `email, scheduled_date, fb_ad_id`                        | AWS shows no matching completed session             | Ghost rate per creative |
| `purchase_completed`   | First payment received     | `email, amount, currency, fb_ad_id`                      | Stripe webhook (payment_intent.succeeded)           | Revenue attribution     |
| `client_renewed`       | Package renewal payment    | `email, amount, months_active`                           | Stripe recurring payment                            | LTV per creative        |
| `client_churned`       | Health score <20 for 14d   | `email, last_health_score, days_inactive`                | Health calculator detection                         | Churn rate per source   |
| `creative_fatigue`     | CTR dropped 3d straight    | `ad_id, ad_name, ctr_delta_pct, ctr_today, ctr_3d_avg`   | Predictor agent                                     | Creative refresh signal |
| `budget_adjusted`      | CEO approved budget change | `ad_id, old_budget, new_budget, action`                  | Allocator → CEO approval                            | Spend tracking          |

## Conversion Definitions

| Conversion            | Event                | Counting Rule  | Used By                 |
| :-------------------- | :------------------- | :------------- | :---------------------- |
| **Lead**              | `lead_created`       | Once per email | CPL, funnel top         |
| **Qualified Lead**    | `assessment_booked`  | Once per email | Cost per qualified lead |
| **Customer**          | `purchase_completed` | Once per email | CAC, True CPA           |
| **Retained Customer** | `client_renewed`     | Each renewal   | LTV, retention rate     |

## UTM Conventions

```
utm_source=facebook|google|organic|referral|direct
utm_medium=cpc|social|email|whatsapp
utm_campaign={campaign_name_lowercase_underscores}
utm_content={ad_id_or_creative_variant}
utm_term={target_audience_segment}
```

Rules:

- Lowercase only
- Underscores (no spaces, no dashes)
- Documented in this file (single source of truth)
- Never overwritten client-side

## Signal Quality Targets

| Category              | Current | Target | Action                                  |
| :-------------------- | :------ | :----- | :-------------------------------------- |
| Decision Alignment    | 20/25   | 23/25  | Add 7-day window to stress test         |
| Event Model Clarity   | 12/20   | 17/20  | Standardize naming per table above      |
| Data Accuracy         | 10/20   | 16/20  | Fix attribution discrepancy <15%        |
| Conversion Definition | 8/15    | 13/15  | Add assessment-attended signal          |
| Attribution & Context | 7/10    | 9/10   | Ensure fb_ad_id populated on all events |
| Governance            | 3/10    | 8/10   | This document + event versioning        |
| **TOTAL**             | **60**  | **86** | **Verdict: Measurement-Ready**          |
