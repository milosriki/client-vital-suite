# PTD Proactive Monitor Agent

Advanced anomaly detection and alerting system that continuously monitors business health and automatically surfaces critical issues.

## Overview

The PTD Proactive Monitor Agent is a comprehensive monitoring system that:
- **Watches multiple data sources** for anomalies
- **Detects issues early** before they become critical
- **Groups related alerts** for better context
- **Calculates urgency scores** for prioritization
- **Prevents duplicate alerts** using deduplication
- **Generates actionable insights** with recommended next steps

## Features

### 1. Continuous Monitoring

The agent monitors four critical areas:

#### Health Score Monitoring
- Tracks client health scores over 14-day periods
- Detects sudden drops (10+, 15+, or 25+ points)
- Compares to 7-day averages for trend analysis
- Alerts on clients at risk of churn

#### Deal Pipeline Monitoring
- Identifies stalled deals (14+, 21+, or 30+ days)
- Tracks deals stuck in Assessment, Proposal, Negotiation, or Trial stages
- Highlights high-value deals needing attention
- Prevents revenue loss from abandoned opportunities

#### Sync Status Monitoring
- Monitors sync_errors table for failures
- Groups errors by source (HubSpot, Stripe, Meta, etc.)
- Alerts on repeated failures (2+, 3+, or 5+ in 24h)
- Prevents data inconsistencies

#### Lead Response Time Monitoring
- Tracks new leads without responses
- Alerts on delays (6h, 12h, or 24h without contact)
- Improves conversion rates through timely follow-up
- Ensures no leads fall through the cracks

### 2. Anomaly Detection

```typescript
interface Anomaly {
  type: 'health_drop' | 'deal_stall' | 'sync_fail' | 'response_delay';
  severity: 'critical' | 'high' | 'medium' | 'low';
  entity: string;
  details: any;
  recommended_action: string;
  urgency_score: number;
  detected_at: string;
}
```

#### Severity Levels

**Critical**
- Health score drops 25+ points
- Deals stalled 30+ days
- 5+ sync failures in 24h
- Leads waiting 24+ hours

**High**
- Health score drops 15+ points
- Deals stalled 21+ days
- 3+ sync failures in 24h
- Leads waiting 12+ hours

**Medium**
- Health score drops 10+ points
- Deals stalled 14+ days
- 2+ sync failures in 24h
- Leads waiting 6+ hours

### 3. Smart Alert Grouping

Related anomalies are grouped together to provide context:

```typescript
interface AlertGroup {
  group_id: string;
  primary_anomaly: Anomaly;
  related_anomalies: Anomaly[];
  combined_severity: 'critical' | 'high' | 'medium' | 'low';
  combined_urgency: number;
  affected_count: number;
}
```

**Grouping Logic:**
- Groups by anomaly type (all health drops together, etc.)
- Escalates severity if multiple related issues
- Calculates combined urgency score
- Lists all affected entities

### 4. Urgency Scoring

Each anomaly receives an urgency score (0-100) based on:

- **Base severity** (30-90 points)
- **Health score drop magnitude** (+0.5 per point dropped, max +10)
- **Current health zone** (+15 for RED, +5 for YELLOW)
- **Deal stall duration** (+2 per 10 days, max +10)
- **Deal value** (+10 for >$10K deals)
- **Failure count** (+3 per failure, max +15)
- **Lead wait time** (+0.5 per hour, max +10)

**Score Ranges:**
- **90-100**: Drop everything, immediate action required
- **70-89**: High priority, address within hours
- **50-69**: Medium priority, address within 24h
- **30-49**: Low priority, monitor and address this week

### 5. Trend Analysis

The agent analyzes patterns across anomalies:

**Generated Insights:**
- "5 clients experiencing health score drops. Average drop: 18 points."
- "3 deals stalled. Most common stage: Proposal (2 deals)"
- "Sync failures detected across 2 source(s): hubspot, stripe"
- "4 leads waiting for response. Average wait time: 15 hours"

**Predictions:**
- "Trend indicates potential systemic issue affecting multiple clients"
- "Review Proposal stage process. May indicate bottleneck"
- "Critical sync failures may cause data inconsistencies"
- "Slow lead response times directly impact conversion rates"

### 6. Alert Deduplication

Prevents alert fatigue by:
- Creating unique dedup keys per entity and day
- Checking for existing alerts in 24-hour window
- Skipping duplicate alerts automatically
- Only surfacing new or changed issues

**Dedup Key Format:**
```
{anomaly_type}_{entity}_{date}
```

Example: `health_drop_john@example.com_2025-12-10`

### 7. Auto-Generated Insights

Each alert includes:

**Title Examples:**
- "Client Health Drop: John Smith (john@example.com)"
- "5 Clients: Health Scores Dropping"
- "Deal Stalled: Enterprise Package - ACME Corp"
- "HubSpot - rate_limit: 5 Sync Failures"
- "Lead Response Delay: Sarah Johnson"

**Content Structure:**
- Primary alert details
- Related issues (if grouped)
- Analysis insights
- Predicted impact
- Recommended action

**Action Items:**
- Prioritized by severity
- Specific and actionable
- Includes urgency score

## Usage

### Manual Invocation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/ptd-proactive \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Scheduled Execution (Recommended)

Set up a cron job to run every 15-30 minutes:

```sql
-- Add to your cron schedules
SELECT cron.schedule(
  'ptd-proactive-monitor',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/ptd-proactive',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### Response Format

```json
{
  "success": true,
  "duration_ms": 1250,
  "anomalies_detected": 12,
  "alert_groups_created": 4,
  "alerts_saved": 3,
  "breakdown": {
    "health_drops": 5,
    "deal_stalls": 3,
    "sync_failures": 2,
    "response_delays": 2
  },
  "insights": [
    "5 clients experiencing health score drops. Average drop: 18 points.",
    "3 deals stalled. Most common stage: Proposal (2 deals)"
  ],
  "predictions": [
    "Trend indicates potential systemic issue affecting multiple clients.",
    "Review Proposal stage process. May indicate bottleneck or unclear next steps."
  ],
  "alert_groups": [
    {
      "type": "health_drop",
      "severity": "high",
      "urgency": 85,
      "affected_count": 5
    }
  ]
}
```

## Alert Storage

Alerts are stored in the `proactive_insights` table:

```typescript
{
  insight_type: 'alert',
  priority: 'critical' | 'high' | 'medium' | 'low',
  title: string,
  content: string,
  summary: string,
  action_items: [
    {
      action: string,
      priority: string,
      urgency_score: number
    }
  ],
  affected_entities: {
    type: string,
    count: number,
    entities: string[],
    urgency_score: number
  },
  source_agent: 'ptd-proactive',
  dedup_key: string,
  expires_at: timestamp // 48 hours from creation
}
```

## Querying Alerts

### Get Active Alerts

```sql
SELECT * FROM proactive_insights
WHERE source_agent = 'ptd-proactive'
  AND is_dismissed = false
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY priority DESC, created_at DESC;
```

### Get Critical Alerts

```sql
SELECT * FROM proactive_insights
WHERE source_agent = 'ptd-proactive'
  AND priority = 'critical'
  AND is_dismissed = false
ORDER BY created_at DESC;
```

### Get Alerts by Type

```sql
SELECT
  affected_entities->>'type' as anomaly_type,
  priority,
  COUNT(*) as alert_count
FROM proactive_insights
WHERE source_agent = 'ptd-proactive'
  AND is_dismissed = false
GROUP BY anomaly_type, priority
ORDER BY priority DESC, alert_count DESC;
```

## Configuration

Thresholds can be adjusted in the `THRESHOLDS` constant:

```typescript
const THRESHOLDS = {
  // Health score thresholds
  HEALTH_DROP_CRITICAL: 25,
  HEALTH_DROP_HIGH: 15,
  HEALTH_DROP_MEDIUM: 10,
  HEALTH_TREND_DAYS: 7,

  // Deal pipeline thresholds
  DEAL_STALL_DAYS_CRITICAL: 30,
  DEAL_STALL_DAYS_HIGH: 21,
  DEAL_STALL_DAYS_MEDIUM: 14,

  // Sync failure thresholds
  SYNC_FAIL_CRITICAL: 5,
  SYNC_FAIL_HIGH: 3,
  SYNC_FAIL_MEDIUM: 2,

  // Lead response thresholds (hours)
  RESPONSE_DELAY_CRITICAL: 24,
  RESPONSE_DELAY_HIGH: 12,
  RESPONSE_DELAY_MEDIUM: 6,

  // Alert deduplication window (hours)
  DEDUP_WINDOW_HOURS: 24,
};
```

## Recommended Actions by Anomaly Type

### Health Drops

**Critical** (25+ point drop):
- Schedule emergency check-in call within 24 hours
- Client at high risk of churn
- Escalate to senior coach or management

**High** (15-24 point drop):
- Reach out within 48 hours
- Understand what changed
- Offer support or adjustments

**Medium** (10-14 point drop):
- Send proactive check-in message
- Schedule wellness call within 1 week
- Monitor closely

### Deal Stalls

**Critical** (30+ days):
- Immediate follow-up required
- Consider re-engagement strategy or close-lost
- Review if opportunity is still viable

**High** (21-29 days):
- Reach out to understand blockers
- Offer assistance or incentives
- Re-qualify the opportunity

**Medium** (14-20 days):
- Follow up within 3 business days
- Check if prospect needs additional information
- Gentle nudge to move forward

### Sync Failures

**Critical** (5+ failures):
- Check API credentials immediately
- Review rate limits
- Check connectivity and system status
- May require immediate technical intervention

**High** (3-4 failures):
- Review error logs
- Consider manual retry
- May need system restart or config change

**Medium** (2 failures):
- Monitor sync status
- May resolve automatically with retry
- Investigate if pattern continues

### Response Delays

**Critical** (24+ hours):
- Respond immediately
- Lead interest likely cooling
- Strike while iron is hot

**High** (12-23 hours):
- Reach out within next 2 hours
- High priority for conversion
- Reference lead source in outreach

**Medium** (6-11 hours):
- Contact lead today
- Timely response improves conversion
- Prepare personalized message

## Performance

- **Typical execution time**: 800-2000ms
- **Database queries**: 4 (run in parallel)
- **Memory usage**: Minimal (<50MB)
- **Scalability**: Handles 10,000+ records efficiently

## Monitoring the Monitor

The agent itself logs extensively:

```
[PTD Proactive] Starting comprehensive monitoring scan...
[checkHealthScoreDrops] Found 5 health score anomalies
[checkDealPipelineStalls] Found 3 stalled deals
[checkSyncFailures] Found 2 sync failure patterns
[checkLeadResponseTimes] Found 2 delayed lead responses
[PTD Proactive] Found 12 total anomalies
[PTD Proactive] Grouped into 4 alert groups
[saveAlert] Saved alert: 5 Clients: Health Scores Dropping
[saveAlert] Skipping duplicate alert: deal_stall_Enterprise_Package_2025-12-10
[PTD Proactive] Complete. Saved 3 new alerts in 1250ms
```

## Integration

### Dashboard Display

```typescript
// Fetch active alerts for dashboard
const { data: alerts } = await supabase
  .from('proactive_insights')
  .select('*')
  .eq('source_agent', 'ptd-proactive')
  .eq('is_dismissed', false)
  .order('priority', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(10);

// Display with urgency indicators
alerts.forEach(alert => {
  const urgency = alert.affected_entities.urgency_score;
  const color = urgency >= 90 ? 'red' : urgency >= 70 ? 'orange' : 'yellow';
  // Render alert with appropriate styling
});
```

### Email Notifications

```typescript
// Send email for critical alerts
const criticalAlerts = alerts.filter(a => a.priority === 'critical');
if (criticalAlerts.length > 0) {
  await sendEmailNotification({
    to: 'team@example.com',
    subject: `${criticalAlerts.length} Critical Alerts Need Attention`,
    alerts: criticalAlerts
  });
}
```

### Slack Integration

```typescript
// Post to Slack for high-priority alerts
const highPriorityAlerts = alerts.filter(a =>
  a.priority === 'critical' || a.priority === 'high'
);

for (const alert of highPriorityAlerts) {
  await postToSlack({
    channel: '#alerts',
    text: alert.title,
    attachments: [
      {
        color: alert.priority === 'critical' ? 'danger' : 'warning',
        text: alert.summary,
        fields: [
          { title: 'Urgency', value: `${alert.affected_entities.urgency_score}/100` },
          { title: 'Affected', value: `${alert.affected_entities.count}` }
        ]
      }
    ]
  });
}
```

## Troubleshooting

### No Anomalies Detected

Check:
- Database has recent data (health_scores, deals, leads)
- Thresholds are appropriate for your business
- Tables exist and are accessible

### Too Many Alerts

Adjust:
- Increase threshold values
- Lengthen deduplication window
- Filter by severity in queries

### Missing Expected Alerts

Verify:
- Data is being updated regularly
- Calculations are running on schedule
- Deduplication isn't blocking new issues

## Future Enhancements

Potential additions:
- Machine learning for adaptive thresholds
- Anomaly correlation across entity types
- Predictive alerts (before issues occur)
- Auto-resolution tracking
- Performance metric anomaly detection
- Revenue impact calculation
- Coach workload balance monitoring

## License

Part of the Client Vital Suite - PTD Agent System
