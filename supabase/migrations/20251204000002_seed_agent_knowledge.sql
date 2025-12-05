-- ============================================
-- SEED: Agent Knowledge Base with Formulas
-- ============================================

-- Health Score Formula
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'formula',
  'health_score',
  'Health Score Calculation',
  'The overall health score is calculated as a weighted average of three components:

HEALTH_SCORE = (ENGAGEMENT × 0.40) + (PACKAGE_HEALTH × 0.30) + (MOMENTUM × 0.30)

This means:
- 40% weight on how actively the client is training
- 30% weight on their package status (sessions remaining)
- 30% weight on their trend direction (improving or declining)

A score of 70+ indicates a healthy client, while below 50 is critical.',
  '{
    "weights": {
      "engagement": 0.40,
      "package_health": 0.30,
      "momentum": 0.30
    },
    "code": "Math.round(engagement * 0.40 + packageHealth * 0.30 + momentum * 0.30)"
  }',
  'system',
  1.0
);

-- Engagement Score Formula
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'formula',
  'engagement_score',
  'Engagement Score Calculation',
  'Engagement measures how actively a client is using their sessions.

Starting from a BASE of 50 points:

RECENT ACTIVITY BONUSES (last 7 days):
- +30 points if 3+ sessions
- +20 points if 2+ sessions
- +10 points if 1+ session

CONSISTENCY BONUSES (last 30 days):
- +15 points if 12+ sessions (3/week average)
- +10 points if 8+ sessions (2/week average)

RECENCY PENALTIES:
- -30 points if last session was 30+ days ago
- -15 points if last session was 14-30 days ago
- -5 points if last session was 7-14 days ago

Final score clamped between 0-100.',
  '{
    "base": 50,
    "bonuses": {
      "sessions_7d_3plus": 30,
      "sessions_7d_2plus": 20,
      "sessions_7d_1plus": 10,
      "sessions_30d_12plus": 15,
      "sessions_30d_8plus": 10
    },
    "penalties": {
      "days_since_30plus": -30,
      "days_since_14_30": -15,
      "days_since_7_14": -5
    }
  }',
  'system',
  1.0
);

-- Package Health Score
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'formula',
  'package_health_score',
  'Package Health Score Calculation',
  'Package Health measures how much of their purchased sessions remain.

remaining_percent = (outstanding_sessions / sessions_purchased) × 100

SCORING:
- 90 points if 50%+ remaining (healthy buffer)
- 70 points if 30-50% remaining (good)
- 50 points if 10-30% remaining (needs renewal conversation)
- 30 points if <10% remaining (critical - about to run out)

This helps identify clients who need renewal conversations before they deplete their package.',
  '{
    "thresholds": {
      "50_percent": 90,
      "30_percent": 70,
      "10_percent": 50,
      "below_10": 30
    },
    "formula": "(outstanding_sessions / sessions_purchased) * 100"
  }',
  'system',
  1.0
);

-- Momentum Score
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'formula',
  'momentum_score',
  'Momentum Score Calculation',
  'Momentum indicates whether a client''s activity is trending up or down.

CALCULATION:
avg_weekly_7d = sessions in last 7 days
avg_weekly_30d = sessions in last 30 days ÷ 4.3 weeks

rate_of_change = ((avg_weekly_7d - avg_weekly_30d) / avg_weekly_30d) × 100

MOMENTUM CLASSIFICATION:
- ACCELERATING: rate > +20% → Score: 90
- STABLE-UP: rate 0% to +20% → Score: 70
- STABLE-DOWN: rate -20% to 0% → Score: 50
- DECLINING: rate < -20% → Score: 30

A client with DECLINING momentum in GREEN zone is an early warning sign - they may drop to YELLOW soon.',
  '{
    "thresholds": {
      "accelerating": {"min_rate": 20, "score": 90, "label": "ACCELERATING"},
      "stable_up": {"min_rate": 0, "score": 70, "label": "STABLE"},
      "stable_down": {"min_rate": -20, "score": 50, "label": "STABLE"},
      "declining": {"max_rate": -20, "score": 30, "label": "DECLINING"}
    }
  }',
  'system',
  1.0
);

-- Predictive Risk Score
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'formula',
  'predictive_risk',
  'Predictive Risk Score (Churn Probability)',
  'This score predicts the likelihood of a client churning (0-100, higher = more likely to churn).

Starting from BASE of 50:

MOMENTUM IMPACT:
- +30 if DECLINING trend
- -15 if ACCELERATING trend

RECENT ACTIVITY IMPACT:
- +25 if 0 sessions in last 7 days
- +15 if less than 1 session in last 7 days
- -10 if 2+ sessions in last 7 days

GAP IMPACT (days since last session):
- +25 if gap > 30 days
- +15 if gap > 14 days
- -10 if gap ≤ 7 days

PACKAGE DEPLETION:
- +20 if <10% sessions remaining AND low recent activity
- -10 if >50% sessions remaining

ZONE MISMATCH:
- +10 if in GREEN zone but has DECLINING momentum (hidden risk)

RISK CATEGORIES:
- CRITICAL: 75-100
- HIGH: 60-74
- MEDIUM: 40-59
- LOW: 0-39',
  '{
    "base": 50,
    "factors": {
      "declining_momentum": 30,
      "accelerating_momentum": -15,
      "zero_sessions_7d": 25,
      "low_sessions_7d": 15,
      "active_sessions_7d": -10,
      "gap_30_plus": 25,
      "gap_14_plus": 15,
      "gap_under_7": -10,
      "package_depleted": 20,
      "package_healthy": -10,
      "zone_mismatch": 10
    },
    "categories": {
      "CRITICAL": {"min": 75, "max": 100},
      "HIGH": {"min": 60, "max": 74},
      "MEDIUM": {"min": 40, "max": 59},
      "LOW": {"min": 0, "max": 39}
    }
  }',
  'system',
  1.0
);

-- Zone Classification
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'rule',
  'zone_classification',
  'Health Zone Classification',
  'Clients are classified into 4 zones based on their health score:

PURPLE ZONE (85-100) - Champions
- Highest engagement, consistent training
- Zero churn risk
- These clients are brand advocates
- Action: Maintain relationship, ask for referrals

GREEN ZONE (70-84) - Healthy
- Good engagement, regular training
- Low churn risk
- Stable, reliable clients
- Action: Monitor for any declining trends

YELLOW ZONE (50-69) - At Risk
- Declining engagement detected
- Medium churn risk
- Intervention needed
- Action: Proactive outreach, understand barriers

RED ZONE (0-49) - Critical
- Very low or no recent activity
- High churn risk
- Urgent action required
- Action: Immediate coach intervention within 24-48 hours',
  '{
    "zones": {
      "PURPLE": {"min": 85, "max": 100, "risk": "none", "urgency": "low"},
      "GREEN": {"min": 70, "max": 84, "risk": "low", "urgency": "low"},
      "YELLOW": {"min": 50, "max": 69, "risk": "medium", "urgency": "medium"},
      "RED": {"min": 0, "max": 49, "risk": "high", "urgency": "high"}
    }
  }',
  'system',
  1.0
);

-- Intervention Rules
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'rule',
  'interventions',
  'Intervention Priority and Actions',
  'Rules for prioritizing and executing interventions:

CRITICAL PRIORITY (Immediate - within 24 hours):
- RED zone + predictive_risk > 75
- Action: Personal call from coach, special offer, understand situation

HIGH PRIORITY (Within 48 hours):
- RED zone (any risk level)
- predictive_risk > 60 (any zone)
- YELLOW zone + DECLINING momentum
- Action: Schedule call, personalized message, address concerns

MEDIUM PRIORITY (Within 1 week):
- GREEN zone + DECLINING momentum (early warning)
- Package < 20% remaining
- Action: Check-in message, renewal conversation

LOW PRIORITY (Monitoring):
- YELLOW zone + STABLE momentum
- Action: Keep monitoring, gentle nudge

INTERVENTION TYPES:
1. Proactive Check-in - Wellness call, show you care
2. Re-engagement Campaign - Multi-touch sequence
3. Coach Reassignment - Try different trainer fit
4. Special Offer - Discount or bonus sessions
5. Urgent Outreach - Personal call from manager',
  '{
    "priorities": [
      {"condition": "RED + risk>75", "priority": "CRITICAL", "timeline": "24h"},
      {"condition": "RED", "priority": "HIGH", "timeline": "48h"},
      {"condition": "risk>60", "priority": "HIGH", "timeline": "48h"},
      {"condition": "YELLOW + DECLINING", "priority": "HIGH", "timeline": "48h"},
      {"condition": "GREEN + DECLINING", "priority": "MEDIUM", "timeline": "7d"},
      {"condition": "package<20%", "priority": "MEDIUM", "timeline": "7d"}
    ],
    "intervention_types": [
      "PROACTIVE_CHECKIN",
      "RE_ENGAGEMENT",
      "COACH_REASSIGNMENT",
      "SPECIAL_OFFER",
      "URGENT_OUTREACH"
    ]
  }',
  'system',
  1.0
);

-- Early Warning Patterns
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'pattern',
  'early_warning',
  'Early Warning Signs of Churn',
  'These patterns often precede client churn by 2-4 weeks:

1. GREEN → DECLINING MOMENTUM
   - Client still looks healthy but activity is dropping
   - Often missed because score is still "good"
   - Action: Reach out NOW before they drop to YELLOW

2. SESSIONS DROPPING: 3/week → 1/week
   - Rate of change matters more than absolute numbers
   - 60%+ drop in weekly sessions is a red flag

3. INCREASING GAPS
   - Gap between sessions growing each week
   - E.g., 3 days → 5 days → 8 days → 14 days

4. PACKAGE DEPLETION + LOW ACTIVITY
   - Few sessions remaining + not using them
   - May have mentally "checked out"

5. MISSED SCHEDULED SESSIONS
   - Booking but not showing up
   - Sign of lost motivation or competing priorities

6. COACH RELATIONSHIP ISSUES
   - Multiple clients of same coach declining together
   - May indicate coach performance issue',
  '{
    "warning_signs": [
      "green_declining",
      "session_rate_drop",
      "increasing_gaps",
      "package_depletion_inactive",
      "no_shows",
      "coach_pattern"
    ]
  }',
  'system',
  1.0
);

-- Successful Intervention Templates
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'intervention_template',
  'check_in',
  'Proactive Check-In Message Templates',
  'Templates for reaching out to at-risk clients:

TEMPLATE 1: Casual Check-In (YELLOW Zone)
"Hey [NAME]! Haven''t seen you at the gym lately - hope everything is okay!

I was thinking about you and wanted to check in. Is there anything going on that''s making it hard to come in? No pressure at all - just want to make sure you''re doing alright.

If you''re feeling stuck or unmotivated, I totally get it. Let''s chat and figure out how to get you back on track. What works best for you this week?

[COACH NAME]"

TEMPLATE 2: Value Reminder (RED Zone)
"Hi [NAME], it''s [COACH] from PTD.

I noticed it''s been [DAYS] days since your last session, and I wanted to reach out personally.

You''ve made great progress - [MENTION SPECIFIC ACHIEVEMENT]. I don''t want to see that slip away!

I have some availability this week and would love to get you back in. What''s been getting in the way? Let''s solve it together.

Can I call you for 5 minutes today?"

TEMPLATE 3: Package Expiring
"[NAME], quick heads up - you have [X] sessions left in your current package.

Before we talk about renewing, I want to make sure you''re getting maximum value. Let''s schedule a session to:
- Review your progress
- Adjust your program if needed
- Set some new goals

When works for you this week?"',
  '{
    "templates": ["casual_checkin", "value_reminder", "package_expiring"],
    "variables": ["NAME", "COACH", "DAYS", "ACHIEVEMENT", "X"]
  }',
  'system',
  1.0
);

-- Coach Performance Benchmarks
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'rule',
  'coach_performance',
  'Coach Performance Evaluation Criteria',
  'How to evaluate coach performance:

KEY METRICS:
1. Average Client Health Score
   - Target: 70+
   - Warning: Below 60
   - Critical: Below 50

2. Zone Distribution
   - GREEN+PURPLE should be 70%+
   - RED should be <10%
   - If coach has >20% RED, investigate

3. Client Retention
   - Monthly churn rate <5%
   - 90-day retention >85%

4. Momentum Indicators
   - More ACCELERATING than DECLINING
   - If >50% declining, coach needs support

RED FLAGS:
- Multiple clients declining simultaneously
- High RED zone concentration
- Pattern of clients leaving after working with coach
- Consistently below average health scores

POSITIVE INDICATORS:
- Clients consistently in GREEN/PURPLE
- Good session attendance rates
- Clients referring others
- Health scores improving over time',
  '{
    "benchmarks": {
      "avg_health_target": 70,
      "avg_health_warning": 60,
      "green_plus_target": 0.70,
      "red_max": 0.10,
      "monthly_churn_max": 0.05
    }
  }',
  'system',
  1.0
);

-- Learning Entry (Example of learned pattern)
INSERT INTO agent_knowledge (category, subcategory, title, content, structured_data, source, confidence)
VALUES (
  'learning',
  'intervention_success',
  'Successful Intervention: Personal Call within 24h',
  'LEARNED PATTERN: Personal phone calls within 24 hours of a client hitting RED zone have a 65% success rate in preventing churn.

Observation period: 3 months
Sample size: 47 RED zone interventions

Key factors for success:
1. Speed - Calling within 24 hours (vs 48h = only 40% success)
2. Personalization - Mentioning specific achievements
3. Offering flexibility - Not pushing rigid schedules
4. Identifying barrier - Understanding WHY they stopped

This pattern was identified from analyzing successful vs unsuccessful intervention outcomes.',
  '{
    "pattern_type": "intervention_timing",
    "success_rate": 0.65,
    "sample_size": 47,
    "key_factors": ["speed", "personalization", "flexibility", "barrier_identification"]
  }',
  'learned',
  0.85
);
