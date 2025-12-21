# PTD Fitness Intelligence Platform - Complete Product Specification

## Overview
A comprehensive client health monitoring and business intelligence platform for PTD Fitness that combines real-time HubSpot data, Meta Conversions API integration, predictive analytics, and automated intervention systems to maximize client retention, optimize coach performance, and drive revenue growth.

---

## Core Modules

### 1. CLIENT HEALTH INTELLIGENCE SYSTEM

#### Health Score Engine
- **Multi-dimensional scoring algorithm** calculating client health across:
  - Engagement Score: Session frequency, booking consistency, app usage
  - Financial Score: Payment history, package value, outstanding balance
  - Relationship Score: Communication responsiveness, coach interaction quality
  - Package Health Score: Sessions remaining vs. time to renewal
  - Momentum Score: Trend analysis, rate of change indicators

#### Health Zones & Classification
- **Purple Zone (85-100)**: Champions - High engagement, zero risk
- **Green Zone (70-84)**: Healthy - Consistent activity, low risk
- **Yellow Zone (50-69)**: At Risk - Declining engagement, intervention needed
- **Red Zone (0-49)**: Critical - Immediate churn risk, urgent action required

#### Predictive Risk Modeling
- **Churn Risk Score (0-100)**: ML-powered prediction of client dropout probability
- **Early Warning Flags**: Automated detection of behavioral changes
- **Pattern Recognition**: Identifies churn patterns 7-30 days before occurrence
- **Trend Indicators**: Shows momentum direction (improving/stable/declining)

#### Real-Time Monitoring
- Live health score updates every 30 seconds
- Automatic recalculation on new data points
- Historical tracking with week-over-week comparisons
- Zone distribution visualization with company-wide aggregates

---

### 2. HUBSPOT LIVE DATA INTEGRATION

#### Real-Time Data Streaming
- **Live Contact Sync**: Pull contact properties, lifecycle stages, custom fields
- **Activity Tracking**: Monitor calls, emails, meetings, tasks in real-time
- **Deal Pipeline**: Track deal stages, amounts, close dates
- **Setter Performance**: Real-time call activity, reach rates, booking conversions

#### Timeframe Filtering
- Today's activity
- Yesterday's results
- Last 7 days rolling window
- This month / Last month comparisons
- Custom date range selection

#### Setter-Specific Views
- Individual setter performance dashboards
- Call volume and reach statistics
- Booking conversion rates
- Lead response times
- SLA compliance tracking

#### Premium Lead Management
- High-value lead identification
- Priority routing to top performers
- Lead age escalation alerts
- Automated reassignment on SLA breaches

---

### 3. META CONVERSIONS API (CAPI) INTEGRATION

#### Event Tracking & Enrichment
- **Event Types**: Purchase, Lead, CompleteRegistration, Schedule, ViewContent, AddToCart
- **PII Hashing**: Automatic SHA-256 hashing of sensitive data (email, phone, name)
- **Cookie Management**: fbp and fbc cookie handling (never hashed)
- **Data Enrichment**: Append HubSpot contact data, Stripe payment info, custom fields

#### Batch Processing System
- Scheduled batch sends (configurable times and days)
- Smart batching based on event volume
- Retry logic with exponential backoff
- Deduplication by event_id
- Mode switching (test/live) for safe deployment

#### Event Mapping
- HubSpot → Meta event translation
- Custom parameter mapping per event type
- Dynamic value calculation (AED currency default)
- Action source tracking
- Event source URL management

#### Monitoring & Logging
- Real-time event status tracking
- Meta API response logging
- Error handling and failure analysis
- Success rate metrics
- Batch job execution history

---

### 4. INTERVENTION MANAGEMENT SYSTEM

#### AI-Powered Recommendations
- **Psychological Insights**: Client persona analysis, communication style preferences
- **Root Cause Analysis**: Identifies why clients are disengaging
- **Recommended Actions**: Specific, actionable intervention strategies
- **Communication Templates**: AI-generated messages with optimal timing and tone
- **Success Probability**: Confidence scores for each intervention approach

#### Intervention Types
- Proactive Check-in: Scheduled wellness calls for at-risk clients
- Re-engagement Campaign: Multi-touch sequences for inactive clients
- Upgrade Opportunity: Package renewal or expansion offers
- Coach Reassignment: Match clients with better-fit trainers
- Special Promotion: Targeted discounts or incentives
- Emergency Intervention: Immediate outreach for critical cases

#### Workflow Automation
- **Trigger-Based Actions**: Automatic intervention creation on health score drops
- **Priority Queue**: Sorts interventions by urgency and revenue impact
- **Assignment Logic**: Routes to appropriate coach or admin
- **Follow-Up Tracking**: Scheduled reminders and outcome measurement
- **Effectiveness Scoring**: A/B test different intervention strategies

#### Outcome Measurement
- Health score changes (7-day and 30-day post-intervention)
- Session booking recovery
- Revenue protected calculations
- Trend reversal tracking
- Intervention effectiveness by type, coach, and client segment

---

### 5. COACH PERFORMANCE ANALYTICS

#### Individual Coach Dashboards
- **Active Client Portfolio**: Total clients, zone distribution, average health score
- **Performance Score**: Composite metric based on client outcomes
- **Client Trends**: Improving vs. declining client counts
- **Risk Management**: At-risk revenue, churn probability by coach
- **Intervention Success**: Effectiveness of coach-led interventions

#### Comparative Rankings
- Coach leaderboard with performance scores
- Peer benchmarking
- Best practices identification
- Strengths and weaknesses analysis
- Red flag detection (consistent underperformance)

#### Client Distribution Analysis
- Sessions per client averages
- Package type distribution
- Client segment breakdown
- Health score standard deviation
- Highest and lowest performing clients per coach

---

### 6. BUSINESS INTELLIGENCE & ANALYTICS

#### Executive Dashboard (KPIs)
- **Company-Wide Metrics**:
  - Average health score across all clients
  - Total clients by health zone
  - Week-over-week zone distribution changes
  - At-risk revenue (AED)
  - Critical interventions pending
  - New risks identified in last 24 hours

#### Revenue Analytics
- Total package value by zone
- Outstanding sessions value
- Predicted churn revenue impact
- Protected revenue from successful interventions
- Monthly recurring revenue tracking

#### Pattern Detection
- **Churn Patterns**: Behavioral signatures 7-30 days before dropout
- **Seasonal Trends**: Identifies time-based engagement patterns
- **Segment Analysis**: Health trends by client demographics, package types
- **Coach Impact**: Correlation between coach actions and client outcomes

#### Custom Reports
- Weekly performance summaries
- Monthly coach reviews
- Quarterly business reviews
- Ad-hoc data exports
- Automated email reports

---

### 7. AUTOMATION & WORKFLOW MANAGEMENT

#### Supabase Edge Functions
- **Workflow Orchestration**: Connects HubSpot, Meta, Supabase, Stripe
- **Event-Driven Actions**: Triggers on deal stages, form submissions, booking changes
- **Data Enrichment Pipelines**: Append Stripe data to HubSpot contacts
- **Batch Job Scheduling**: Automated CAPI event sends at optimal times

#### Workflow Fixer
- Automated detection of broken workflows
- One-click workflow updates
- Version control for workflow configurations
- Rollback capabilities
- Health checks and monitoring

#### Smart Scheduling
- Configurable batch times and days
- Timezone-aware scheduling (Asia/Dubai default)
- Rate limiting to avoid API throttling
- Retry logic with exponential backoff
- Concurrent execution control

---

### 8. DATA ENRICHMENT ENGINE

#### Stripe Integration
- Payment history sync
- Invoice tracking
- Subscription status monitoring
- Charge and refund logging
- Customer lifetime value calculation

#### HubSpot Enrichment
- Contact property updates
- Deal stage tracking
- Custom field population
- Activity logging
- Owner assignment tracking

#### Cross-Platform Data Mapping
- Email/phone as universal identifiers
- Deduplicate across systems
- Conflict resolution rules
- Data validation and sanitization
- Audit trails for all changes

---

### 9. SETTINGS & CONFIGURATION

#### API Credentials Management
- HubSpot API keys
- Meta Pixel ID and Access Tokens
- Stripe keys (test and production)
- Supabase Edge Function secrets
- Supabase connection strings
- Telegram bot tokens for notifications

#### Mode Management
- **Test Mode**: Safe testing with test event codes, separate data
- **Live Mode**: Production operation with real conversions
- Easy toggle between modes
- Mode-specific configurations
- Data isolation between modes

#### Event Mapping Configuration
- Create/edit HubSpot → Meta event mappings
- Custom parameter definitions
- Active/inactive mapping controls
- Default value settings
- Currency and timezone defaults

---

## Technical Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** with custom design system
- **Shadcn UI** components
- **React Query** for data fetching
- **React Router** for navigation
- **Recharts** for data visualization

### Backend Stack
- **Supabase** (PostgreSQL database)
- **Edge Functions** (Deno runtime)
- **Row Level Security** policies
- **Real-time subscriptions**
- **Storage buckets** for files

### External Integrations
- **HubSpot CRM** (contacts, deals, activities)
- **Meta Conversions API** (event tracking)
- **Stripe** (payments, subscriptions)
- **N8N** (workflow automation)
- **Telegram** (alert notifications)
- **Stape CAPI Gateway** (event routing)

### Data Flow
1. HubSpot → Edge Function → Supabase (contact/deal sync)
2. Supabase → Health Score Calculator → Client Health Scores table
3. Health Scores → Intervention Engine → Intervention Log
4. Intervention Log → Coach Dashboard → Action Items
5. Actions → HubSpot Updates → Meta CAPI Events
6. CAPI Events → Batch Processor → Meta API
7. Meta API → Response Logging → Analytics

---

## Security & Compliance

### Data Protection
- PII hashing before transmission to Meta
- Encrypted secrets in Supabase Vault
- Row Level Security on all tables
- API key rotation procedures
- Audit logging for sensitive operations

### Access Control
- Role-based permissions (admin, coach, viewer)
- Workspace-level isolation
- Function-level authentication
- JWT verification on edge functions
- CORS policies for API endpoints

---

## Performance Requirements

### Real-Time Data
- Health score updates within 30 seconds of data changes
- Live dashboard refresh every 60 seconds
- Intervention triggers within 5 minutes of health score drops
- HubSpot sync latency under 2 minutes

### Scalability
- Support 1000+ active clients
- Handle 10,000+ CAPI events per day
- Process 500+ interventions per week
- Store 1 year of historical data
- Sub-second query times on dashboards

---

## User Roles & Workflows

### Admin Users
- Full system access and configuration
- Manage API credentials and integrations
- Create and edit automation workflows
- Review all coach and client data
- Generate company-wide reports

### Coach Users
- View assigned clients only
- Access client health scores and history
- Create and manage interventions
- Log session notes and outcomes
- Track personal performance metrics

### Setter Users
- View leads and call activity
- Track daily/weekly performance
- Access booking conversion data
- Monitor SLA compliance
- See individual leaderboard rankings

---

## Success Metrics

### Client Retention
- Reduce churn rate by 30%
- Increase average client lifetime by 6 months
- Improve health score trends company-wide
- Achieve 85%+ clients in Green/Purple zones

### Revenue Impact
- Protect 1M+ AED annually through interventions
- Increase package renewal rates by 25%
- Reduce at-risk revenue by 50%
- Improve payment collection by 20%

### Operational Efficiency
- Reduce manual data entry by 90%
- Automate 80% of routine interventions
- Cut admin time by 15 hours/week
- Improve coach utilization by 20%

### Marketing Performance
- Increase Meta ROAS by 40%
- Improve lead quality scores
- Reduce cost per booking by 30%
- Enhance audience targeting accuracy

---

## Future Enhancements

### Phase 2 Features
- Mobile app for coaches (iOS/Android)
- WhatsApp integration for client communication
- AI chatbot for 24/7 client support
- Predictive package recommendations
- Dynamic pricing engine
- Client self-service portal

### Phase 3 Features
- Multi-location support
- Franchise management tools
- Advanced ML models for churn prediction
- Computer vision for form analysis
- Wearable device integrations (Apple Watch, Fitbit)
- Social media sentiment analysis

---

## Data Models

### Core Tables
- `client_health_scores`: Historical health metrics per client per day
- `intervention_log`: All interventions with outcomes and effectiveness
- `coach_performance`: Daily coach metrics and rankings
- `capi_events_enriched`: Enriched Meta conversion events
- `event_mappings`: HubSpot to Meta event translation rules
- `batch_config`: Scheduled batch job configurations
- `automation_logs`: Audit trail of all automated actions

### Views
- `company_health_aggregates`: Real-time KPI rollups
- `at_risk_clients`: Filtered view of Yellow/Red zone clients
- `coach_leaderboard`: Performance rankings with trends

### Functions
- `calculate_daily_health_scores()`: Batch recalculation job
- `upsert_capi_event()`: Deduplicated event insertion
- `monthly_coach_review()`: Generate coach performance reports
- `get_zone_distribution()`: Health zone counts by date

---

## API Endpoints

### Edge Functions
- `/fetch-hubspot-live`: Real-time HubSpot data retrieval
- `/sync-hubspot-to-capi`: HubSpot → Meta CAPI sync
- `/process-capi-batch`: Scheduled batch event sends
- `/enrich-with-stripe`: Append Stripe data to contacts
- `/setup-workflows`: Initialize N8N workflows
- `/fix-n8n-workflows`: Automated workflow repairs
- `/send-to-stape-capi`: Route events through Stape gateway

---

This application is designed to be the **central nervous system** for PTD Fitness, providing real-time insights, predictive intelligence, and automated actions to maximize client success and business growth.
