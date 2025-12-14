# 🚀 Marketing Stress Test Implementation Guide

## Quick Start: Run All 20 Questions

### Prerequisites
1. ✅ Facebook Ads API connected
2. ✅ HubSpot synced (contacts, deals)
3. ✅ Stripe data available
4. ✅ Attribution events tracked (AnyTrack)

---

## Step 1: Create Helper Views & Functions

### View 1: Campaign Performance Unified
```sql
CREATE OR REPLACE VIEW campaign_performance_unified AS
SELECT 
  cp.campaign_name,
  cp.platform,
  cp.ad_set_name,
  cp.total_spend,
  cp.total_clicks,
  cp.total_impressions,
  cp.total_leads,
  COUNT(DISTINCT c.email) as hubspot_leads,
  COUNT(DISTINCT CASE WHEN c.lifecycle_stage IN ('salesqualifiedlead', 'opportunity', 'customer') THEN c.email END) as qualified_leads,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  SUM(CAST(d.deal_value AS DECIMAL)) as revenue,
  SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(cp.total_spend, 0) as roas,
  cp.total_spend / NULLIF(COUNT(DISTINCT c.email), 0) as cac
FROM campaign_performance cp
LEFT JOIN contacts c ON c.utm_campaign = cp.campaign_name
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
GROUP BY cp.campaign_name, cp.platform, cp.ad_set_name, cp.total_spend, cp.total_clicks, cp.total_impressions, cp.total_leads;
```

### View 2: Customer Journey Complete
```sql
CREATE OR REPLACE VIEW customer_journey_complete AS
SELECT 
  c.email,
  c.first_touch_source,
  c.last_touch_source,
  c.utm_campaign as last_touch_campaign,
  c.utm_source,
  c.utm_medium,
  c.created_at as lead_created,
  MIN(d.close_date) as first_purchase_date,
  MAX(d.close_date) as last_purchase_date,
  COUNT(DISTINCT d.hubspot_deal_id) as purchase_count,
  SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
  c.lifecycle_stage,
  chs.health_score,
  chs.churn_risk_score
FROM contacts c
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
LEFT JOIN client_health_scores chs ON c.email = chs.email
GROUP BY c.email, c.first_touch_source, c.last_touch_source, c.utm_campaign, c.utm_source, c.utm_medium, c.created_at, c.lifecycle_stage, chs.health_score, chs.churn_risk_score;
```

---

## Step 2: Run Stress Test Queries

### Quick Answer Script
Create `run_stress_test.sql`:

```sql
-- Q1: Highest LTV Sources
\echo '=== Q1: Highest LTV Sources ==='
SELECT * FROM (
  SELECT 
    c.utm_source,
    c.first_touch_source,
    COUNT(DISTINCT c.email) as total_leads,
    COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
    SUM(CAST(d.deal_value AS DECIMAL)) as total_revenue,
    AVG(CAST(d.deal_value AS DECIMAL)) as avg_deal_value,
    SUM(CAST(d.deal_value AS DECIMAL)) / NULLIF(COUNT(DISTINCT c.email), 0) as ltv_per_lead
  FROM contacts c
  LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
  WHERE d.hubspot_deal_id IS NOT NULL
  GROUP BY c.utm_source, c.first_touch_source
  ORDER BY ltv_per_lead DESC
  LIMIT 10
) q1;

-- Q2: Cost Per Qualified Lead
\echo '=== Q2: Cost Per Qualified Lead ==='
SELECT * FROM campaign_performance_unified
WHERE platform = 'facebook'
ORDER BY cac ASC
LIMIT 10;

-- Q3: Creative Performance
\echo '=== Q3: Creative Performance ==='
SELECT 
  ae.fb_ad_id,
  ae.campaign,
  COUNT(DISTINCT ae.email) as leads_from_creative,
  COUNT(DISTINCT d.hubspot_deal_id) as deals_closed,
  SUM(CAST(d.deal_value AS DECIMAL)) as revenue_generated,
  COUNT(DISTINCT d.hubspot_deal_id)::FLOAT / NULLIF(COUNT(DISTINCT ae.email), 0) * 100 as conversion_rate
FROM attribution_events ae
LEFT JOIN contacts c ON ae.email = c.email
LEFT JOIN deals d ON c.hubspot_contact_id = d.hubspot_contact_id AND d.status = 'closedwon'
WHERE ae.fb_ad_id IS NOT NULL
GROUP BY ae.fb_ad_id, ae.campaign
HAVING COUNT(DISTINCT ae.email) >= 5
ORDER BY conversion_rate DESC
LIMIT 10;

-- Continue for all 20 questions...
```

---

## Step 3: Automated Dashboard

### Create Edge Function: `marketing-stress-test`

```typescript
// supabase/functions/marketing-stress-test/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const results = {
    q1_ltv_by_source: {},
    q2_cost_per_qualified: {},
    q3_creative_performance: {},
    // ... all 20 questions
  };

  // Run all queries
  const { data: q1 } = await supabase.rpc('get_ltv_by_source');
  results.q1_ltv_by_source = q1;

  // ... run all other queries

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## Step 4: Create React Dashboard Component

```typescript
// src/components/marketing/StressTestDashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function StressTestDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-stress-test'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('marketing-stress-test');
      return data;
    },
    refetchInterval: 3600000, // Every hour
  });

  if (isLoading) return <div>Loading stress test results...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Marketing Stress Test Results</h1>
      
      {/* Q1: LTV by Source */}
      <Card>
        <CardHeader>
          <CardTitle>Q1: Highest LTV Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Total Leads</TableHead>
                <TableHead>Deals Closed</TableHead>
                <TableHead>LTV per Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.q1_ltv_by_source?.map((row: any) => (
                <TableRow key={row.utm_source}>
                  <TableCell>{row.utm_source}</TableCell>
                  <TableCell>{row.total_leads}</TableCell>
                  <TableCell>{row.deals_closed}</TableCell>
                  <TableCell>AED {row.ltv_per_lead?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Continue for all 20 questions... */}
    </div>
  );
}
```

---

## Step 5: Automated Alerts

### Create Alert Function
```typescript
// supabase/functions/marketing-alerts/index.ts
serve(async (req) => {
  const supabase = createClient(...);

  const alerts = [];

  // Check for bleeding campaigns
  const { data: bleedingCampaigns } = await supabase
    .from('campaign_performance_unified')
    .select('*')
    .lt('roas', 2)
    .gt('total_spend', 1000); // Spent > AED 1,000

  if (bleedingCampaigns?.length > 0) {
    alerts.push({
      type: 'critical',
      message: `${bleedingCampaigns.length} campaigns have ROAS < 2x`,
      campaigns: bleedingCampaigns.map(c => c.campaign_name)
    });
  }

  // Check for creative fatigue
  // ... more checks

  // Send alerts to dashboard or email
  return new Response(JSON.stringify({ alerts }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## Step 6: Weekly Auto-Report

### Create Cron Job
```sql
-- Schedule weekly stress test report
SELECT cron.schedule(
  'weekly-marketing-stress-test',
  '0 9 * * 1', -- Every Monday at 9 AM
  $$
  SELECT supabase.functions.invoke('marketing-stress-test', {});
  $$
);
```

---

## Quick Commands

### Run Stress Test Now
```bash
# Via Supabase Edge Function
curl -X POST https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/marketing-stress-test \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Via SQL
psql $DATABASE_URL -f run_stress_test.sql
```

### View Results in Dashboard
Navigate to: `/marketing-stress-test`

---

## Expected Output

After running the stress test, you'll get:

1. **Top 10 LTV Sources** - Where your best customers come from
2. **Campaign Health Status** - Which to keep, which to kill
3. **Creative Performance** - Which ads work best
4. **Attribution Insights** - True customer journey
5. **Optimization Recommendations** - Specific actions to take

---

## Next Actions

1. ✅ Implement data collection (Facebook Ads API)
2. ✅ Create helper views
3. ✅ Build dashboard component
4. ✅ Set up automated alerts
5. ✅ Schedule weekly reports

**This will give you complete visibility into your marketing performance!** 🎯
