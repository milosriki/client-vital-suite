# 🎯 Marketing Stress Test: 20 Critical Questions
## Full Attribution Analysis (Facebook → HubSpot → Stripe)

---

## 📊 SECTION 1: LEAD QUALITY & SOURCE ANALYSIS (Questions 1-5)

### Q1: Which lead sources have the HIGHEST LTV (Lifetime Value)?
**What to Analyze:**
- Facebook campaigns → HubSpot contacts → Stripe revenue
- Google campaigns → HubSpot contacts → Stripe revenue
- Organic/Direct → HubSpot contacts → Stripe revenue
- AnyTrack attribution → HubSpot contacts → Stripe revenue

**Query Needed:**
```sql
SELECT 
  c.utm_source,
  c.first_touch_source,
  COUNT(DISTINCT c.email) as total_leads,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
  AVG(CAST(d.deal_value AS DECIMAL)) as avg_deal_value,
  SUM(CAST(d.deal_value AS DECIMAL)) / COUNT(DISTINCT c.email) as ltv_per_lead
FROM contacts c
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id
WHERE d.status = 'closedwon'
GROUP BY c.utm_source, c.first_touch_source
ORDER BY ltv_per_lead DESC;
```

**Out-of-Box Insight:** Cross-reference with `attribution_events` to see if click-level attribution differs from form-fill attribution.

---

### Q2: What's the TRUE Cost Per QUALIFIED Lead (not just any lead)?
**What to Analyze:**
- Facebook ad spend → Leads that become SQL/MQL → Closed deals
- Don't count leads that never progress past "lead" stage

**Query Needed:**
```sql
WITH qualified_leads AS (
  SELECT 
    c.email,
    c.utm_source,
    c.utm_campaign,
    c.lifecycle_stage,
    CASE 
      WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN 1
      ELSE 0
    END as is_qualified
  FROM contacts c
),
campaign_spend AS (
  SELECT 
    campaign_name,
    platform,
    SUM(spend) as total_spend,
    SUM(leads) as total_leads
  FROM campaign_performance
  WHERE platform = 'facebook'
  GROUP BY campaign_name, platform
)
SELECT 
  cp.campaign_name,
  cp.total_spend,
  COUNT(DISTINCT ql.email) as qualified_leads,
  cp.total_spend / NULLIF(COUNT(DISTINCT ql.email), 0) as cost_per_qualified_lead
FROM campaign_spend cp
LEFT JOIN contacts c ON c.utm_campaign = cp.campaign_name
LEFT JOIN qualified_leads ql ON ql.email = c.email AND ql.is_qualified = 1
GROUP BY cp.campaign_name, cp.total_spend
ORDER BY cost_per_qualified_lead ASC;
```

**Out-of-Box Insight:** Compare Facebook's "Cost per Lead" metric vs. your actual Cost per Qualified Lead. Facebook might show $50/lead, but if only 20% qualify, real cost is $250/qualified lead.

---

### Q3: Which CREATIVES drive leads that become CUSTOMERS (not just form fills)?
**What to Analyze:**
- Facebook ad creative → Attribution events → HubSpot contacts → Closed deals
- Creative performance beyond just CTR and CPC

**Query Needed:**
```sql
SELECT 
  ae.fb_ad_id,
  ae.campaign,
  ae.source,
  COUNT(DISTINCT ae.email) as leads_from_creative,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  SUM(CAST(d.deal_value AS DECIMAL)) as revenue_generated,
  COUNT(DISTINCT d.hubspot_deal_id)::FLOAT / NULLIF(COUNT(DISTINCT ae.email), 0) * 100 as conversion_rate
FROM attribution_events ae
LEFT JOIN contacts c ON ae.email = c.email
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
WHERE ae.fb_ad_id IS NOT NULL
GROUP BY ae.fb_ad_id, ae.campaign, ae.source
HAVING COUNT(DISTINCT ae.email) >= 5  -- Minimum sample size
ORDER BY conversion_rate DESC, revenue_generated DESC;
```

**Out-of-Box Insight:** Cross-reference with Facebook Ads API to get creative details (image/video, copy, CTA). Find patterns: Do video creatives convert better? Do testimonials work? What copy drives quality leads?

---

### Q4: What's the ATTRIBUTION DISCREPANCY between Facebook, HubSpot, and AnyTrack?
**What to Analyze:**
- Facebook says: "Campaign A generated 100 leads"
- HubSpot says: "Campaign A generated 80 leads"
- AnyTrack says: "Campaign A generated 90 leads"
- **Why the difference?** (This is the "Ultimate Truth" problem)

**Query Needed:**
```sql
WITH facebook_attribution AS (
  SELECT 
    utm_campaign,
    COUNT(DISTINCT email) as fb_leads
  FROM capi_events_enriched
  WHERE event_name = 'Lead'
  GROUP BY utm_campaign
),
hubspot_attribution AS (
  SELECT 
    utm_campaign,
    COUNT(DISTINCT email) as hs_leads
  FROM contacts
  WHERE utm_campaign IS NOT NULL
  GROUP BY utm_campaign
),
anytrack_attribution AS (
  SELECT 
    campaign,
    COUNT(DISTINCT email) as at_leads
  FROM attribution_events
  WHERE campaign IS NOT NULL
  GROUP BY campaign
)
SELECT 
  COALESCE(fa.utm_campaign, ha.utm_campaign, aa.campaign) as campaign_name,
  COALESCE(fa.fb_leads, 0) as facebook_leads,
  COALESCE(ha.hs_leads, 0) as hubspot_leads,
  COALESCE(aa.at_leads, 0) as anytrack_leads,
  GREATEST(COALESCE(fa.fb_leads, 0), COALESCE(ha.hs_leads, 0), COALESCE(aa.at_leads, 0)) - 
  LEAST(COALESCE(fa.fb_leads, 0), COALESCE(ha.hs_leads, 0), COALESCE(aa.at_leads, 0)) as discrepancy
FROM facebook_attribution fa
FULL OUTER JOIN hubspot_attribution ha ON fa.utm_campaign = ha.utm_campaign
FULL OUTER JOIN anytrack_attribution aa ON fa.utm_campaign = aa.campaign OR ha.utm_campaign = aa.campaign
ORDER BY discrepancy DESC;
```

**Out-of-Box Insight:** Large discrepancies indicate:
- Data sync issues
- Attribution window differences
- Cookie/privacy blocking
- Cross-device tracking gaps

---

### Q5: Which CAMPAIGNS have HIGH FRONTEND METRICS but LOW BACKEND CONVERSION?
**What to Analyze:**
- Facebook shows: Low CPC, High CTR, Low Cost per Lead
- But HubSpot shows: Low SQL rate, Low close rate
- **These campaigns are BLEEDING money** (look good on paper, bad in reality)

**Query Needed:**
```sql
WITH frontend_metrics AS (
  SELECT 
    campaign_name,
    SUM(spend) as total_spend,
    SUM(clicks) as total_clicks,
    SUM(leads) as total_leads,
    SUM(spend) / NULLIF(SUM(leads), 0) as cost_per_lead,
    SUM(clicks)::FLOAT / NULLIF(SUM(impressions), 0) * 100 as ctr
  FROM campaign_performance
  WHERE platform = 'facebook'
  GROUP BY campaign_name
),
backend_metrics AS (
  SELECT 
    c.utm_campaign,
    COUNT(DISTINCT c.email) as leads_in_hubspot,
    COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN c.email END) as qualified_leads,
    COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
    SUM(CAST(d.deal_value AS DECIMAL)) as revenue
  FROM contacts c
  LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  WHERE c.utm_campaign IS NOT NULL
  GROUP BY c.utm_campaign
)
SELECT 
  fm.campaign_name,
  fm.cost_per_lead as frontend_cpl,
  fm.ctr as frontend_ctr,
  bm.qualified_leads::FLOAT / NULLIF(bm.leads_in_hubspot, 0) * 100 as qualification_rate,
  bm.deals_closed::FLOAT / NULLIF(bm.leads_in_hubspot, 0) * 100 as close_rate,
  bm.revenue / NULLIF(fm.total_spend, 0) as roas,
  CASE 
    WHEN fm.cost_per_lead < 50 AND bm.close_rate < 5 THEN 'BLEEDING - Kill Campaign'
    WHEN fm.cost_per_lead < 50 AND bm.close_rate BETWEEN 5 AND 10 THEN 'WARNING - Optimize or Kill'
    WHEN bm.roas < 2 THEN 'LOW ROI - Review'
    ELSE 'HEALTHY'
  END as campaign_health
FROM frontend_metrics fm
LEFT JOIN backend_metrics bm ON fm.campaign_name = bm.utm_campaign
ORDER BY campaign_health, roas ASC;
```

**Out-of-Box Insight:** These are "vanity metric" campaigns. They look great in Facebook Ads Manager but don't drive real revenue. Kill them immediately.

---

## 💰 SECTION 2: REVENUE & ROI ANALYSIS (Questions 6-10)

### Q6: What's the TRUE ROAS (Return on Ad Spend) per campaign?
**What to Analyze:**
- Facebook ad spend → HubSpot deals → Stripe revenue
- Include ONLY closed deals, not pipeline value

**Query Needed:**
```sql
SELECT 
  c.utm_campaign,
  c.utm_source,
  cp.total_spend,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
  SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(cp.total_spend, 0) as roas,
  CASE 
    WHEN SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(cp.total_spend, 0) >= 5 THEN 'SCALE THIS'
    WHEN SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(cp.total_spend, 0) >= 3 THEN 'GOOD'
    WHEN SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(cp.total_spend, 0) >= 2 THEN 'BREAK EVEN'
    ELSE 'LOSING MONEY'
  END as roas_status
FROM contacts c
JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id
JOIN campaign_performance cp ON c.utm_campaign = cp.campaign_name
WHERE d.status = 'closedwon'
  AND cp.platform = 'facebook'
GROUP BY c.utm_campaign, c.utm_source, cp.total_spend
ORDER BY roas DESC;
```

**Out-of-Box Insight:** Target ROAS should be 5x+ for profitable scaling. Anything below 3x is break-even or losing money.

---

### Q7: Which AD SETS have the BEST LTV:CAC ratio?
**What to Analyze:**
- Ad set spend → Leads → Customer LTV
- LTV should be calculated from Stripe subscription data, not just first purchase

**Query Needed:**
```sql
WITH customer_ltv AS (
  SELECT 
    c.email,
    c.utm_campaign,
    c.utm_source,
    -- Calculate LTV from Stripe (if you have subscription data)
    SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
    COUNT(DISTINCT d.hubspot_deal_id) as total_purchases
  FROM contacts c
  JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id
  WHERE d.status = 'closedwon'
  GROUP BY c.email, c.utm_campaign, c.utm_source
),
ad_set_cac AS (
  SELECT 
    campaign_name,
    ad_set_name,
    SUM(spend) as total_spend,
    SUM(leads) as total_leads,
    SUM(spend) / NULLIF(SUM(leads), 0) as cac
  FROM campaign_performance
  WHERE platform = 'facebook' AND ad_set_name IS NOT NULL
  GROUP BY campaign_name, ad_set_name
)
SELECT 
  asc_data.campaign_name,
  asc_data.ad_set_name,
  asc_data.cac,
  AVG(cltv.total_revenue) as avg_ltv,
  AVG(cltv.total_revenue) / NULLIF(asc_data.cac, 0) as ltv_cac_ratio,
  CASE 
    WHEN AVG(cltv.total_revenue) / NULLIF(asc_data.cac, 0) >= 5 THEN 'EXCELLENT - Scale'
    WHEN AVG(cltv.total_revenue) / NULLIF(asc_data.cac, 0) >= 3 THEN 'GOOD'
    WHEN AVG(cltv.total_revenue) / NULLIF(asc_data.cac, 0) >= 2 THEN 'BREAK EVEN'
    ELSE 'LOSING MONEY'
  END as ltv_cac_status
FROM ad_set_cac asc_data
LEFT JOIN contacts c ON c.utm_campaign = asc_data.campaign_name
LEFT JOIN customer_ltv cltv ON cltv.email = c.email
GROUP BY asc_data.campaign_name, asc_data.ad_set_name, asc_data.cac
HAVING COUNT(DISTINCT cltv.email) >= 5  -- Minimum sample size
ORDER BY ltv_cac_ratio DESC;
```

**Out-of-Box Insight:** LTV:CAC ratio of 5:1 is ideal. Below 3:1 means you're not profitable long-term.

---

### Q8: What's the PAYBACK PERIOD for each campaign?
**What to Analyze:**
- Time from ad click → First purchase
- Campaigns with long payback periods need different messaging/offers

**Query Needed:**
```sql
SELECT 
  c.utm_campaign,
  c.utm_source,
  AVG(EXTRACT(EPOCH FROM (d.close_date - c.created_at)) / 86400) as avg_days_to_close,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (d.close_date - c.created_at)) / 86400) as median_days_to_close,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  CASE 
    WHEN AVG(EXTRACT(EPOCH FROM (d.close_date - c.created_at)) / 86400) <= 7 THEN 'FAST - Immediate ROI'
    WHEN AVG(EXTRACT(EPOCH FROM (d.close_date - c.created_at)) / 86400) <= 30 THEN 'MEDIUM - Monthly ROI'
    WHEN AVG(EXTRACT(EPOCH FROM (d.close_date - c.created_at)) / 86400) <= 90 THEN 'SLOW - Quarterly ROI'
    ELSE 'VERY SLOW - Long Sales Cycle'
  END as payback_period_category
FROM contacts c
JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id
WHERE d.status = 'closedwon'
  AND d.close_date IS NOT NULL
GROUP BY c.utm_campaign, c.utm_source
ORDER BY avg_days_to_close ASC;
```

**Out-of-Box Insight:** Fast payback campaigns (< 7 days) are cash-flow positive. Slow payback campaigns (> 90 days) need higher LTV to justify.

---

### Q9: Which campaigns drive MULTI-PURCHASE customers vs. ONE-TIME buyers?
**What to Analyze:**
- Some campaigns attract repeat buyers (higher LTV)
- Others attract one-time purchasers (lower LTV)

**Query Needed:**
```sql
WITH customer_purchase_count AS (
  SELECT 
    c.email,
    c.utm_campaign,
    c.utm_source,
    COUNT(DISTINCT d.hubspot_deal_id) as purchase_count,
    SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue
  FROM contacts c
  JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id
  WHERE d.status = 'closedwon'
  GROUP BY c.email, c.utm_campaign, c.utm_source
)
SELECT 
  utm_campaign,
  utm_source,
  COUNT(DISTINCT CASE WHEN purchase_count = 1 THEN email END) as one_time_buyers,
  COUNT(DISTINCT CASE WHEN purchase_count > 1 THEN email END) as repeat_buyers,
  COUNT(DISTINCT email) as total_customers,
  AVG(CASE WHEN purchase_count > 1 THEN total_revenue END) as avg_repeat_buyer_revenue,
  AVG(CASE WHEN purchase_count = 1 THEN total_revenue END) as avg_one_time_revenue,
  COUNT(DISTINCT CASE WHEN purchase_count > 1 THEN email END)::FLOAT / 
    NULLIF(COUNT(DISTINCT email), 0) * 100 as repeat_purchase_rate
FROM customer_purchase_count
GROUP BY utm_campaign, utm_source
HAVING COUNT(DISTINCT email) >= 10  -- Minimum sample size
ORDER BY repeat_purchase_rate DESC;
```

**Out-of-Box Insight:** Campaigns with high repeat purchase rates (> 30%) are gold. These customers have higher LTV and lower churn.

---

### Q10: What's the CONTRIBUTION MARGIN per campaign (Revenue - CAC - Fulfillment Cost)?
**What to Analyze:**
- Not just ROAS, but actual profit margin
- Include fulfillment costs (coach time, facilities, etc.)

**Query Needed:**
```sql
WITH campaign_metrics AS (
  SELECT 
    c.utm_campaign,
    cp.total_spend as cac,
    COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
    SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
    -- Estimate fulfillment cost (adjust based on your actual costs)
    COUNT(DISTINCT d.hubspot_deal_id) * 2000 as estimated_fulfillment_cost  -- Example: AED 2,000 per customer
  FROM contacts c
  JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id
  JOIN campaign_performance cp ON c.utm_campaign = cp.campaign_name
  WHERE d.status = 'closedwon'
    AND cp.platform = 'facebook'
  GROUP BY c.utm_campaign, cp.total_spend
)
SELECT 
  utm_campaign,
  cac,
  total_revenue,
  estimated_fulfillment_cost,
  total_revenue - cac - estimated_fulfillment_cost as contribution_margin,
  (total_revenue - cac - estimated_fulfillment_cost) / NULLIF(total_revenue, 0) * 100 as margin_percentage,
  CASE 
    WHEN (total_revenue - cac - estimated_fulfillment_cost) / NULLIF(total_revenue, 0) * 100 >= 50 THEN 'EXCELLENT MARGIN'
    WHEN (total_revenue - cac - estimated_fulfillment_cost) / NULLIF(total_revenue, 0) * 100 >= 30 THEN 'GOOD MARGIN'
    WHEN (total_revenue - cac - estimated_fulfillment_cost) / NULLIF(total_revenue, 0) * 100 >= 10 THEN 'LOW MARGIN'
    ELSE 'NEGATIVE MARGIN - LOSING MONEY'
  END as margin_status
FROM campaign_metrics
ORDER BY contribution_margin DESC;
```

**Out-of-Box Insight:** Contribution margin > 50% is excellent. Below 10% means you're barely profitable or losing money.

---

## 🎨 SECTION 3: CREATIVE & AUDIENCE ANALYSIS (Questions 11-15)

### Q11: Which CREATIVE ELEMENTS (copy, image, CTA) drive QUALITY leads?
**What to Analyze:**
- Facebook ad creative details → Lead quality (SQL/MQL rate)
- Need to pull creative data from Facebook Ads API

**Out-of-Box Approach:**
1. Export Facebook Ads creative data (ad name, creative ID, copy, image URL)
2. Match to attribution_events.fb_ad_id
3. Analyze which creatives drive leads that become SQL/MQL

**Query Needed:**
```sql
-- This requires Facebook Ads API integration
-- For now, use attribution_events to identify top-performing ad IDs
SELECT 
  ae.fb_ad_id,
  ae.campaign,
  COUNT(DISTINCT ae.email) as total_leads,
  COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN c.email END) as qualified_leads,
  COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN c.email END)::FLOAT / 
    NULLIF(COUNT(DISTINCT ae.email), 0) * 100 as qualification_rate
FROM attribution_events ae
LEFT JOIN contacts c ON ae.email = c.email
WHERE ae.fb_ad_id IS NOT NULL
GROUP BY ae.fb_ad_id, ae.campaign
HAVING COUNT(DISTINCT ae.email) >= 10  -- Minimum sample size
ORDER BY qualification_rate DESC;
```

**Out-of-Box Insight:** Cross-reference winning ad IDs with Facebook Ads Manager to see:
- What copy works? (Testimonials vs. Benefits vs. Urgency)
- What images work? (Before/After vs. Lifestyle vs. Product)
- What CTAs work? (Book Now vs. Learn More vs. Get Started)

---

### Q12: What AUDIENCE SEGMENTS have the HIGHEST conversion rates?
**What to Analyze:**
- Facebook audience (Lookalike, Interest, Custom) → Conversion rate
- Need to track audience at ad set level

**Query Needed:**
```sql
SELECT 
  cp.ad_set_name,
  cp.audience_type,  -- If you're tracking this
  cp.campaign_name,
  COUNT(DISTINCT c.email) as leads,
  COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN c.email END) as qualified_leads,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  COUNT(DISTINCT d.hubspot_deal_id)::FLOAT / NULLIF(COUNT(DISTINCT c.email), 0) * 100 as conversion_rate,
  SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(cp.total_spend, 0) as roas
FROM campaign_performance cp
LEFT JOIN contacts c ON c.utm_campaign = cp.campaign_name
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
WHERE cp.platform = 'facebook'
GROUP BY cp.ad_set_name, cp.audience_type, cp.campaign_name, cp.total_spend
HAVING COUNT(DISTINCT c.email) >= 20  -- Minimum sample size
ORDER BY conversion_rate DESC, roas DESC;
```

**Out-of-Box Insight:** Lookalike audiences typically convert 2-3x better than interest audiences. Custom audiences (website visitors, email lists) often convert best.

---

### Q13: Which CREATIVES are showing CREATIVE FATIGUE?
**What to Analyze:**
- Ad performance over time (CTR declining, CPC increasing)
- Same creative running too long = fatigue

**Query Needed:**
```sql
-- This requires daily creative performance data
-- For now, analyze by date ranges
WITH creative_performance AS (
  SELECT 
    ae.fb_ad_id,
    DATE(ae.created_at) as date,
    COUNT(DISTINCT ae.email) as leads_per_day,
    -- You'd need to join with Facebook Ads API for CTR/CPC
  FROM attribution_events ae
  WHERE ae.fb_ad_id IS NOT NULL
  GROUP BY ae.fb_ad_id, DATE(ae.created_at)
),
creative_trends AS (
  SELECT 
    fb_ad_id,
    MIN(date) as first_seen,
    MAX(date) as last_seen,
    COUNT(DISTINCT date) as days_running,
    AVG(leads_per_day) as avg_daily_leads,
    -- Calculate trend (increasing or decreasing)
    (MAX(leads_per_day) - MIN(leads_per_day)) / NULLIF(MAX(leads_per_day), 0) * 100 as performance_change_pct
  FROM creative_performance
  GROUP BY fb_ad_id
  HAVING COUNT(DISTINCT date) >= 7  -- Running for at least a week
)
SELECT 
  fb_ad_id,
  days_running,
  avg_daily_leads,
  performance_change_pct,
  CASE 
    WHEN performance_change_pct < -30 THEN 'FATIGUED - Replace Creative'
    WHEN performance_change_pct < -10 THEN 'DECLINING - Test New Variant'
    WHEN performance_change_pct > 10 THEN 'IMPROVING - Scale'
    ELSE 'STABLE'
  END as fatigue_status
FROM creative_trends
ORDER BY days_running DESC, performance_change_pct ASC;
```

**Out-of-Box Insight:** Creatives typically fatigue after 7-14 days. Rotate new creatives weekly to maintain performance.

---

### Q14: What's the OPTIMAL FREQUENCY per ad set?
**What to Analyze:**
- Facebook frequency (how many times same person sees ad) → Conversion rate
- Too low = not enough exposure, Too high = ad fatigue

**Query Needed:**
```sql
-- This requires Facebook Ads API data for frequency
-- For now, estimate from attribution_events (multiple clicks = higher frequency)
WITH frequency_analysis AS (
  SELECT 
    ae.email,
    ae.fb_ad_id,
    ae.campaign,
    COUNT(*) as click_count,  -- Proxy for frequency
    MAX(ae.created_at) - MIN(ae.created_at) as time_span_days
  FROM attribution_events ae
  WHERE ae.fb_ad_id IS NOT NULL
  GROUP BY ae.email, ae.fb_ad_id, ae.campaign
),
conversion_by_frequency AS (
  SELECT 
    fa.fb_ad_id,
    fa.campaign,
    fa.click_count as estimated_frequency,
    COUNT(DISTINCT fa.email) as total_users,
    COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN fa.email END) as converted_users,
    COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN fa.email END)::FLOAT / 
      NULLIF(COUNT(DISTINCT fa.email), 0) * 100 as conversion_rate
  FROM frequency_analysis fa
  LEFT JOIN contacts c ON fa.email = c.email
  GROUP BY fa.fb_ad_id, fa.campaign, fa.click_count
  HAVING COUNT(DISTINCT fa.email) >= 10  -- Minimum sample size
)
SELECT 
  estimated_frequency,
  SUM(total_users) as total_users_at_frequency,
  AVG(conversion_rate) as avg_conversion_rate,
  CASE 
    WHEN estimated_frequency BETWEEN 3 AND 7 THEN 'OPTIMAL FREQUENCY'
    WHEN estimated_frequency < 3 THEN 'TOO LOW - Increase Budget'
    WHEN estimated_frequency > 7 THEN 'TOO HIGH - Reduce Budget or Expand Audience'
  END as frequency_status
FROM conversion_by_frequency
GROUP BY estimated_frequency
ORDER BY estimated_frequency;
```

**Out-of-Box Insight:** Optimal frequency is typically 3-7 impressions per user. Below 3 = not enough exposure, above 7 = fatigue.

---

### Q15: Which PLACEMENTS (Feed, Stories, Reels) drive BEST quality leads?
**What to Analyze:**
- Facebook placement → Lead quality (SQL/MQL rate)
- Need placement data from Facebook Ads API

**Query Needed:**
```sql
-- This requires Facebook Ads API integration for placement data
-- For now, analyze by source/medium if you're tracking it
SELECT 
  c.utm_source,
  c.utm_medium,
  COUNT(DISTINCT c.email) as total_leads,
  COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN c.email END) as qualified_leads,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  COUNT(DISTINCT d.hubspot_deal_id)::FLOAT / NULLIF(COUNT(DISTINCT c.email), 0) * 100 as conversion_rate,
  AVG(CAST(d.deal_value AS DECIMAL)) as avg_deal_value
FROM contacts c
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
WHERE c.utm_source = 'facebook'
GROUP BY c.utm_source, c.utm_medium
ORDER BY conversion_rate DESC, avg_deal_value DESC;
```

**Out-of-Box Insight:** Feed placements typically convert best for lead gen. Stories/Reels are better for awareness. Test all placements but optimize budget toward winners.

---

## 🔄 SECTION 4: CROSS-PLATFORM & ATTRIBUTION (Questions 16-20)

### Q16: What's the TRUE CUSTOMER JOURNEY (multi-touch attribution)?
**What to Analyze:**
- First touch (awareness) → Middle touch (consideration) → Last touch (conversion)
- Which campaigns work best at each stage?

**Query Needed:**
```sql
WITH customer_journey AS (
  SELECT 
    c.email,
    c.first_touch_source as first_touch,
    c.last_touch_source as last_touch,
    c.utm_campaign as last_touch_campaign,
    -- Get middle touches from contact_activities or events
    COUNT(DISTINCT ca.activity_type) as touchpoint_count,
    MIN(c.created_at) as first_contact,
    MAX(d.close_date) as conversion_date
  FROM contacts c
  LEFT JOIN contact_activities ca ON c.email = ca.contact_email
  LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  GROUP BY c.email, c.first_touch_source, c.last_touch_source, c.utm_campaign
)
SELECT 
  first_touch,
  last_touch,
  COUNT(DISTINCT email) as customers,
  AVG(touchpoint_count) as avg_touchpoints,
  AVG(EXTRACT(EPOCH FROM (conversion_date - first_contact)) / 86400) as avg_days_to_convert,
  COUNT(DISTINCT CASE WHEN conversion_date IS NOT NULL THEN email END)::FLOAT / 
    NULLIF(COUNT(DISTINCT email), 0) * 100 as conversion_rate
FROM customer_journey
GROUP BY first_touch, last_touch
ORDER BY customers DESC;
```

**Out-of-Box Insight:** Multi-touch attribution shows the full customer journey. Some campaigns are great at awareness but poor at conversion. Optimize each stage separately.

---

### Q17: Which campaigns have the BEST RETENTION RATE (customers who stay)?
**What to Analyze:**
- Campaign → Customer → Churn rate
- Some campaigns attract loyal customers, others attract churners

**Query Needed:**
```sql
WITH customer_lifetime AS (
  SELECT 
    c.email,
    c.utm_campaign,
    c.utm_source,
    MIN(d.close_date) as first_purchase_date,
    MAX(d.close_date) as last_purchase_date,
    COUNT(DISTINCT d.hubspot_deal_id) as purchase_count,
    SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
    -- Check health score for churn risk
    MAX(chs.churn_risk_score) as max_churn_risk
  FROM contacts c
  JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  LEFT JOIN client_health_scores chs ON c.email = chs.email
  GROUP BY c.email, c.utm_campaign, c.utm_source
)
SELECT 
  utm_campaign,
  utm_source,
  COUNT(DISTINCT email) as total_customers,
  COUNT(DISTINCT CASE WHEN purchase_count > 1 THEN email END) as repeat_customers,
  COUNT(DISTINCT CASE WHEN max_churn_risk < 50 THEN email END) as low_churn_risk_customers,
  COUNT(DISTINCT CASE WHEN max_churn_risk >= 70 THEN email END) as high_churn_risk_customers,
  COUNT(DISTINCT CASE WHEN purchase_count > 1 THEN email END)::FLOAT / 
    NULLIF(COUNT(DISTINCT email), 0) * 100 as retention_rate,
  AVG(total_revenue) as avg_customer_value
FROM customer_lifetime
GROUP BY utm_campaign, utm_source
HAVING COUNT(DISTINCT email) >= 10  -- Minimum sample size
ORDER BY retention_rate DESC, avg_customer_value DESC;
```

**Out-of-Box Insight:** Retention rate > 40% is excellent. Campaigns with high retention drive long-term value, not just immediate revenue.

---

### Q18: What's the ATTRIBUTION WINDOW impact (1-day vs. 7-day vs. 28-day)?
**What to Analyze:**
- Facebook default: 1-day click, 1-day view
- But customers might convert 7+ days later
- True attribution might be longer

**Query Needed:**
```sql
WITH conversion_delays AS (
  SELECT 
    c.email,
    c.utm_campaign,
    c.created_at as lead_created,
    d.close_date as conversion_date,
    EXTRACT(EPOCH FROM (d.close_date - c.created_at)) / 86400 as days_to_convert,
    CAST(d.deal_value AS DECIMAL) as deal_value
  FROM contacts c
  JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  WHERE d.close_date IS NOT NULL
)
SELECT 
  utm_campaign,
  COUNT(DISTINCT CASE WHEN days_to_convert <= 1 THEN email END) as conversions_1day,
  COUNT(DISTINCT CASE WHEN days_to_convert <= 7 THEN email END) as conversions_7day,
  COUNT(DISTINCT CASE WHEN days_to_convert <= 28 THEN email END) as conversions_28day,
  COUNT(DISTINCT email) as total_conversions,
  SUM(CASE WHEN days_to_convert <= 1 THEN deal_value ELSE 0 END) as revenue_1day,
  SUM(CASE WHEN days_to_convert <= 7 THEN deal_value ELSE 0 END) as revenue_7day,
  SUM(CASE WHEN days_to_convert <= 28 THEN deal_value ELSE 0 END) as revenue_28day,
  SUM(deal_value) as total_revenue,
  -- Attribution window impact
  (SUM(CASE WHEN days_to_convert <= 7 THEN deal_value ELSE 0 END) - 
   SUM(CASE WHEN days_to_convert <= 1 THEN deal_value ELSE 0 END)) / 
   NULLIF(SUM(CASE WHEN days_to_convert <= 1 THEN deal_value ELSE 0 END), 0) * 100 as revenue_lift_7day_vs_1day
FROM conversion_delays
GROUP BY utm_campaign
ORDER BY revenue_lift_7day_vs_1day DESC;
```

**Out-of-Box Insight:** If 7-day attribution shows 30%+ more revenue than 1-day, you're undervaluing your campaigns. Use longer attribution windows for optimization.

---

### Q19: Which campaigns drive CROSS-DEVICE conversions?
**What to Analyze:**
- User clicks ad on mobile → Converts on desktop (or vice versa)
- Facebook might not track this properly

**Query Needed:**
```sql
-- This requires device tracking in attribution_events
-- For now, analyze by first_touch vs last_touch device if tracked
WITH device_journey AS (
  SELECT 
    c.email,
    c.utm_campaign,
    -- If you're tracking device in attribution_events
    ae.device_type as click_device,
    -- Check HubSpot for conversion device (if tracked)
    c.latest_traffic_source as conversion_source
  FROM contacts c
  LEFT JOIN attribution_events ae ON c.email = ae.email
  LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  WHERE d.hubspot_deal_id IS NOT NULL
)
SELECT 
  utm_campaign,
  click_device,
  COUNT(DISTINCT email) as conversions,
  AVG(CAST(d.deal_value AS DECIMAL)) as avg_deal_value
FROM device_journey dj
LEFT JOIN contacts c ON dj.email = c.email
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
GROUP BY utm_campaign, click_device
ORDER BY conversions DESC;
```

**Out-of-Box Insight:** Cross-device conversions are often underreported. Mobile clicks → Desktop conversions are common. Use server-side tracking (CAPI) to capture these.

---

### Q20: What's the TRUE COST PER ACQUIRED CUSTOMER (CAC) including ALL touchpoints?
**What to Analyze:**
- Not just last-click attribution
- Include ALL ad spend that touched the customer before conversion

**Query Needed:**
```sql
WITH customer_touchpoints AS (
  SELECT 
    c.email,
    -- Collect all campaigns that touched this customer
    ARRAY_AGG(DISTINCT c.utm_campaign) FILTER (WHERE c.utm_campaign IS NOT NULL) as all_campaigns,
    c.first_touch_source,
    c.last_touch_source,
    MIN(c.created_at) as first_contact
  FROM contacts c
  LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  WHERE d.hubspot_deal_id IS NOT NULL
  GROUP BY c.email, c.first_touch_source, c.last_touch_source
),
campaign_spend AS (
  SELECT 
    campaign_name,
    SUM(spend) as total_spend
  FROM campaign_performance
  WHERE platform = 'facebook'
  GROUP BY campaign_name
),
customer_cac AS (
  SELECT 
    ct.email,
    ct.all_campaigns,
    -- Sum spend from ALL campaigns that touched this customer
    (SELECT SUM(total_spend) FROM campaign_spend cs 
     WHERE cs.campaign_name = ANY(ct.all_campaigns)) as total_attributed_spend,
    CAST(d.deal_value AS DECIMAL) as deal_value
  FROM customer_touchpoints ct
  LEFT JOIN contacts c ON ct.email = c.email
  LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  WHERE d.hubspot_deal_id IS NOT NULL
)
SELECT 
  AVG(total_attributed_spend) as avg_cac_multi_touch,
  AVG(deal_value) as avg_deal_value,
  AVG(deal_value) / NULLIF(AVG(total_attributed_spend), 0) as roas_multi_touch,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_attributed_spend) as median_cac
FROM customer_cac;
```

**Out-of-Box Insight:** Multi-touch CAC is often 2-3x higher than last-click CAC. This is the TRUE cost. If multi-touch CAC > LTV, you're losing money even if last-click looks profitable.

---

## 🎯 ACTION PLAN: How to Answer These Questions

### Step 1: Data Collection
1. **Facebook Ads API Integration**
   - Pull campaign, ad set, ad, creative, placement, frequency data
   - Store in `campaign_performance` table

2. **Enhanced Attribution Tracking**
   - Track device, placement, creative ID in `attribution_events`
   - Track multi-touch journey in `contact_activities`

3. **Stripe Integration**
   - Pull subscription data for LTV calculation
   - Track repeat purchases

### Step 2: Build Dashboards
1. **Campaign Performance Dashboard**
   - Frontend metrics (CPC, CTR, CPL)
   - Backend metrics (SQL rate, Close rate, ROAS)
   - Health status (HEALTHY / WARNING / BLEEDING)

2. **Creative Performance Dashboard**
   - Creative ID → Qualification rate
   - Creative fatigue alerts
   - A/B test results

3. **Attribution Dashboard**
   - Multi-touch attribution visualization
   - Attribution window comparison
   - Cross-device conversion tracking

### Step 3: Automated Alerts
1. **Campaign Health Alerts**
   - ROAS < 2x → Alert
   - Qualification rate < 5% → Alert
   - Creative fatigue detected → Alert

2. **Budget Optimization Alerts**
   - Scale campaigns with ROAS > 5x
   - Pause campaigns with ROAS < 2x
   - Increase budget for campaigns with low frequency

### Step 4: Optimization Actions
1. **Weekly Campaign Review**
   - Answer all 20 questions
   - Kill bleeding campaigns
   - Scale winning campaigns
   - Test new creatives

2. **Monthly Deep Dive**
   - Full attribution analysis
   - LTV:CAC review
   - Creative library refresh
   - Audience optimization

---

## 📈 SUCCESS METRICS

After implementing this stress test, you should see:

- **ROAS Improvement**: From 2x → 5x+ (target)
- **CAC Reduction**: 30-50% reduction through optimization
- **LTV Increase**: 20-30% through better targeting
- **Campaign Efficiency**: Kill 20-30% of underperforming campaigns
- **Creative Performance**: 2-3x improvement through testing

---

## 🚀 NEXT STEPS

1. **Implement Data Collection** (Week 1)
   - Facebook Ads API integration
   - Enhanced attribution tracking
   - Stripe LTV calculation

2. **Build Dashboards** (Week 2)
   - Campaign performance dashboard
   - Creative performance dashboard
   - Attribution dashboard

3. **Run First Stress Test** (Week 3)
   - Answer all 20 questions
   - Identify top 5 actions
   - Implement optimizations

4. **Automate & Monitor** (Week 4)
   - Set up automated alerts
   - Weekly campaign reviews
   - Monthly deep dives

---

**This stress test will transform your marketing from "spray and pray" to "surgical precision".** 🎯
