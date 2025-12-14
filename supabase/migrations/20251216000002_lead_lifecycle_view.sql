-- Lead Lifecycle View
-- Unified view tracking lead progression through all stages

CREATE OR REPLACE VIEW public.lead_lifecycle_view AS
SELECT 
  c.hubspot_contact_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  
  -- Current Stage
  c.lifecycle_stage as current_lifecycle_stage,
  CASE 
    WHEN c.lifecycle_stage = 'lead' THEN 'New Lead'
    WHEN c.lifecycle_stage = 'marketingqualifiedlead' THEN 'MQL'
    WHEN c.lifecycle_stage = 'salesqualifiedlead' THEN 'SQL'
    WHEN c.lifecycle_stage = 'opportunity' THEN 'Opportunity'
    WHEN c.lifecycle_stage = 'customer' THEN 'Customer'
    ELSE c.lifecycle_stage
  END as current_lifecycle_stage_name,
  
  c.lead_status as current_lead_status,
  
  -- Deal Stage
  d.stage as current_deal_stage_id,
  CASE 
    WHEN d.stage = '122178070' THEN 'New Lead (Incoming)'
    WHEN d.stage = '122237508' THEN 'Assessment Booked'
    WHEN d.stage = '122237276' THEN 'Assessment Completed'
    WHEN d.stage = '122221229' THEN 'Booking Process'
    WHEN d.stage = 'qualifiedtobuy' THEN 'Qualified to Buy'
    WHEN d.stage = 'decisionmakerboughtin' THEN 'Decision Maker Bought In'
    WHEN d.stage = 'contractsent' THEN 'Contract Sent'
    WHEN d.stage = '2900542' THEN 'Payment Pending'
    WHEN d.stage = '987633705' THEN 'Onboarding'
    WHEN d.stage = 'closedwon' THEN 'Closed Won'
    WHEN d.stage = '1063991961' THEN 'Closed Lost'
    WHEN d.stage = '1064059180' THEN 'On Hold'
    ELSE d.stage
  END as current_deal_stage_name,
  
  d.status as deal_status,
  d.deal_value,
  d.close_date,
  
  -- Owner
  c.owner_name,
  c.owner_id,
  
  -- Timeline
  c.created_at as lead_created_at,
  d.created_at as deal_created_at,
  
  -- Time in current stage
  EXTRACT(EPOCH FROM (NOW() - COALESCE(d.updated_at, c.updated_at))) / 86400 as days_in_current_stage,
  
  -- Journey Stage (calculated)
  CASE
    WHEN d.stage = 'closedwon' THEN 12 -- Closed Won
    WHEN d.stage = '987633705' THEN 11 -- Onboarding
    WHEN d.stage = '2900542' THEN 10 -- Payment Pending
    WHEN d.stage = 'decisionmakerboughtin' THEN 9 -- Contract Sent
    WHEN d.stage = 'qualifiedtobuy' THEN 8 -- Package Selected
    WHEN d.stage = '122221229' THEN 7 -- Deal Created
    WHEN d.stage = '122237276' THEN 5 -- Appointment Held
    WHEN d.stage = '122237508' THEN 4 -- Appointment Booked
    WHEN c.lifecycle_stage = 'lead' THEN 1 -- Lead Created
    ELSE 0
  END as journey_stage_number,
  
  CASE
    WHEN d.stage = 'closedwon' THEN 'Closed Won'
    WHEN d.stage = '987633705' THEN 'Onboarding'
    WHEN d.stage = '2900542' THEN 'Payment Pending'
    WHEN d.stage = 'decisionmakerboughtin' THEN 'Contract Sent'
    WHEN d.stage = 'qualifiedtobuy' THEN 'Package Selected'
    WHEN d.stage = '122221229' THEN 'Deal Created'
    WHEN d.stage = '122237276' THEN 'Appointment Held'
    WHEN d.stage = '122237508' THEN 'Appointment Booked'
    WHEN c.lifecycle_stage = 'lead' THEN 'Lead Created'
    ELSE 'Unknown'
  END as journey_stage_name,
  
  -- Recent Activity
  (SELECT COUNT(*) FROM public.call_records cr WHERE cr.caller_number = c.phone OR cr.caller_number = c.email LIMIT 1) as has_calls,
  (SELECT COUNT(*) FROM public.appointments a WHERE a.email = c.email LIMIT 1) as has_appointments,
  
  -- Health Score (if available)
  chs.health_score,
  chs.health_zone,
  chs.churn_risk_score,
  
  -- Attribution
  ae.source as attribution_source,
  ae.campaign as attribution_campaign,
  ae.fb_campaign_id,
  
  -- Last Updated
  GREATEST(c.updated_at, COALESCE(d.updated_at, c.created_at)) as last_updated_at
  
FROM public.contacts c
LEFT JOIN public.deals d ON d.hubspot_contact_id = c.hubspot_contact_id AND d.status = 'open'
LEFT JOIN public.client_health_scores chs ON chs.email = c.email
LEFT JOIN LATERAL (
  SELECT source, campaign, fb_campaign_id
  FROM public.attribution_events
  WHERE email = c.email
  ORDER BY event_time DESC
  LIMIT 1
) ae ON true;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON public.contacts(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals(status);

COMMENT ON VIEW public.lead_lifecycle_view IS 'Unified view tracking lead progression through all 12 stages from creation to closed won';
