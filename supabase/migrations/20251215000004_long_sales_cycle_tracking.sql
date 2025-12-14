-- Long Sales Cycle Tracking & Visibility
-- Prevents closing leads too early, tracks full journey

-- 1. Create unified customer journey view
CREATE OR REPLACE VIEW public.customer_journey_view AS
SELECT 
  c.id as contact_id,
  c.email,
  c.first_name,
  c.last_name,
  c.hubspot_contact_id,
  c.lifecycle_stage,
  c.lead_status,
  
  -- Timeline Events
  c.first_touch_time as first_touch,
  c.last_touch_time as last_touch,
  c.first_conversion_date,
  c.recent_conversion_date,
  
  -- Days calculations
  EXTRACT(EPOCH FROM (NOW() - c.first_touch_time)) / 86400 as days_since_first_touch,
  EXTRACT(EPOCH FROM (NOW() - c.last_touch_time)) / 86400 as days_since_last_touch,
  EXTRACT(EPOCH FROM (NOW() - c.first_conversion_date)) / 86400 as days_since_first_conversion,
  
  -- Touch counts
  c.total_events as total_touches,
  c.num_form_submissions,
  c.num_unique_forms_submitted,
  
  -- Attribution
  c.first_touch_source,
  c.latest_traffic_source,
  c.source,
  
  -- Value tracking
  c.total_value,
  c.total_deal_value,
  c.open_deal_value,
  
  -- Call metrics
  COALESCE(call_stats.total_calls, 0) as total_calls,
  COALESCE(call_stats.completed_calls, 0) as completed_calls,
  COALESCE(call_stats.missed_calls, 0) as missed_calls,
  COALESCE(call_stats.last_call_date, NULL) as last_call_date,
  COALESCE(call_stats.days_since_last_call, NULL) as days_since_last_call,
  
  -- Appointment metrics
  COALESCE(appt_stats.total_appointments, 0) as total_appointments,
  COALESCE(appt_stats.completed_appointments, 0) as completed_appointments,
  COALESCE(appt_stats.no_shows, 0) as no_shows,
  COALESCE(appt_stats.last_appointment_date, NULL) as last_appointment_date,
  COALESCE(appt_stats.days_since_last_appointment, NULL) as days_since_last_appointment,
  COALESCE(appt_stats.next_appointment_date, NULL) as next_appointment_date,
  
  -- AnyTrack events
  COALESCE(anytrack_stats.anytrack_events, 0) as anytrack_events,
  COALESCE(anytrack_stats.last_anytrack_event, NULL) as last_anytrack_event,
  COALESCE(anytrack_stats.days_since_anytrack, NULL) as days_since_anytrack,
  
  -- Risk indicators
  CASE 
    WHEN c.lifecycle_stage IN ('customer', 'opportunity') THEN 'low_risk'
    WHEN c.lifecycle_stage = 'salesqualifiedlead' AND COALESCE(call_stats.days_since_last_call, 999) < 7 THEN 'low_risk'
    WHEN c.lifecycle_stage = 'marketingqualifiedlead' AND COALESCE(appt_stats.days_since_last_appointment, 999) < 14 THEN 'low_risk'
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 3 THEN 'low_risk'
    WHEN COALESCE(appt_stats.next_appointment_date, '1900-01-01'::date) > NOW() THEN 'low_risk'
    WHEN COALESCE(anytrack_stats.days_since_anytrack, 999) < 7 THEN 'low_risk'
    WHEN c.total_events > 5 AND COALESCE(call_stats.days_since_last_call, 999) < 14 THEN 'medium_risk'
    ELSE 'high_risk_close'
  END as close_risk,
  
  -- Long cycle indicator
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - c.first_touch_time)) / 86400 > 90 THEN 'long_cycle'
    WHEN EXTRACT(EPOCH FROM (NOW() - c.first_touch_time)) / 86400 > 30 THEN 'medium_cycle'
    ELSE 'short_cycle'
  END as cycle_length,
  
  -- Engagement score
  CASE
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 3 THEN 100
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 7 THEN 80
    WHEN COALESCE(appt_stats.days_since_last_appointment, 999) < 14 THEN 70
    WHEN COALESCE(anytrack_stats.days_since_anytrack, 999) < 7 THEN 60
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 14 THEN 50
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 30 THEN 30
    ELSE 10
  END as engagement_score,
  
  -- Warning flags
  CASE 
    WHEN c.lifecycle_stage IN ('lead', 'marketingqualifiedlead', 'salesqualifiedlead') 
      AND COALESCE(call_stats.days_since_last_call, 999) < 7 THEN true
    WHEN COALESCE(appt_stats.next_appointment_date, '1900-01-01'::date) > NOW() THEN true
    WHEN COALESCE(anytrack_stats.days_since_anytrack, 999) < 7 THEN true
    ELSE false
  END as warning_dont_close,
  
  c.created_at,
  c.updated_at

FROM public.contacts c

-- Call statistics (link by caller_number/email)
LEFT JOIN (
  SELECT 
    c2.id as contact_id,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN cr.call_status = 'completed' THEN 1 END) as completed_calls,
    COUNT(CASE WHEN cr.call_status = 'missed' THEN 1 END) as missed_calls,
    MAX(cr.started_at) as last_call_date,
    EXTRACT(EPOCH FROM (NOW() - MAX(cr.started_at))) / 86400 as days_since_last_call
  FROM public.call_records cr
  LEFT JOIN public.contacts c2 ON c2.phone = cr.caller_number OR c2.email = (
    SELECT email FROM public.contacts WHERE phone = cr.caller_number LIMIT 1
  )
  WHERE c2.id IS NOT NULL
  GROUP BY c2.id
) call_stats ON call_stats.contact_id = c.id

-- Appointment statistics
LEFT JOIN (
  SELECT 
    contact_id,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_shows,
    MAX(start_time) as last_appointment_date,
    MIN(CASE WHEN status = 'scheduled' AND start_time > NOW() THEN start_time END) as next_appointment_date,
    EXTRACT(EPOCH FROM (NOW() - MAX(start_time))) / 86400 as days_since_last_appointment
  FROM public.appointments
  GROUP BY contact_id
) appt_stats ON appt_stats.contact_id = c.id

-- AnyTrack event statistics
LEFT JOIN (
  SELECT 
    email,
    COUNT(*) as anytrack_events,
    MAX(event_time) as last_anytrack_event,
    EXTRACT(EPOCH FROM (NOW() - MAX(event_time))) / 86400 as days_since_anytrack
  FROM public.attribution_events
  WHERE platform IN ('anytrack', 'hubspot_anytrack')
  GROUP BY email
) anytrack_stats ON anytrack_stats.email = c.email;

COMMENT ON VIEW public.customer_journey_view IS 'Unified customer journey with AnyTrack, Calendly, calls, and lifecycle tracking';

-- 2. Create journey timeline events view
CREATE OR REPLACE VIEW public.journey_timeline_events AS
SELECT 
  'anytrack' as event_source,
  event_time as event_date,
  email,
  event_name as event_type,
  'AnyTrack Event' as event_description,
  value as event_value,
  campaign as campaign_name,
  source as attribution_source,
  NULL::uuid as contact_id,
  NULL::uuid as call_id,
  NULL::uuid as appointment_id
FROM public.attribution_events
WHERE platform IN ('anytrack', 'hubspot_anytrack')

UNION ALL

SELECT 
  'call' as event_source,
  started_at as event_date,
  c.email,
  call_status as event_type,
  CASE 
    WHEN call_direction = 'inbound' THEN 'Inbound Call'
    WHEN call_direction = 'outbound' THEN 'Outbound Call'
    ELSE 'Call'
  END as event_description,
  NULL::numeric as event_value,
  NULL::text as campaign_name,
  NULL::text as attribution_source,
  cr.contact_id,
  cr.id as call_id,
  NULL::uuid as appointment_id
FROM public.call_records cr
LEFT JOIN public.contacts c ON c.id = cr.contact_id

UNION ALL

SELECT 
  'appointment' as event_source,
  start_time as event_date,
  c.email,
  status as event_type,
  CASE 
    WHEN status = 'scheduled' THEN 'Appointment Scheduled'
    WHEN status = 'completed' THEN 'Appointment Completed'
    WHEN status = 'no_show' THEN 'No Show'
    WHEN status = 'cancelled' THEN 'Appointment Cancelled'
    ELSE 'Appointment'
  END as event_description,
  NULL::numeric as event_value,
  NULL::text as campaign_name,
  NULL::text as attribution_source,
  a.contact_id,
  NULL::uuid as call_id,
  a.id as appointment_id
FROM public.appointments a
LEFT JOIN public.contacts c ON c.id = a.contact_id

UNION ALL

SELECT 
  'lifecycle' as event_source,
  updated_at as event_date,
  email,
  lifecycle_stage as event_type,
  'Lifecycle Stage: ' || lifecycle_stage as event_description,
  total_value as event_value,
  latest_traffic_source as campaign_name,
  first_touch_source as attribution_source,
  id as contact_id,
  NULL::uuid as call_id,
  NULL::uuid as appointment_id
FROM public.contacts
WHERE lifecycle_stage IS NOT NULL

ORDER BY event_date DESC;

COMMENT ON VIEW public.journey_timeline_events IS 'Unified timeline of all customer journey events';

-- 3. Create long cycle protection view (warns before closing)
CREATE OR REPLACE VIEW public.long_cycle_protection AS
SELECT 
  c.id,
  c.email,
  c.first_name,
  c.last_name,
  c.lifecycle_stage,
  c.lead_status,
  
  -- Cycle metrics
  EXTRACT(EPOCH FROM (NOW() - c.first_touch_time)) / 86400 as days_in_cycle,
  EXTRACT(EPOCH FROM (NOW() - c.last_touch_time)) / 86400 as days_since_last_touch,
  
  -- Activity indicators
  COALESCE(call_stats.days_since_last_call, 999) as days_since_call,
  COALESCE(appt_stats.days_since_appointment, 999) as days_since_appointment,
  COALESCE(anytrack_stats.days_since_event, 999) as days_since_anytrack,
  
  -- Recent activity flags
  CASE WHEN COALESCE(call_stats.days_since_last_call, 999) < 7 THEN true ELSE false END as recent_call,
  CASE WHEN COALESCE(appt_stats.days_since_appointment, 999) < 14 THEN true ELSE false END as recent_appointment,
  CASE WHEN COALESCE(anytrack_stats.days_since_event, 999) < 7 THEN true ELSE false END as recent_anytrack,
  CASE WHEN appt_stats.next_appointment IS NOT NULL THEN true ELSE false END as has_upcoming_appointment,
  
  -- Protection recommendation
  CASE 
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 3 THEN '🚨 DO NOT CLOSE - Recent call activity'
    WHEN COALESCE(appt_stats.days_since_appointment, 999) < 7 THEN '🚨 DO NOT CLOSE - Recent appointment'
    WHEN appt_stats.next_appointment IS NOT NULL THEN '🚨 DO NOT CLOSE - Upcoming appointment scheduled'
    WHEN COALESCE(anytrack_stats.days_since_event, 999) < 7 THEN '⚠️ WAIT - Recent AnyTrack activity'
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 14 AND c.total_events > 3 THEN '⚠️ WAIT - Multiple touches, recent call'
    WHEN EXTRACT(EPOCH FROM (NOW() - c.first_touch_time)) / 86400 > 60 AND COALESCE(call_stats.days_since_last_call, 999) < 30 THEN '⚠️ LONG CYCLE - Still engaged, wait'
    ELSE '✅ Safe to evaluate for closure'
  END as closure_recommendation,
  
  -- Comparison metrics
  COALESCE(call_stats.total_calls, 0) as total_calls,
  COALESCE(appt_stats.total_appointments, 0) as total_appointments,
  COALESCE(appt_stats.completed_appointments, 0) as completed_appointments,
  CASE 
    WHEN COALESCE(appt_stats.total_appointments, 0) > 0 
    THEN ROUND((COALESCE(appt_stats.completed_appointments, 0)::numeric / appt_stats.total_appointments) * 100, 1)
    ELSE 0
  END as appointment_completion_rate,
  
  c.total_value,
  c.total_deal_value

FROM public.contacts c
LEFT JOIN (
  SELECT 
    c2.id as contact_id,
    MAX(cr.started_at) as last_call, 
    EXTRACT(EPOCH FROM (NOW() - MAX(cr.started_at))) / 86400 as days_since_last_call,
    COUNT(*) as total_calls
  FROM public.call_records cr
  LEFT JOIN public.contacts c2 ON c2.phone = cr.caller_number OR c2.email = (
    SELECT email FROM public.contacts WHERE phone = cr.caller_number LIMIT 1
  )
  WHERE c2.id IS NOT NULL
  GROUP BY c2.id
) call_stats ON call_stats.contact_id = c.id
LEFT JOIN (
  SELECT contact_id, MAX(start_time) as last_appointment,
    EXTRACT(EPOCH FROM (NOW() - MAX(start_time))) / 86400 as days_since_appointment,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
    MIN(CASE WHEN status = 'scheduled' AND start_time > NOW() THEN start_time END) as next_appointment
  FROM public.appointments
  GROUP BY contact_id
) appt_stats ON appt_stats.contact_id = c.id
LEFT JOIN (
  SELECT email, MAX(event_time) as last_event,
    EXTRACT(EPOCH FROM (NOW() - MAX(event_time))) / 86400 as days_since_event
  FROM public.attribution_events
  WHERE platform IN ('anytrack', 'hubspot_anytrack')
  GROUP BY email
) anytrack_stats ON anytrack_stats.email = c.email

WHERE c.lifecycle_stage NOT IN ('customer', 'closed_lost')
ORDER BY 
  CASE 
    WHEN COALESCE(call_stats.days_since_last_call, 999) < 3 THEN 1
    WHEN COALESCE(appt_stats.days_since_appointment, 999) < 7 THEN 2
    WHEN appt_stats.next_appointment IS NOT NULL THEN 3
    ELSE 4
  END,
  days_since_last_touch ASC;

COMMENT ON VIEW public.long_cycle_protection IS 'Protects against closing leads too early - shows warnings and recommendations';

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_records_caller_started ON public.call_records(caller_number, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_start ON public.appointments(contact_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_events_email_time ON public.attribution_events(email, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_updated ON public.contacts(lifecycle_stage, updated_at DESC);
