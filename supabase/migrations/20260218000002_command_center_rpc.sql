-- Batch RPC for CommandCenter: replaces ~12 individual queries with 1 call
CREATE OR REPLACE FUNCTION public.get_command_center_data(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_days || ' days')::interval;
  v_cutoff_date date := (now() - (p_days || ' days')::interval)::date;
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    -- A1: Ad Spend
    'ad_spend', (
      SELECT coalesce(sum(spend::numeric), 0)
      FROM facebook_ads_insights
      WHERE date >= v_cutoff_date
    ),
    -- A2: Leads count
    'leads_count', (
      SELECT count(*)
      FROM contacts
      WHERE created_at >= v_cutoff
    ),
    -- A3: Deal stats (bookings, closed_won, revenue)
    'deal_stats', (
      SELECT jsonb_build_object(
        'bookings', count(*) FILTER (WHERE stage IN (
          '71498498','71498499','71498500','71498501','71498502',
          '71498503','appointmentscheduled','qualifiedtobuy',
          'decisionmakerboughtin','contractsent','closedwon'
        )),
        'closed_won', count(*) FILTER (WHERE stage = 'closedwon'),
        'revenue', coalesce(sum(
          CASE WHEN stage = 'closedwon' THEN coalesce(deal_value::numeric, amount::numeric, 0) ELSE 0 END
        ), 0)
      )
      FROM deals
      WHERE updated_at >= v_cutoff
    ),
    -- B: Campaign Full Funnel
    'campaign_funnel', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.spend DESC), '[]'::jsonb)
      FROM campaign_full_funnel t
    ),
    -- C1: Setter Funnel
    'setter_funnel', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM setter_funnel_matrix t
    ),
    -- C2: Coach Performance (latest per coach)
    'coach_performance', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (coach_name)
          id, coach_name, total_clients,
          avg_client_health as avg_health_score,
          clients_improving, clients_declining,
          health_trend as trend, report_date
        FROM coach_performance
        ORDER BY coach_name, report_date DESC
      ) t
    ),
    -- D1: No-Shows
    'no_shows', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT concat_ws(' ', first_name, last_name) as contact_name,
               deal_name, email, assigned_coach as coach,
               assigned_coach, deal_stage as stage_label,
               deal_stage as stage, truth_category as truth_status
        FROM assessment_truth_matrix
        WHERE truth_category IN ('BOOKED_NOT_ATTENDED', 'HUBSPOT_ONLY_NO_AWS_PROOF', 'NO_SHOW')
        LIMIT 25
      ) t
    ),
    -- D2: Cold Leads
    'cold_leads', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT * FROM cold_leads LIMIT 25
      ) t
    ),
    -- D3: Churn Risk
    'churn_risk', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT email, firstname, lastname, health_score, health_zone,
               health_trend, churn_risk_score, outstanding_sessions
        FROM client_health_scores
        WHERE health_trend IN ('DECLINING', 'CLIFF_FALL')
        ORDER BY churn_risk_score DESC
        LIMIT 20
      ) t
    ),
    -- E: Upcoming Assessments
    'upcoming_assessments', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
      FROM (
        SELECT * FROM upcoming_assessments LIMIT 25
      ) t
    ),
    -- F: Adset Full Funnel
    'adset_funnel', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.spend DESC), '[]'::jsonb)
      FROM adset_full_funnel t
    ),
    -- G: Creative Funnel
    'creative_funnel', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.spend DESC), '[]'::jsonb)
      FROM ad_creative_funnel t
    )
  ) INTO result;

  RETURN result;
END;
$$;
