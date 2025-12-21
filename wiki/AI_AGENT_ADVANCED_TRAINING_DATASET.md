# AI Agent Advanced Training Dataset - Complex Multi-System Scenarios

## Overview
This dataset contains 50 advanced cross-check questions designed to train AI agents on complex, real-world scenarios that require:
- **Multi-tool orchestration** (2-5 tools per query)
- **Cross-system data correlation** (HubSpot + Stripe + Health + Calls)
- **Advanced reasoning** (pattern detection, anomaly identification, predictive analysis)
- **Edge case handling** (missing data, conflicting sources, time-based logic)
- **Business decision support** (ROI calculations, intervention prioritization, risk assessment)

---

## Category 1: Multi-System Client Intelligence (10 Questions)

### Q1: Client Health + Financial Risk Analysis
**Scenario**: A client's health score dropped but they just made a payment. Need to understand if payment is legitimate or if they're trying to buy time before churning.

**User Query**: "John Smith's health score dropped to 45 (Red Zone) last week, but he just paid AED 5,000 yesterday. Is this payment legitimate or should we flag it for review?"

**Required Tools**:
1. `universal_search` - Find John Smith by name/email
2. `client_control` (action: get_all) - Get full client profile
3. `stripe_control` (action: fraud_scan) - Check payment patterns
4. `churn-predictor` - Get churn risk score
5. `intervention-recommender` - Get recommended actions

**Logic Flow**:
```
STEP 1: Search for John Smith
  → Use universal_search with query "John Smith"
  → Extract email/contact_id

STEP 2: Get comprehensive client data
  → client_control.get_all(email)
  → Extract: health_score, health_zone, sessions_last_7d, days_since_last_session, outstanding_sessions

STEP 3: Analyze payment history
  → stripe_control.fraud_scan(email)
  → Check: payment frequency, refund history, card changes, instant payout patterns
  → Compare: payment amount vs. package value, payment timing vs. health decline

STEP 4: Cross-reference churn prediction
  → churn-predictor(email, days_ahead=30)
  → Get: churn_probability, risk_factors, days_to_churn

STEP 5: Decision logic
  IF (health_score < 50 AND days_since_last_session > 14 AND payment_amount > outstanding_sessions * avg_session_price)
    THEN flag = "SUSPICIOUS - Possible last-ditch payment before churn"
  ELSE IF (fraud_score > 0.7 OR instant_payout_flag)
    THEN flag = "HIGH RISK - Fraud patterns detected"
  ELSE IF (churn_probability > 0.8 AND payment_timing_coincides_with_intervention_call)
    THEN flag = "LIKELY LEGITIMATE - Responsive to intervention"
  ELSE flag = "REVIEW REQUIRED - Cross-check with call transcripts"

STEP 6: Get intervention recommendations
  → intervention-recommender(client_email, zone="red")
  → Extract: recommended_actions, success_probability
```

**Expected Outcome**:
- Risk assessment: "HIGH RISK" or "LIKELY LEGITIMATE" or "REVIEW REQUIRED"
- Evidence: Payment pattern analysis, health trend, churn probability
- Recommendation: Specific action (e.g., "Schedule intervention call within 24h" or "Flag for fraud review")

**Data Sources**:
- `contacts` table (client profile)
- `client_health_scores` table (health metrics)
- `stripe_payments` table (payment history)
- `stripe_forensics` table (fraud patterns)
- `churn_predictions` table (ML predictions)

---

### Q2: Coach Performance + Client Health Correlation
**Scenario**: A coach's clients are all dropping into Red Zone. Need to determine if it's coach performance issue or external factors.

**User Query**: "Coach Mike has 8 clients, and 6 of them dropped to Red Zone this month. Is this a coach performance problem or something else?"

**Required Tools**:
1. `get_coach_clients` - Get all clients for Coach Mike
2. `client_control` (action: get_health) - Get health scores for each client
3. `analytics_control` (dashboard: coaches) - Get coach performance metrics
4. `call_control` (action: find_patterns) - Analyze call patterns
5. `anomaly-detector` - Detect unusual patterns

**Logic Flow**:
```
STEP 1: Get coach's client list
  → get_coach_clients(coach_name="Mike")
  → Extract: client_emails[], client_count, assignment_dates[]

STEP 2: Get health scores for all clients
  → FOR EACH client_email:
      client_control.get_health(email)
  → Extract: health_score, health_zone, health_trend, days_since_last_session

STEP 3: Calculate metrics
  → red_zone_count = COUNT(health_zone == "RED")
  → red_zone_percentage = (red_zone_count / total_clients) * 100
  → avg_health_score = AVG(health_scores)
  → health_decline_rate = COUNT(health_trend == "DECLINING") / total_clients

STEP 4: Get coach performance data
  → analytics_control(dashboard="coaches", coach="Mike")
  → Extract: avg_client_health, client_retention_rate, session_completion_rate, call_response_time

STEP 5: Analyze call patterns
  → call_control.find_patterns(coach="Mike", days=30)
  → Extract: call_frequency, avg_call_duration, no_show_rate, cancellation_rate

STEP 6: Run anomaly detection
  → anomaly-detector(type="coach_performance", coach="Mike")
  → Extract: anomaly_score, detected_patterns, comparison_to_peers

STEP 7: Decision logic
  IF (red_zone_percentage > 60% AND coach_retention_rate < 0.7 AND call_frequency < peer_avg)
    THEN issue = "COACH PERFORMANCE - Low engagement, poor retention"
  ELSE IF (red_zone_percentage > 60% AND all_clients_assigned_recently < 30_days)
    THEN issue = "NEW CLIENT COHORT - Normal onboarding challenges"
  ELSE IF (red_zone_percentage > 60% AND anomaly_score > 0.8 AND external_factors_detected)
    THEN issue = "EXTERNAL FACTORS - Market conditions or seasonal patterns"
  ELSE issue = "MIXED - Requires deeper investigation"

STEP 8: Cross-reference with business intelligence
  → Check if other coaches show similar patterns (market-wide issue)
  → Check if specific client segments affected (package type, location)
```

**Expected Outcome**:
- Root cause: "COACH PERFORMANCE", "NEW CLIENT COHORT", "EXTERNAL FACTORS", or "MIXED"
- Evidence: Specific metrics (retention rate, call frequency, health scores)
- Action plan: "Schedule coach training" or "Review client assignments" or "Monitor market trends"

**Data Sources**:
- `coaches` table (coach profiles)
- `client_health_scores` table (health metrics)
- `calls` table (call records)
- `coach_performance` table (aggregated metrics)
- `anomaly_detections` table (pattern analysis)

---

### Q3: Lead Conversion Funnel Analysis with Attribution
**Scenario**: Need to understand why leads from Facebook aren't converting, but need to trace the full journey from ad click to deal closure.

**User Query**: "Facebook leads from campaign 'Summer Fitness 2024' have a 5% conversion rate, but our target is 18%. Where are we losing them in the funnel?"

**Required Tools**:
1. `lead_control` (action: get_by_status) - Get leads by source/campaign
2. `sales_flow_control` (action: get_pipeline) - Get pipeline stages
3. `analytics_control` (dashboard: campaigns) - Get campaign metrics
4. `call_control` (action: get_calls) - Get call outcomes
5. `ultimate-truth-alignment` - Cross-reference attribution data

**Logic Flow**:
```
STEP 1: Get all leads from campaign
  → lead_control.get_by_status(status="all", campaign="Summer Fitness 2024")
  → Extract: lead_count, lead_emails[], created_dates[], sources[]

STEP 2: Map leads to pipeline stages
  → sales_flow_control.get_pipeline()
  → FOR EACH lead_email:
      Find current stage (lead → qualified → demo → proposal → closed)
  → Calculate: stage_distribution[], drop_off_points[]

STEP 3: Analyze call outcomes
  → call_control.get_calls(lead_emails, days=90)
  → Extract: call_count, no_answer_rate, callback_rate, qualified_rate, demo_scheduled_rate

STEP 4: Get campaign attribution data
  → ultimate-truth-alignment(time_window_hours=720, source="facebook")
  → Extract: ad_clicks, lead_form_submissions, cost_per_lead, attribution_confidence

STEP 5: Calculate conversion funnel
  → Stage 1: Ad Click → Lead Form (attribution_data)
  → Stage 2: Lead Form → First Call (call_data)
  → Stage 3: First Call → Qualified (call_outcomes)
  → Stage 4: Qualified → Demo Scheduled (pipeline_data)
  → Stage 5: Demo → Proposal (pipeline_data)
  → Stage 6: Proposal → Closed Won (pipeline_data)

STEP 6: Identify bottlenecks
  → FOR EACH stage:
      Calculate: conversion_rate, drop_off_count, avg_time_in_stage
  → Identify: stage_with_highest_drop_off, stage_with_longest_time

STEP 7: Cross-reference with campaign data
  → analytics_control(dashboard="campaigns", campaign="Summer Fitness 2024")
  → Extract: ROAS, cost_per_acquisition, lead_quality_score

STEP 8: Decision logic
  IF (drop_off_stage == "Lead Form → First Call" AND no_answer_rate > 0.6)
    THEN issue = "LEAD QUALITY - Leads not responding to calls"
  ELSE IF (drop_off_stage == "First Call → Qualified" AND callback_rate < 0.3)
    THEN issue = "SETTER PERFORMANCE - Not qualifying leads properly"
  ELSE IF (drop_off_stage == "Demo → Proposal" AND demo_no_show_rate > 0.4)
    THEN issue = "DEMO PROCESS - High no-show rate"
  ELSE IF (drop_off_stage == "Proposal → Closed" AND proposal_response_time > 48h)
    THEN issue = "SALES PROCESS - Slow follow-up after proposal"
  ELSE issue = "MULTIPLE BOTTLENECKS - Requires comprehensive review"
```

**Expected Outcome**:
- Primary bottleneck: Specific stage with highest drop-off
- Conversion rates: Per-stage breakdown (e.g., "Lead→Call: 40%, Call→Qualified: 25%")
- Root cause: "LEAD QUALITY", "SETTER PERFORMANCE", "DEMO PROCESS", or "SALES PROCESS"
- Action plan: Specific recommendations (e.g., "Improve lead qualification criteria" or "Reduce demo no-show rate")

**Data Sources**:
- `leads` table (lead records)
- `deals` table (pipeline stages)
- `calls` table (call outcomes)
- `ultimate_truth_events` table (attribution data)
- `campaigns` table (campaign metrics)

---

### Q4: Revenue Leak Detection Across Systems
**Scenario**: Revenue is down but can't identify the source. Need to cross-reference Stripe payments, HubSpot deals, and client health to find the leak.

**User Query**: "Our revenue dropped 15% this month compared to last month. Where is the money going? Is it churned clients, failed payments, or lost deals?"

**Required Tools**:
1. `analytics_control` (dashboard: revenue) - Get revenue trends
2. `stripe_control` (action: get_history) - Get payment data
3. `sales_flow_control` (action: get_deals) - Get deal pipeline
4. `churn-predictor` - Get churned clients
5. `data-quality` - Check for data sync issues

**Logic Flow**:
```
STEP 1: Get revenue breakdown
  → analytics_control(dashboard="revenue", period="monthly", compare=true)
  → Extract: current_month_revenue, last_month_revenue, revenue_by_source[], revenue_by_client_segment[]

STEP 2: Analyze Stripe payments
  → stripe_control.get_history(period="last_60_days")
  → Extract: successful_payments, failed_payments, refunds, chargebacks, subscription_cancellations
  → Calculate: payment_failure_rate, refund_rate, churn_revenue_loss

STEP 3: Analyze deal pipeline
  → sales_flow_control.get_deals(days=60)
  → Extract: deals_won, deals_lost, deals_stalled, avg_deal_value, pipeline_velocity
  → Calculate: lost_deal_revenue = SUM(deals_lost.value), stalled_deal_revenue = SUM(deals_stalled.value)

STEP 4: Get churned clients
  → churn-predictor(action="get_churned", days=30)
  → Extract: churned_client_emails[], churned_revenue[], churn_reasons[]
  → Calculate: churn_revenue_loss = SUM(churned_revenue)

STEP 5: Cross-reference data quality
  → data-quality(check="revenue_sync")
  → Extract: missing_payments, duplicate_deals, sync_errors
  → Flag: data_quality_issues that could affect revenue calculation

STEP 6: Calculate revenue leak sources
  → Source 1: Failed Payments = failed_payments.value - (recovered_payments.value)
  → Source 2: Refunds = refunds.value
  → Source 3: Churned Clients = churn_revenue_loss
  → Source 4: Lost Deals = lost_deal_revenue
  → Source 5: Stalled Deals = stalled_deal_revenue (potential future loss)

STEP 7: Prioritize by impact
  → Sort revenue_leak_sources by value DESC
  → Identify: largest_leak_source, percentage_of_total_drop

STEP 8: Decision logic
  IF (failed_payments.value > revenue_drop * 0.5)
    THEN primary_issue = "PAYMENT PROCESSING - High failure rate"
  ELSE IF (churn_revenue_loss > revenue_drop * 0.5)
    THEN primary_issue = "CLIENT RETENTION - High churn rate"
  ELSE IF (lost_deal_revenue > revenue_drop * 0.5)
    THEN primary_issue = "SALES CONVERSION - Low close rate"
  ELSE IF (refunds.value > revenue_drop * 0.3)
    THEN primary_issue = "REFUND MANAGEMENT - High refund rate"
  ELSE primary_issue = "MULTIPLE FACTORS - Requires comprehensive strategy"
```

**Expected Outcome**:
- Primary leak source: "PAYMENT PROCESSING", "CLIENT RETENTION", "SALES CONVERSION", or "REFUND MANAGEMENT"
- Revenue breakdown: Amount lost per source (e.g., "Failed Payments: AED 12,000, Churned Clients: AED 8,000")
- Action plan: Specific recommendations (e.g., "Implement payment retry logic" or "Launch retention campaign")

**Data Sources**:
- `stripe_payments` table (payment records)
- `deals` table (deal pipeline)
- `client_health_scores` table (churn indicators)
- `daily_summary` table (revenue aggregates)
- `sync_logs` table (data quality)

---

### Q5: Intervention Success Prediction with Multi-Factor Analysis
**Scenario**: Need to predict which intervention strategy will work best for a Red Zone client, considering their payment history, call patterns, and coach relationship.

**User Query**: "Sarah Johnson is in Red Zone (health score 42). Should we send a personalized message, schedule a call, or offer a package extension? What's the probability of success for each option?"

**Required Tools**:
1. `client_control` (action: get_all) - Get full client profile
2. `intervention-recommender` - Get AI recommendations
3. `call_control` (action: get_calls) - Get call history
4. `stripe_control` (action: get_history) - Get payment patterns
5. `intelligence_control` (action: predict_intervention_success) - ML prediction

**Logic Flow**:
```
STEP 1: Get comprehensive client data
  → client_control.get_all(email="sarah.johnson@example.com")
  → Extract: health_score, health_zone, health_trend, sessions_last_7d, days_since_last_session, outstanding_sessions, assigned_coach

STEP 2: Get call history and patterns
  → call_control.get_calls(email, days=90)
  → Extract: call_count, avg_call_duration, last_call_date, call_outcomes[], response_rate
  → Analyze: preferred_contact_method, best_call_time, call_sentiment_score

STEP 3: Get payment history
  → stripe_control.get_history(email)
  → Extract: payment_frequency, last_payment_date, payment_amount, refund_history, payment_method
  → Analyze: payment_reliability_score, financial_stress_indicators

STEP 4: Get AI intervention recommendations
  → intervention-recommender(client_email, zone="red")
  → Extract: recommended_interventions[], success_probability[], intervention_reasons[]

STEP 5: Get ML-based success prediction
  → intelligence_control(action="predict_intervention_success", client_email, intervention_types=["message", "call", "package_extension"])
  → Extract: predicted_success_rate[], confidence_scores[], risk_factors[]

STEP 6: Cross-reference with historical patterns
  → Query: intervention_history table for similar clients
  → Extract: success_rate_by_intervention_type, success_rate_by_client_profile, success_rate_by_coach

STEP 7: Calculate composite success probability
  → FOR EACH intervention_type:
      base_probability = ML_prediction[intervention_type]
      + (call_response_rate * 0.2) IF intervention == "call"
      + (payment_reliability * 0.15) IF intervention == "package_extension"
      + (historical_success_rate * 0.25)
      - (financial_stress_indicators * 0.1)
      = composite_probability

STEP 8: Decision logic
  IF (composite_probability["call"] > 0.7 AND call_response_rate > 0.6)
    THEN best_intervention = "SCHEDULE CALL - High response rate, good historical success"
  ELSE IF (composite_probability["package_extension"] > 0.65 AND payment_reliability > 0.8)
    THEN best_intervention = "OFFER PACKAGE EXTENSION - Financially stable, likely to renew"
  ELSE IF (composite_probability["message"] > 0.6 AND preferred_contact_method == "email")
    THEN best_intervention = "SEND PERSONALIZED MESSAGE - Preferred contact method"
  ELSE best_intervention = "MULTI-TOUCH APPROACH - Combine call + message for maximum impact"
```

**Expected Outcome**:
- Recommended intervention: "SCHEDULE CALL", "OFFER PACKAGE EXTENSION", "SEND PERSONALIZED MESSAGE", or "MULTI-TOUCH APPROACH"
- Success probabilities: Per intervention type (e.g., "Call: 72%, Message: 58%, Package Extension: 65%")
- Reasoning: Specific factors supporting the recommendation
- Action plan: Exact steps to execute (e.g., "Call Sarah on Tuesday 2-4 PM, mention package extension if call goes well")

**Data Sources**:
- `client_health_scores` table (health metrics)
- `calls` table (call history)
- `stripe_payments` table (payment patterns)
- `intervention_history` table (historical outcomes)
- `intervention_recommendations` table (AI suggestions)

---

## Category 2: Advanced Fraud & Risk Detection (10 Questions)

### Q6: Multi-Pattern Fraud Detection
**Scenario**: A payment looks suspicious but need to check multiple fraud patterns before flagging.

**User Query**: "A new client paid AED 8,000 with a card we've never seen before, then immediately booked 3 sessions this week. Is this fraud or a legitimate high-value client?"

**Required Tools**:
1. `stripe_control` (action: fraud_scan) - Check fraud patterns
2. `universal_search` - Search for card/email/phone across systems
3. `stripe-forensics` - Deep forensic analysis
4. `anomaly-detector` - Detect unusual patterns
5. `client_control` (action: get_all) - Get client profile

**Logic Flow**:
```
STEP 1: Run comprehensive fraud scan
  → stripe_control.fraud_scan(email, payment_id)
  → Extract: fraud_score, risk_factors[], card_fingerprint, payment_method, instant_payout_flag

STEP 2: Search for card/email/phone across systems
  → universal_search(query=card_last_4 OR email OR phone)
  → Extract: matches_in_hubspot, matches_in_stripe, matches_in_anytrack, matches_in_callgear
  → Analyze: account_age, previous_interactions, linked_accounts

STEP 3: Run forensic analysis
  → stripe-forensics(action="full-audit", email, days_back=90)
  → Extract: payment_patterns[], card_changes[], refund_history[], chargeback_history[]
  → Analyze: test-then-drain_pattern, instant_payout_pattern, refund_pattern

STEP 4: Detect anomalies
  → anomaly-detector(type="payment_behavior", email)
  → Extract: anomaly_score, unusual_patterns[], comparison_to_peers

STEP 5: Get client behavior data
  → client_control.get_all(email)
  → Extract: sessions_booked, session_attendance_rate, communication_preferences, lead_source

STEP 6: Cross-reference with attribution
  → Check: lead_source, campaign, attribution_path
  → Analyze: if high-value client from premium campaign vs. organic signup

STEP 7: Calculate composite fraud risk
  → base_fraud_score = stripe_fraud_scan.score
  → + (card_not_seen_before * 0.2)
  → + (instant_payout_flag * 0.3)
  → + (anomaly_score * 0.2)
  → - (account_age > 30_days * 0.15)
  → - (sessions_booked > 2 * 0.1)
  → - (premium_campaign_source * 0.1)
  → = composite_fraud_risk

STEP 8: Decision logic
  IF (composite_fraud_risk > 0.8 OR test-then-drain_pattern_detected)
    THEN flag = "HIGH RISK - Block payment, require verification"
  ELSE IF (composite_fraud_risk > 0.6 AND instant_payout_flag)
    THEN flag = "MEDIUM RISK - Hold payment for 24h, monitor sessions"
  ELSE IF (composite_fraud_risk < 0.4 AND sessions_booked > 2 AND account_age > 7_days)
    THEN flag = "LOW RISK - Legitimate high-value client"
  ELSE flag = "REVIEW REQUIRED - Manual verification needed"
```

**Expected Outcome**:
- Fraud risk level: "HIGH RISK", "MEDIUM RISK", "LOW RISK", or "REVIEW REQUIRED"
- Risk score: 0-1 composite score
- Evidence: Specific patterns detected (e.g., "Instant payout pattern + new card + test-then-drain")
- Action: "Block payment", "Hold for 24h", or "Approve and monitor"

**Data Sources**:
- `stripe_payments` table (payment records)
- `stripe_forensics` table (fraud patterns)
- `contacts` table (client profiles)
- `anomaly_detections` table (pattern analysis)
- `ultimate_truth_events` table (attribution data)

---

### Q7: Churn Prediction with Intervention Timing
**Scenario**: Need to predict not just IF a client will churn, but WHEN, and what intervention timing maximizes success probability.

**User Query**: "Predict when client Maria Garcia will churn and what's the best day to intervene to prevent it?"

**Required Tools**:
1. `churn-predictor` - Get churn prediction
2. `client_control` (action: get_all) - Get client behavior patterns
3. `call_control` (action: find_patterns) - Get communication patterns
4. `intervention-recommender` - Get intervention recommendations
5. `intelligence_control` (action: predict_optimal_intervention_timing) - ML timing prediction

**Logic Flow**:
```
STEP 1: Get churn prediction
  → churn-predictor(email, days_ahead=90)
  → Extract: churn_probability, predicted_churn_date, risk_factors[], confidence_score

STEP 2: Get client behavior patterns
  → client_control.get_all(email)
  → Extract: health_score, health_trend, sessions_last_7d, sessions_last_30d, days_since_last_session, outstanding_sessions, package_expiry_date

STEP 3: Analyze communication patterns
  → call_control.find_patterns(email, days=90)
  → Extract: call_frequency, best_response_days[], best_response_times[], communication_preferences
  → Analyze: day_of_week_patterns, time_of_day_patterns

STEP 4: Get intervention recommendations
  → intervention-recommender(client_email, zone=health_zone)
  → Extract: recommended_interventions[], success_probability[]

STEP 5: Predict optimal intervention timing
  → intelligence_control(action="predict_optimal_intervention_timing", email, intervention_types)
  → Extract: optimal_days[], optimal_times[], success_probability_by_timing[]

STEP 6: Calculate intervention urgency
  → days_until_churn = predicted_churn_date - today
  → urgency_score = (churn_probability * 0.5) + ((90 - days_until_churn) / 90 * 0.5)
  → IF urgency_score > 0.8 THEN intervention_window = "IMMEDIATE (0-3 days)"
  → ELSE IF urgency_score > 0.6 THEN intervention_window = "URGENT (4-7 days)"
  → ELSE intervention_window = "PLANNED (8-14 days)"

STEP 7: Optimize timing within window
  → FOR EACH day in intervention_window:
      Calculate: success_probability = base_success_rate * (communication_response_rate[day] * 0.3) * (package_expiry_proximity[day] * 0.2)
  → Select: optimal_day = MAX(success_probability)

STEP 8: Decision logic
  IF (churn_probability > 0.8 AND days_until_churn < 7)
    THEN action = "IMMEDIATE INTERVENTION - Call on [optimal_day] at [optimal_time], offer package extension"
  ELSE IF (churn_probability > 0.6 AND days_until_churn < 14)
    THEN action = "URGENT INTERVENTION - Schedule call within 3 days, send personalized message today"
  ELSE action = "PLANNED INTERVENTION - Schedule call for [optimal_day], send engagement message 2 days before"
```

**Expected Outcome**:
- Predicted churn date: Specific date (e.g., "2024-12-28")
- Churn probability: Percentage (e.g., "78%")
- Optimal intervention timing: Specific day and time (e.g., "Tuesday, December 24, 2-4 PM")
- Success probability: Percentage if intervention happens at optimal time (e.g., "65%")
- Action plan: Exact steps with timing

**Data Sources**:
- `churn_predictions` table (ML predictions)
- `client_health_scores` table (health metrics)
- `calls` table (communication patterns)
- `intervention_history` table (historical outcomes)
- `client_behavior_patterns` table (behavioral data)

---

## Category 3: Sales Pipeline Optimization (10 Questions)

### Q8: Deal Staleness Detection with Recovery Strategy
**Scenario**: Deals are getting stuck in pipeline. Need to identify which deals are stale and what actions will move them forward.

**User Query**: "We have 12 deals stuck in 'Proposal Sent' stage for over 2 weeks. Which ones can we recover and what should we do?"

**Required Tools**:
1. `sales_flow_control` (action: get_deals) - Get deal pipeline
2. `call_control` (action: get_calls) - Get recent communication
3. `lead_control` (action: get_enhanced) - Get lead engagement data
4. `analytics_control` (dashboard: revenue) - Get deal value context
5. `intelligence_control` (action: predict_deal_recovery) - ML recovery prediction

**Logic Flow**:
```
STEP 1: Get stalled deals
  → sales_flow_control.get_deals(stage="Proposal Sent", days=14)
  → Extract: deal_ids[], deal_values[], created_dates[], owners[], lead_emails[]

STEP 2: Get communication history for each deal
  → FOR EACH deal:
      call_control.get_calls(lead_email, days=30)
  → Extract: last_contact_date, contact_frequency, response_rate, call_outcomes[]

STEP 3: Get lead engagement data
  → FOR EACH lead_email:
      lead_control.get_enhanced(email)
  → Extract: lead_score, engagement_score, email_open_rate, link_click_rate, website_visits[]

STEP 4: Predict recovery probability
  → intelligence_control(action="predict_deal_recovery", deal_ids)
  → Extract: recovery_probability[], recommended_actions[], success_factors[]

STEP 5: Calculate deal health score
  → FOR EACH deal:
      health_score = (recovery_probability * 0.4)
        + (engagement_score / 100 * 0.3)
        + (days_since_last_contact < 7 ? 0.2 : 0)
        + (deal_value > avg_deal_value ? 0.1 : 0)

STEP 6: Prioritize deals
  → Sort deals by: (health_score * deal_value) DESC
  → Identify: top_recoverable_deals[], low_probability_deals[]

STEP 7: Generate recovery strategies
  → FOR EACH deal in top_recoverable_deals:
      IF (last_contact_date > 7_days_ago AND engagement_score > 50)
        THEN strategy = "FOLLOW-UP CALL - High engagement, just needs nudge"
      ELSE IF (email_open_rate > 0.6 AND link_click_rate > 0.3)
        THEN strategy = "SEND UPDATED PROPOSAL - Active engagement, refresh offer"
      ELSE IF (deal_value > avg_deal_value * 1.5)
        THEN strategy = "EXECUTIVE ESCALATION - High value, requires senior attention"
      ELSE strategy = "STANDARD FOLLOW-UP - Send reminder, schedule call"

STEP 8: Decision logic
  → Return: prioritized_deals[], recovery_strategies[], expected_recovery_value
```

**Expected Outcome**:
- Recoverable deals: List of deals with recovery probability > 50%
- Expected recovery value: Total AED amount recoverable (e.g., "AED 45,000 from 6 deals")
- Recovery strategies: Specific action per deal (e.g., "Deal #123: Follow-up call on Tuesday, mention limited-time discount")
- Low-probability deals: Deals to deprioritize or close as lost

**Data Sources**:
- `deals` table (pipeline data)
- `calls` table (communication history)
- `leads` table (lead engagement)
- `deal_recovery_predictions` table (ML predictions)
- `sales_activity` table (activity tracking)

---

### Q9: Setter Performance Analysis with Conversion Optimization
**Scenario**: One setter is converting leads at 25% while another is at 12%. Need to understand why and provide actionable recommendations.

**User Query**: "Setter A converts 25% of leads to qualified, Setter B only converts 12%. What's Setter A doing differently and how can we replicate it?"

**Required Tools**:
1. `analytics_control` (dashboard: coaches) - Get setter performance metrics
2. `call_control` (action: get_calls) - Get call transcripts and outcomes
3. `lead_control` (action: get_enhanced) - Get lead quality data
4. `intelligence_control` (action: analyze_call_patterns) - AI call analysis
5. `anomaly-detector` - Detect performance patterns

**Logic Flow**:
```
STEP 1: Get setter performance metrics
  → analytics_control(dashboard="coaches", setters=["A", "B"])
  → Extract: conversion_rate, calls_made, calls_answered, qualified_count, avg_call_duration, response_time

STEP 2: Get call transcripts and outcomes
  → FOR EACH setter:
      call_control.get_calls(setter, days=30)
  → Extract: call_transcripts[], call_outcomes[], call_durations[], call_times[]

STEP 3: Analyze call patterns with AI
  → intelligence_control(action="analyze_call_patterns", setter="A")
  → Extract: key_phrases[], question_patterns[], objection_handling[], closing_techniques[]
  → Repeat for Setter B

STEP 4: Get lead quality data
  → FOR EACH setter:
      Get leads assigned, lead_scores[], lead_sources[]
  → Analyze: avg_lead_quality, lead_source_distribution

STEP 5: Detect performance patterns
  → anomaly-detector(type="setter_performance", setters=["A", "B"])
  → Extract: performance_differences[], key_differentiators[]

STEP 6: Compare call approaches
  → Setter A patterns:
      - Opening: [pattern]
      - Qualification questions: [questions]
      - Objection handling: [techniques]
      - Closing: [approach]
  → Setter B patterns:
      - [Same analysis]
  → Identify: differences[], best_practices[]

STEP 7: Calculate impact factors
  → Factor 1: Call timing (response_time)
  → Factor 2: Call duration (avg_call_duration)
  → Factor 3: Qualification approach (question_patterns)
  → Factor 4: Objection handling (objection_handling_techniques)
  → Factor 5: Lead quality (avg_lead_quality)

STEP 8: Generate recommendations
  → FOR EACH difference:
      Calculate: impact_on_conversion = (Setter A metric - Setter B metric) * conversion_correlation
  → Prioritize: top_3_differences by impact
  → Generate: specific_recommendations[] for Setter B
```

**Expected Outcome**:
- Key differentiators: Top 3-5 factors explaining performance gap (e.g., "Setter A responds within 2 minutes vs. Setter B's 15 minutes")
- Best practices: Specific techniques Setter A uses (e.g., "Uses 3-question qualification framework")
- Recommendations: Actionable steps for Setter B (e.g., "Implement 2-minute response SLA, use qualification framework from Setter A")
- Expected impact: Projected conversion rate improvement (e.g., "12% → 18% conversion rate")

**Data Sources**:
- `calls` table (call records and transcripts)
- `leads` table (lead data)
- `setter_performance` table (performance metrics)
- `call_analytics` table (AI-analyzed patterns)
- `coach_performance` table (aggregated metrics)

---

## Category 4: Marketing Attribution & ROI (10 Questions)

### Q10: Multi-Touch Attribution Analysis
**Scenario**: A client converted after seeing Facebook ad, clicking email, and receiving a call. Need to attribute value correctly across all touchpoints.

**User Query**: "Client John converted after seeing our Facebook ad, clicking an email, and receiving a call. How much credit should each channel get for the AED 12,000 deal?"

**Required Tools**:
1. `ultimate-truth-alignment` - Get attribution data
2. `analytics_control` (dashboard: campaigns) - Get campaign costs
3. `call_control` (action: get_calls) - Get call data
4. `lead_control` (action: get_enhanced) - Get lead journey data
5. `intelligence_control` (action: calculate_attribution) - ML attribution model

**Logic Flow**:
```
STEP 1: Get complete attribution path
  → ultimate-truth-alignment(client_email, time_window_hours=720)
  → Extract: touchpoints[], timestamps[], channels[], event_types[]
  → Example: [Facebook Ad View → Email Open → Email Click → Call → Deal Closed]

STEP 2: Get campaign costs
  → analytics_control(dashboard="campaigns", campaigns=["Facebook", "Email"])
  → Extract: ad_spend, email_campaign_cost, cost_per_click, cost_per_impression

STEP 3: Get call data
  → call_control.get_calls(email)
  → Extract: call_duration, call_outcome, call_cost, setter_assigned

STEP 4: Calculate attribution using multiple models
  → Model 1: First-Touch Attribution
      credit[Facebook] = 100%
  → Model 2: Last-Touch Attribution
      credit[Call] = 100%
  → Model 3: Linear Attribution
      credit[each_touchpoint] = deal_value / touchpoint_count
  → Model 4: Time-Decay Attribution
      credit[touchpoint] = deal_value * (decay_factor ^ days_from_conversion)
  → Model 5: ML-Based Attribution (preferred)
      intelligence_control(action="calculate_attribution", touchpoints, deal_value)
      credit[] = ML_model_output

STEP 5: Calculate channel costs
  → Facebook cost = ad_spend / impressions * this_client_impressions
  → Email cost = email_campaign_cost / sends * this_client_sends
  → Call cost = setter_hourly_rate * (call_duration / 60)

STEP 6: Calculate ROI per channel
  → FOR EACH channel:
      channel_credit = ML_attribution_credit[channel]
      channel_cost = channel_costs[channel]
      ROI[channel] = (channel_credit - channel_cost) / channel_cost

STEP 7: Decision logic
  → Primary attribution: Channel with highest ML credit
  → Secondary attribution: Channels with credit > 20%
  → ROI ranking: Sort channels by ROI DESC
```

**Expected Outcome**:
- Attribution breakdown: Per-channel credit (e.g., "Facebook: 35%, Email: 25%, Call: 40%")
- Channel costs: Cost per channel (e.g., "Facebook: AED 2.50, Email: AED 0.10, Call: AED 15.00")
- ROI per channel: ROI calculation (e.g., "Facebook: 1,680x ROI, Email: 30,000x ROI, Call: 320x ROI")
- Primary driver: Channel that contributed most to conversion

**Data Sources**:
- `ultimate_truth_events` table (attribution data)
- `campaigns` table (campaign costs)
- `calls` table (call data)
- `deals` table (deal values)
- `attribution_models` table (ML attribution)

---

## Category 5: System Health & Data Quality (10 Questions)

### Q11: Cross-System Data Sync Validation
**Scenario**: Need to verify that data is syncing correctly across HubSpot, Stripe, and internal systems, and identify any discrepancies.

**User Query**: "I noticed a client's email in HubSpot doesn't match what's in Stripe. How many clients have data sync issues and what's the impact?"

**Required Tools**:
1. `data-quality` - Check data quality issues
2. `integration-health` - Check integration status
3. `sync-hubspot-to-supabase` - Trigger sync and validate
4. `universal_search` - Cross-reference data across systems
5. `analytics_control` (dashboard: system_health) - Get system health metrics

**Logic Flow**:
```
STEP 1: Run comprehensive data quality check
  → data-quality(check="all_systems")
  → Extract: sync_errors[], missing_data[], duplicate_records[], mismatched_fields[]

STEP 2: Check integration health
  → integration-health()
  → Extract: hubspot_sync_status, stripe_sync_status, last_sync_times[], error_counts[]

STEP 3: Identify specific mismatches
  → FOR EACH client:
      hubspot_email = hubspot_contacts[client_id].email
      stripe_email = stripe_customers[client_id].email
      IF (hubspot_email != stripe_email)
        THEN add_to_mismatch_list(client_id, hubspot_email, stripe_email)

STEP 4: Calculate impact
  → affected_clients = COUNT(mismatch_list)
  → Calculate: potential_revenue_impact, communication_errors, payment_processing_issues

STEP 5: Categorize issues
  → Category 1: Email mismatches
  → Category 2: Phone number mismatches
  → Category 3: Name mismatches
  → Category 4: Missing data in one system
  → Category 5: Duplicate records

STEP 6: Prioritize fixes
  → Sort by: (impact_score * client_value) DESC
  → Identify: critical_issues[], medium_issues[], low_issues[]

STEP 7: Generate fix recommendations
  → FOR EACH issue_category:
      recommended_action = get_fix_strategy(issue_category)
      estimated_fix_time = calculate_fix_time(issue_count)
```

**Expected Outcome**:
- Issue count: Total clients with sync issues (e.g., "23 clients have email mismatches")
- Impact assessment: Business impact (e.g., "Could affect AED 45,000 in revenue tracking")
- Issue breakdown: Per-category counts and examples
- Fix recommendations: Specific actions to resolve (e.g., "Run sync repair script for 23 clients, estimated 15 minutes")
- Prevention: Recommendations to prevent future issues

**Data Sources**:
- `contacts` table (HubSpot data)
- `stripe_customers` table (Stripe data)
- `sync_logs` table (sync history)
- `data_quality_issues` table (detected issues)
- `integration_status` table (system health)

---

## Category 6: Predictive Business Intelligence (10 Questions)

### Q12: Revenue Forecasting with Multi-Factor Analysis
**Scenario**: Need to predict next month's revenue considering pipeline, churn risk, seasonality, and market trends.

**User Query**: "What will our revenue be next month? Consider our current pipeline, churn risk, and any seasonal patterns."

**Required Tools**:
1. `analytics_control` (dashboard: revenue) - Get historical revenue
2. `sales_flow_control` (action: get_pipeline) - Get pipeline value
3. `churn-predictor` - Get churn predictions
4. `business-intelligence` - Get BI insights
5. `intelligence_control` (action: predict_revenue) - ML revenue prediction

**Logic Flow**:
```
STEP 1: Get historical revenue trends
  → analytics_control(dashboard="revenue", period="monthly", months=12)
  → Extract: monthly_revenue[], growth_rate, seasonality_patterns[]

STEP 2: Get current pipeline
  → sales_flow_control.get_pipeline()
  → Extract: pipeline_value, deals_by_stage[], avg_close_rate, avg_sales_cycle

STEP 3: Get churn predictions
  → churn-predictor(action="predict_all", days_ahead=30)
  → Extract: churned_clients[], churn_revenue_loss, churn_probability_by_segment

STEP 4: Get business intelligence insights
  → business-intelligence(period="monthly")
  → Extract: market_trends[], competitor_activity[], seasonal_factors[]

STEP 5: Calculate base revenue projection
  → base_revenue = last_month_revenue * (1 + avg_growth_rate)
  → + pipeline_close_probability * pipeline_value
  → - churn_revenue_loss
  → = projected_base_revenue

STEP 6: Apply ML prediction
  → intelligence_control(action="predict_revenue", factors=[base_revenue, pipeline, churn, seasonality])
  → Extract: ML_predicted_revenue, confidence_interval[], risk_factors[]

STEP 7: Calculate scenarios
  → Best case: base_revenue * 1.15 (if all pipeline closes, low churn)
  → Base case: ML_predicted_revenue
  → Worst case: base_revenue * 0.85 (if pipeline stalls, high churn)

STEP 8: Generate insights
  → Key drivers: Factors with highest impact on revenue
  → Risks: Factors that could reduce revenue
  → Opportunities: Factors that could increase revenue
```

**Expected Outcome**:
- Revenue forecast: Base case prediction (e.g., "AED 125,000")
- Confidence interval: Range (e.g., "AED 110,000 - AED 140,000")
- Scenario analysis: Best/worst/base cases
- Key drivers: Top factors affecting revenue (e.g., "Pipeline value: +AED 25,000, Churn risk: -AED 8,000")
- Recommendations: Actions to improve revenue (e.g., "Focus on closing 5 deals in pipeline, prevent 3 high-value churns")

**Data Sources**:
- `daily_summary` table (historical revenue)
- `deals` table (pipeline data)
- `churn_predictions` table (churn forecasts)
- `revenue_forecasts` table (ML predictions)
- `business_intelligence` table (market insights)

---

## Summary: Training Dataset Structure

Each question in this dataset includes:
1. **Real-world scenario** - Business context
2. **Natural language query** - How users actually ask
3. **Required tools** - Specific functions to use (2-5 tools)
4. **Logic flow** - Step-by-step reasoning process
5. **Expected outcome** - What the agent should return
6. **Data sources** - Where to find the data

### Key Training Objectives:
- **Multi-tool orchestration**: Agents learn to chain 2-5 tools
- **Cross-system thinking**: Connect data from HubSpot, Stripe, Health, Calls
- **Decision logic**: Make business decisions based on multiple factors
- **Edge case handling**: Deal with missing data, conflicts, anomalies
- **Predictive reasoning**: Use ML predictions alongside business logic
- **Actionable insights**: Provide specific, executable recommendations

### Usage:
This dataset should be used to:
1. **Fine-tune AI agents** on complex scenarios
2. **Test agent reasoning** on multi-step problems
3. **Validate tool selection** logic
4. **Improve response quality** for business users
5. **Train new agents** on system capabilities

---

**Total Questions**: 50 (12 shown above as examples, remaining 38 follow same structure covering all system areas)

**Categories**:
- Multi-System Client Intelligence (10)
- Advanced Fraud & Risk Detection (10)
- Sales Pipeline Optimization (10)
- Marketing Attribution & ROI (10)
- System Health & Data Quality (10)

**Complexity Levels**:
- **Basic**: 1-2 tools, straightforward logic
- **Intermediate**: 2-3 tools, cross-system correlation
- **Advanced**: 3-5 tools, multi-factor analysis, ML integration
- **Expert**: 4-5 tools, predictive reasoning, edge cases, business strategy

