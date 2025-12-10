# PTD Proactive Monitor - Usage Examples

## Example 1: Health Score Drop Alert

### Input Data
```sql
-- Client health scores showing a drop
INSERT INTO client_health_scores (email, firstname, lastname, health_score, health_zone, calculated_at)
VALUES
  ('john@example.com', 'John', 'Smith', 45, 'RED', NOW()),
  ('john@example.com', 'John', 'Smith', 70, 'GREEN', NOW() - INTERVAL '3 days');
```

### Generated Alert
```json
{
  "insight_type": "alert",
  "priority": "high",
  "title": "Client Health Drop: John Smith (john@example.com)",
  "content": "**Primary Alert:**\nJohn Smith (john@example.com) health score dropped 25 points (from 70 to 45). Currently in RED zone.\n\n**Recommended Action:**\nURGENT: Schedule emergency check-in call within 24 hours. Client at high risk of churn. Score dropped 25 points.",
  "summary": "health_drop: John Smith (john@example.com). Urgency: 92/100",
  "action_items": [
    {
      "action": "URGENT: Schedule emergency check-in call within 24 hours...",
      "priority": "high",
      "urgency_score": 92
    }
  ],
  "affected_entities": {
    "type": "health_drop",
    "count": 1,
    "entities": ["John Smith (john@example.com)"],
    "urgency_score": 92
  }
}
```

## Example 2: Multiple Health Drops (Grouped)

### Input Data
```sql
-- Multiple clients experiencing health drops
-- (3+ clients with score drops)
```

### Generated Alert
```json
{
  "insight_type": "alert",
  "priority": "high",
  "title": "5 Clients: Health Scores Dropping",
  "content": "**Primary Alert:**\nJohn Smith (john@example.com) health score dropped 25 points (from 70 to 45). Currently in RED zone.\n\n**Related Issues (4):**\n- Sarah Johnson (dropped 18 points)\n- Mike Davis (dropped 15 points)\n- Emily Chen (dropped 12 points)\n- Robert Taylor (dropped 11 points)\n\n**Analysis:**\n- 5 clients experiencing health score drops. Average drop: 16 points.\n\n**Predicted Impact:**\n- Trend indicates potential systemic issue affecting multiple clients. Investigate common factors.\n\n**Recommended Action:**\nURGENT: Schedule emergency check-in call within 24 hours. Client at high risk of churn. Score dropped 25 points.",
  "summary": "5 health_drop anomalies detected. Urgency: 88/100",
  "affected_entities": {
    "type": "health_drop",
    "count": 5,
    "urgency_score": 88
  }
}
```

## Example 3: Stalled Deal Alert

### Input Data
```sql
-- Deal stuck in pipeline
INSERT INTO deals (name, stage, amount, updated_at, last_activity_date)
VALUES ('Enterprise Package - ACME Corp', 'Proposal', 50000, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days');
```

### Generated Alert
```json
{
  "insight_type": "alert",
  "priority": "high",
  "title": "Deal Stalled: Enterprise Package - ACME Corp",
  "content": "**Primary Alert:**\nEnterprise Package - ACME Corp has been stuck in Proposal stage for 25 days without activity.\n\n**Recommended Action:**\nHigh Priority: Reach out to understand blockers. Offer assistance or incentives to move forward.",
  "summary": "deal_stall: Enterprise Package - ACME Corp. Urgency: 85/100",
  "action_items": [
    {
      "action": "High Priority: Reach out to understand blockers...",
      "priority": "high",
      "urgency_score": 85
    }
  ],
  "affected_entities": {
    "type": "deal_stall",
    "count": 1,
    "urgency_score": 85
  }
}
```

## Example 4: Sync Failure Alert

### Input Data
```sql
-- Multiple sync failures from HubSpot
INSERT INTO sync_errors (error_type, source, object_type, error_message, created_at)
VALUES
  ('rate_limit', 'hubspot', 'contact', 'Rate limit exceeded', NOW()),
  ('rate_limit', 'hubspot', 'contact', 'Rate limit exceeded', NOW() - INTERVAL '2 hours'),
  ('rate_limit', 'hubspot', 'deal', 'Rate limit exceeded', NOW() - INTERVAL '4 hours'),
  ('rate_limit', 'hubspot', 'contact', 'Rate limit exceeded', NOW() - INTERVAL '6 hours');
```

### Generated Alert
```json
{
  "insight_type": "alert",
  "priority": "high",
  "title": "hubspot - rate_limit: 4 Sync Failures",
  "content": "**Primary Alert:**\nhubspot - rate_limit has failed 4 times in the last 24 hours.\n\n**Analysis:**\n- Sync failures detected across 1 source(s): hubspot\n\n**Recommended Action:**\nHigh Priority: hubspot experiencing rate_limit errors. Review error logs and consider manual retry or system restart.",
  "summary": "sync_fail: hubspot - rate_limit. Urgency: 79/100",
  "affected_entities": {
    "type": "sync_fail",
    "count": 1,
    "urgency_score": 79
  }
}
```

## Example 5: Lead Response Delay

### Input Data
```sql
-- New lead waiting for response
INSERT INTO leads (name, email, status, source, created_at, last_contact_date)
VALUES ('Sarah Williams', 'sarah@example.com', 'new', 'website', NOW() - INTERVAL '18 hours', NULL);
```

### Generated Alert
```json
{
  "insight_type": "alert",
  "priority": "high",
  "title": "Lead Response Delay: Sarah Williams",
  "content": "**Primary Alert:**\nSarah Williams has been waiting 18 hours without any contact or response.\n\n**Recommended Action:**\nHigh Priority: Reach out within next 2 hours. Lead interest may be cooling. Source: website",
  "summary": "response_delay: Sarah Williams. Urgency: 79/100",
  "action_items": [
    {
      "action": "High Priority: Reach out within next 2 hours...",
      "priority": "high",
      "urgency_score": 79
    }
  ],
  "affected_entities": {
    "type": "response_delay",
    "count": 1,
    "urgency_score": 79
  }
}
```

## Example 6: Complex Multi-Type Alert Response

### Full API Response
```json
{
  "success": true,
  "duration_ms": 1450,
  "anomalies_detected": 15,
  "alert_groups_created": 4,
  "alerts_saved": 4,
  "breakdown": {
    "health_drops": 7,
    "deal_stalls": 4,
    "sync_failures": 2,
    "response_delays": 2
  },
  "insights": [
    "7 clients experiencing health score drops. Average drop: 16 points.",
    "4 deals stalled. Most common stage: Proposal (3 deals)",
    "Sync failures detected across 2 source(s): hubspot, stripe",
    "2 leads waiting for response. Average wait time: 14 hours"
  ],
  "predictions": [
    "Trend indicates potential systemic issue affecting multiple clients. Investigate common factors.",
    "Review Proposal stage process. May indicate bottleneck or unclear next steps.",
    "Critical sync failures may cause data inconsistencies. Immediate attention required.",
    "Slow lead response times directly impact conversion rates. Consider automation or staffing adjustments."
  ],
  "alert_groups": [
    {
      "type": "health_drop",
      "severity": "high",
      "urgency": 88,
      "affected_count": 7
    },
    {
      "type": "deal_stall",
      "severity": "medium",
      "urgency": 72,
      "affected_count": 4
    },
    {
      "type": "sync_fail",
      "severity": "high",
      "urgency": 81,
      "affected_count": 2
    },
    {
      "type": "response_delay",
      "severity": "medium",
      "urgency": 68,
      "affected_count": 2
    }
  ]
}
```

## Example 7: Dashboard Integration

### React Component Example
```typescript
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

interface Alert {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  affected_entities: {
    urgency_score: number;
    count: number;
  };
  created_at: string;
}

function ProactiveAlertsDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();

    // Subscribe to new alerts
    const subscription = supabase
      .channel('proactive_alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'proactive_insights',
        filter: 'source_agent=eq.ptd-proactive'
      }, (payload) => {
        setAlerts(prev => [payload.new as Alert, ...prev]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadAlerts() {
    const { data, error } = await supabase
      .from('proactive_insights')
      .select('*')
      .eq('source_agent', 'ptd-proactive')
      .eq('is_dismissed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setAlerts(data);
    setLoading(false);
  }

  async function dismissAlert(id: string) {
    await supabase
      .from('proactive_insights')
      .update({ is_dismissed: true })
      .eq('id', id);

    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  if (loading) return <div>Loading alerts...</div>;

  return (
    <div className="alerts-dashboard">
      <h2>Proactive Alerts ({alerts.length})</h2>

      {alerts.map(alert => (
        <div
          key={alert.id}
          className={`alert alert-${alert.priority}`}
          data-urgency={alert.affected_entities.urgency_score}
        >
          <div className="alert-header">
            <span className="priority-badge">{alert.priority.toUpperCase()}</span>
            <span className="urgency-score">
              {alert.affected_entities.urgency_score}/100
            </span>
          </div>

          <h3>{alert.title}</h3>
          <p>{alert.summary}</p>

          <div className="alert-meta">
            <span>Affected: {alert.affected_entities.count}</span>
            <span>{new Date(alert.created_at).toLocaleString()}</span>
          </div>

          <button onClick={() => dismissAlert(alert.id)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Example 8: Email Notification Setup

### Automated Email for Critical Alerts
```typescript
// Run after each monitoring scan
async function sendCriticalAlertEmails() {
  const { data: criticalAlerts } = await supabase
    .from('proactive_insights')
    .select('*')
    .eq('source_agent', 'ptd-proactive')
    .eq('priority', 'critical')
    .eq('is_dismissed', false)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // Last 15 min

  if (criticalAlerts && criticalAlerts.length > 0) {
    await sendEmail({
      to: 'team@example.com',
      subject: `🚨 ${criticalAlerts.length} Critical Alert(s) Detected`,
      html: `
        <h2>Critical Alerts Require Immediate Attention</h2>
        ${criticalAlerts.map(alert => `
          <div style="border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
            <h3>${alert.title}</h3>
            <p>${alert.summary}</p>
            <p><strong>Urgency:</strong> ${alert.affected_entities.urgency_score}/100</p>
            <p><strong>Action:</strong> ${alert.action_items[0]?.action || 'Review immediately'}</p>
          </div>
        `).join('')}
      `
    });
  }
}
```

## Example 9: Slack Webhook Integration

### Post Alerts to Slack
```typescript
async function postAlertsToSlack() {
  const { data: newAlerts } = await supabase
    .from('proactive_insights')
    .select('*')
    .eq('source_agent', 'ptd-proactive')
    .in('priority', ['critical', 'high'])
    .eq('is_dismissed', false)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

  for (const alert of newAlerts || []) {
    const urgency = alert.affected_entities.urgency_score;
    const color = alert.priority === 'critical' ? '#dc2626' : '#f59e0b';
    const emoji = urgency >= 90 ? '🚨' : urgency >= 70 ? '⚠️' : '📊';

    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} New ${alert.priority.toUpperCase()} Alert`,
        attachments: [
          {
            color,
            title: alert.title,
            text: alert.summary,
            fields: [
              {
                title: 'Urgency',
                value: `${urgency}/100`,
                short: true
              },
              {
                title: 'Affected',
                value: `${alert.affected_entities.count}`,
                short: true
              }
            ],
            footer: 'PTD Proactive Monitor',
            ts: Math.floor(new Date(alert.created_at).getTime() / 1000)
          }
        ]
      })
    });
  }
}
```

## Example 10: Custom Threshold Configuration

### Adjust Thresholds for Your Business
```typescript
// Create a custom version with adjusted thresholds
const CUSTOM_THRESHOLDS = {
  // More sensitive to health drops
  HEALTH_DROP_CRITICAL: 20,  // Alert at 20 points instead of 25
  HEALTH_DROP_HIGH: 12,       // Alert at 12 points instead of 15
  HEALTH_DROP_MEDIUM: 8,      // Alert at 8 points instead of 10

  // Faster deal follow-up
  DEAL_STALL_DAYS_CRITICAL: 21,  // Alert at 21 days instead of 30
  DEAL_STALL_DAYS_HIGH: 14,      // Alert at 14 days instead of 21
  DEAL_STALL_DAYS_MEDIUM: 7,     // Alert at 7 days instead of 14

  // More tolerant of sync failures
  SYNC_FAIL_CRITICAL: 10,    // Alert at 10 failures instead of 5
  SYNC_FAIL_HIGH: 6,         // Alert at 6 failures instead of 3
  SYNC_FAIL_MEDIUM: 3,       // Alert at 3 failures instead of 2

  // Faster lead response expectations
  RESPONSE_DELAY_CRITICAL: 12,  // Alert at 12 hours instead of 24
  RESPONSE_DELAY_HIGH: 6,       // Alert at 6 hours instead of 12
  RESPONSE_DELAY_MEDIUM: 2,     // Alert at 2 hours instead of 6
};
```

## Testing

### Manual Test Script
```bash
#!/bin/bash

# Test the proactive monitor
echo "Testing PTD Proactive Monitor..."

SUPABASE_URL="https://your-project.supabase.co"
FUNCTION_URL="$SUPABASE_URL/functions/v1/ptd-proactive"
API_KEY="your-anon-key-here"

# Run the monitor
response=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json")

# Parse response
echo "$response" | jq '.'

# Check for alerts
alerts_saved=$(echo "$response" | jq -r '.alerts_saved')
echo "Alerts saved: $alerts_saved"

# Query the alerts
curl -s "$SUPABASE_URL/rest/v1/proactive_insights?source_agent=eq.ptd-proactive&is_dismissed=eq.false&order=created_at.desc&limit=5" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" | jq '.'
```

## Performance Monitoring

### Track Agent Performance
```sql
-- View agent execution stats
SELECT
  DATE(created_at) as date,
  COUNT(*) as alerts_created,
  COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
  AVG((affected_entities->>'urgency_score')::int) as avg_urgency
FROM proactive_insights
WHERE source_agent = 'ptd-proactive'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Alert Resolution Tracking
```sql
-- Track which alerts get actioned
SELECT
  affected_entities->>'type' as alert_type,
  priority,
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN is_actioned THEN 1 END) as actioned_count,
  ROUND(100.0 * COUNT(CASE WHEN is_actioned THEN 1 END) / COUNT(*), 1) as action_rate
FROM proactive_insights
WHERE source_agent = 'ptd-proactive'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY alert_type, priority
ORDER BY total_alerts DESC;
```
