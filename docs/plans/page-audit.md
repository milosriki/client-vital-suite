# Page-by-Page Audit — Every Page Status

## TIER 1: CEO Daily Dashboard (Must be perfect)

### ✅ Executive Overview (`/executive-overview`) — 406L
- **Data**: useExecutiveData hook → deals, contacts, calls, ad spend, health scores
- **Fixed this session**: stage/status mismatch, deal_value fallback
- **Shows**: Revenue KPIs, pipeline, leads, calls, top performers, stale leads
- **TODO**: Verify live after deploy

### ⚠️ Executive Dashboard (`/executive-dashboard`) — 518L  
- **Data**: aws_truth_cache, contacts
- **Issue**: aws_truth_cache only has 736 rows (from AWS sync)
- **Shows**: Business metrics, health overview
- **TODO**: Check if duplicate of Executive Overview — consolidate?

### ⚠️ Command Center (`/command-center`) — 1,108L
- **Data**: 6 views (ad_creative_funnel, adset_full_funnel, assessment_truth_matrix, campaign_full_funnel, client_health_scores, deals)
- **Shows**: Full funnel metrics, marketing→sales→revenue
- **TODO**: Verify all 6 views return data, deal_value→amount fallback

## TIER 2: Sales Management (Sales manager daily use)

### ✅ Setter Command Center (`/setter-command-center`) — 626L
- **Data**: view_setter_performance, view_daily_call_activity
- **Status**: WORKING — built this session
- **Shows**: Scorecards, 19-col comparison table, daily chart, quality flags

### ✅ Lead Follow-Up (`/lead-follow-up`) — 363L
- **Data**: view_lead_follow_up (6,617 rows)
- **Status**: WORKING
- **Shows**: Priority leads, flags, KPI cards

### ⚠️ Setter Activity Today (`/setter-activity-today`) — 377L
- **Data**: call_records, contacts, deals (today filter)
- **Issue**: Uses call_records.created_at for today — should work
- **TODO**: Verify owner_name shows, duration displays correctly

### ⚠️ Sales Pipeline (`/sales-pipeline`) — 606L
- **Data**: deals, contacts, call_records, appointments, client_payment_history
- **Issue**: client_payment_history = 0 rows, appointments = 1,378
- **Shows**: Pipeline stages, deal cards
- **TODO**: Fix stage display (show stage_label), handle empty client_payment_history

### ⚠️ Sales Coach Tracker (`/sales-coach-tracker`) — 504L
- **Data**: setter_funnel_matrix view + direct queries
- **Shows**: Setter funnel performance
- **TODO**: Verify setter_funnel_matrix view exists and has data

### ⚠️ Team Leaderboard (`/leaderboard`) — 264L
- **Data**: call_records, deals, leads, staff
- **Issue**: leads table = 4,227 rows (separate from contacts?)
- **TODO**: Verify staff table matches current team, leads query works

## TIER 3: Marketing Intelligence

### ⚠️ Marketing Intelligence (`/marketing-intelligence`) — 1,216L
- **Data**: 5 tabs via hooks (useDeepIntelligence, useMarketingAnalytics, usePeriodComparison)
- **Shows**: Truth Triangle, attribution, campaign performance, money map
- **TODO**: Verify all 5 tabs load data, view_truth_triangle exists

### ⚠️ Campaign Money Map (`/money-map`) — 171L
- **Data**: useDedupedQuery on facebook_ads_insights
- **Shows**: Ad spend by campaign
- **TODO**: Small page — verify data loads

### ⚠️ Revenue Intelligence (`/stripe`) — 712L
- **Data**: useRevenueIntelligence + usePipelineData + useHubSpotHealth + useLiveData
- **Fixed this session**: stage mismatch, deal_value fallback
- **Shows**: Pipeline health, revenue metrics, sync status
- **TODO**: Verify live

## TIER 4: Client & Coach Management

### ⚠️ Clients (`/clients`) — 185L
- **Data**: useClientHealthScores hook → client_health_scores
- **Shows**: Client list, health zones
- **Issue**: 4,280 health scores exist — should work
- **TODO**: Verify zone distribution chart renders

### ⚠️ Coaches (`/coaches`) — 150L
- **Data**: coach_performance (44 rows), client_health_scores
- **Shows**: Coach cards, performance metrics
- **TODO**: Verify coach data loads (44 records from AWS)

### ⚠️ Interventions/Risks (`/interventions`) — 416L
- **Data**: intervention_log (24 rows)
- **Shows**: At-risk clients, intervention history
- **Issue**: Only 24 records — page will look sparse
- **TODO**: Verify renders, consider expanding with health score data

## TIER 5: Intelligence & AI

### ⚠️ War Room (`/war-room`) — 186L
- **Data**: useWarRoomData hook
- **Shows**: Revenue pipeline, deal velocity, risk analysis
- **Fixed this session**: deal_value→amount fallback
- **TODO**: Verify renders

### ⚠️ Global Brain (`/global-brain`) — 469L
- **Data**: agent_memory table
- **Shows**: AI memory entries, add new memories
- **TODO**: Verify agent_memory table has data

### ⚠️ AI Business Advisor (`/ai-advisor`) — 240L
- **Data**: Uses edge function calls
- **Shows**: Chat interface with Atlas AI
- **TODO**: Verify edge function connection works

### ⚠️ Skill Command Center (`/skills-matrix`) — 649L
- **Data**: agent_tools, agent_conversations
- **Shows**: AI tool inventory, usage stats
- **TODO**: Verify data loads

### ⚠️ Reconciliation/Leak Detector (`/reconciliation`) — 268L
- **Data**: Multi-source comparison queries
- **Shows**: Data discrepancies between HubSpot/Stripe/FB
- **TODO**: Verify queries work

## TIER 6: Operations & Monitoring

### ⚠️ Call Tracking (`/call-tracking`) — 368L
- **Data**: call_records, contacts, enhanced_leads
- **Issue**: enhanced_leads = 0 rows!
- **TODO**: Fix enhanced_leads or remove dependency

### ⚠️ HubSpot Live (`/hubspot-live`) — 112L  
- **Data**: useHubSpotRealtime hook
- **Shows**: Real-time HubSpot data feed
- **TODO**: Verify realtime subscription works

### ⚠️ Analytics (`/analytics`) — 242L
- **Data**: Multiple tables
- **TODO**: Verify data loads

### ⚠️ Audit Trail (`/audit-trail`) — 471L
- **Data**: sync_logs, sync_errors
- **Shows**: Sync history, error log
- **TODO**: Verify data loads

### ⚠️ Stripe Intelligence (`/stripe`) — 405L
- **Data**: useStripeTransactions hook
- **Shows**: Stripe payments, subscriptions
- **TODO**: Verify 135 transactions load

### ⚠️ Yesterday Bookings (`/yesterday-bookings`) — 368L
- **Data**: deals + appointments
- **Shows**: Yesterday's scheduled assessments
- **TODO**: Verify date filter works

## TIER 7: Admin & Legacy

### ✅ Master Control Panel — 250L (edge function manager)
### ✅ AI Dev Console — 122L (developer tool)
### ⚠️ AI Knowledge — 302L (agent_knowledge table)
### ⚠️ AI Learning — 403L (agent_conversations)
### ⚠️ Observability — 457L (system health)
### ⚠️ Operations — 126L (wrapper page)
### ⚠️ HubSpot Analyzer — 150L
### ⚠️ Workflow Strategy — 795L (complex page)

## KNOWN EMPTY TABLES
- `client_payment_history`: 0 rows → SalesPipeline depends on it
- `enhanced_leads`: 0 rows → CallTracking depends on it
- `intervention_log`: 24 rows → Interventions page sparse

## PRIORITY FIX ORDER
1. Command Center — highest value page after Executive Overview
2. Sales Pipeline — stage_label display + handle empty tables
3. Call Tracking — fix enhanced_leads dependency
4. Marketing Intelligence — verify all 5 tabs
5. HubSpot Live — verify realtime works
6. War Room + Revenue Intelligence — verify after fix
7. Everything else
