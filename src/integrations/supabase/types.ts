export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          action_recommended: string | null
          affected_client_count: number | null
          affected_clients: Json | null
          confidence_score: number | null
          created_at: string | null
          id: number
          insight_category: string | null
          insight_date: string
          insight_text: string | null
          insight_type: string
        }
        Insert: {
          action_recommended?: string | null
          affected_client_count?: number | null
          affected_clients?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          insight_category?: string | null
          insight_date: string
          insight_text?: string | null
          insight_type: string
        }
        Update: {
          action_recommended?: string | null
          affected_client_count?: number | null
          affected_clients?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          insight_category?: string | null
          insight_date?: string
          insight_text?: string | null
          insight_type?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          capi_base_url: string | null
          created_at: string | null
          id: string
          meta_access_token: string | null
          meta_pixel_id: string | null
          n8n_base_url: string | null
          supabase_anon_key: string | null
          supabase_url: string | null
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          test_event_code: string | null
          updated_at: string | null
        }
        Insert: {
          capi_base_url?: string | null
          created_at?: string | null
          id?: string
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          n8n_base_url?: string | null
          supabase_anon_key?: string | null
          supabase_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          test_event_code?: string | null
          updated_at?: string | null
        }
        Update: {
          capi_base_url?: string | null
          created_at?: string | null
          id?: string
          meta_access_token?: string | null
          meta_pixel_id?: string | null
          n8n_base_url?: string | null
          supabase_anon_key?: string | null
          supabase_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          test_event_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_type: string
          created_at: string | null
          error_message: string | null
          id: string
          mode: string | null
          payload: Json | null
          response_data: Json | null
          status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          mode?: string | null
          payload?: Json | null
          response_data?: Json | null
          status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          mode?: string | null
          payload?: Json | null
          response_data?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      batch_config: {
        Row: {
          batch_size: number | null
          batch_time: string
          config_name: string
          created_at: string | null
          days_of_week: number[] | null
          enabled: boolean | null
          id: string
          last_run: string | null
          mode: string | null
          next_run: string | null
          notes: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          batch_size?: number | null
          batch_time: string
          config_name: string
          created_at?: string | null
          days_of_week?: number[] | null
          enabled?: boolean | null
          id?: string
          last_run?: string | null
          mode?: string | null
          next_run?: string | null
          notes?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_size?: number | null
          batch_time?: string
          config_name?: string
          created_at?: string | null
          days_of_week?: number[] | null
          enabled?: boolean | null
          id?: string
          last_run?: string | null
          mode?: string | null
          next_run?: string | null
          notes?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      batch_jobs: {
        Row: {
          batch_name: string
          completed_at: string | null
          created_at: string | null
          error_log: Json | null
          events_count: number | null
          events_failed: number | null
          events_sent: number | null
          execution_time: string | null
          id: string
          mode: string | null
          notes: string | null
          scheduled_time: string
          status: string | null
        }
        Insert: {
          batch_name: string
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          events_count?: number | null
          events_failed?: number | null
          events_sent?: number | null
          execution_time?: string | null
          id?: string
          mode?: string | null
          notes?: string | null
          scheduled_time: string
          status?: string | null
        }
        Update: {
          batch_name?: string
          completed_at?: string | null
          created_at?: string | null
          error_log?: Json | null
          events_count?: number | null
          events_failed?: number | null
          events_sent?: number | null
          execution_time?: string | null
          id?: string
          mode?: string | null
          notes?: string | null
          scheduled_time?: string
          status?: string | null
        }
        Relationships: []
      }
      capi_events: {
        Row: {
          created_at: string | null
          currency: string | null
          email: string | null
          event_id: string | null
          event_name: string
          event_time: string | null
          external_id: string | null
          fbc: string | null
          fbp: string | null
          id: string
          inserted_at: string | null
          mode: string | null
          phone: string | null
          raw: Json | null
          response_data: Json | null
          status: string | null
          test_event_code: string | null
          user_email: string | null
          user_phone: string | null
          value_aed: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          email?: string | null
          event_id?: string | null
          event_name: string
          event_time?: string | null
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          id?: string
          inserted_at?: string | null
          mode?: string | null
          phone?: string | null
          raw?: Json | null
          response_data?: Json | null
          status?: string | null
          test_event_code?: string | null
          user_email?: string | null
          user_phone?: string | null
          value_aed?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          email?: string | null
          event_id?: string | null
          event_name?: string
          event_time?: string | null
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          id?: string
          inserted_at?: string | null
          mode?: string | null
          phone?: string | null
          raw?: Json | null
          response_data?: Json | null
          status?: string | null
          test_event_code?: string | null
          user_email?: string | null
          user_phone?: string | null
          value_aed?: number | null
        }
        Relationships: []
      }
      capi_events_enriched: {
        Row: {
          action_source: string | null
          batch_id: string | null
          batch_scheduled_for: string | null
          city: string | null
          content_category: string | null
          content_ids: string[] | null
          content_name: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          event_id: string
          event_name: string
          event_source_url: string | null
          event_time: string
          external_id: string | null
          fbc: string | null
          fbp: string | null
          first_name: string | null
          hubspot_contact_id: string | null
          hubspot_deal_id: string | null
          id: string
          last_name: string | null
          lead_source: string | null
          lifecycle_stage: string | null
          meta_event_id: string | null
          meta_response: Json | null
          mode: string | null
          num_items: number | null
          original_source: string | null
          payment_method: string | null
          phone: string | null
          raw_payload: Json | null
          send_attempts: number | null
          send_status: string | null
          sent_at: string | null
          state: string | null
          stripe_charge_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          updated_at: string | null
          value: number | null
          zip_code: string | null
        }
        Insert: {
          action_source?: string | null
          batch_id?: string | null
          batch_scheduled_for?: string | null
          city?: string | null
          content_category?: string | null
          content_ids?: string[] | null
          content_name?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          event_id: string
          event_name: string
          event_source_url?: string | null
          event_time: string
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          first_name?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lifecycle_stage?: string | null
          meta_event_id?: string | null
          meta_response?: Json | null
          mode?: string | null
          num_items?: number | null
          original_source?: string | null
          payment_method?: string | null
          phone?: string | null
          raw_payload?: Json | null
          send_attempts?: number | null
          send_status?: string | null
          sent_at?: string | null
          state?: string | null
          stripe_charge_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          value?: number | null
          zip_code?: string | null
        }
        Update: {
          action_source?: string | null
          batch_id?: string | null
          batch_scheduled_for?: string | null
          city?: string | null
          content_category?: string | null
          content_ids?: string[] | null
          content_name?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          event_id?: string
          event_name?: string
          event_source_url?: string | null
          event_time?: string
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          first_name?: string | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          last_name?: string | null
          lead_source?: string | null
          lifecycle_stage?: string | null
          meta_event_id?: string | null
          meta_response?: Json | null
          mode?: string | null
          num_items?: number | null
          original_source?: string | null
          payment_method?: string | null
          phone?: string | null
          raw_payload?: Json | null
          send_attempts?: number | null
          send_status?: string | null
          sent_at?: string | null
          state?: string | null
          stripe_charge_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          value?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      churn_patterns: {
        Row: {
          avg_health_score_drop: number | null
          avg_risk_score_increase: number | null
          avg_session_frequency_drop: number | null
          common_behaviors: Json | null
          confidence_score: number | null
          days_before_churn: number
          id: number
          last_updated: string | null
          pattern_name: string
          sample_size: number | null
        }
        Insert: {
          avg_health_score_drop?: number | null
          avg_risk_score_increase?: number | null
          avg_session_frequency_drop?: number | null
          common_behaviors?: Json | null
          confidence_score?: number | null
          days_before_churn: number
          id?: number
          last_updated?: string | null
          pattern_name: string
          sample_size?: number | null
        }
        Update: {
          avg_health_score_drop?: number | null
          avg_risk_score_increase?: number | null
          avg_session_frequency_drop?: number | null
          common_behaviors?: Json | null
          confidence_score?: number | null
          days_before_churn?: number
          id?: number
          last_updated?: string | null
          pattern_name?: string
          sample_size?: number | null
        }
        Relationships: []
      }
      client_health_scores: {
        Row: {
          assigned_coach: string | null
          calculated_at: string | null
          calculated_on: string | null
          calculation_version: string | null
          churn_risk_score: number | null
          client_segment: string | null
          created_at: string | null
          days_since_last_session: number | null
          days_until_renewal: number | null
          early_warning_flag: boolean | null
          email: string
          engagement_score: number | null
          financial_score: number | null
          firstname: string | null
          health_score: number | null
          health_trend: string | null
          health_zone: string | null
          hubspot_contact_id: string | null
          id: number
          intervention_priority: string | null
          lastname: string | null
          momentum_indicator: string | null
          momentum_score: number | null
          outstanding_sessions: number | null
          package_health_score: number | null
          package_type: string | null
          package_value_aed: number | null
          predictive_risk_score: number | null
          rate_of_change_percent: number | null
          relationship_score: number | null
          risk_category: string | null
          risk_factors: Json | null
          sessions_last_30d: number | null
          sessions_last_7d: number | null
          sessions_last_90d: number | null
          sessions_purchased: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_coach?: string | null
          calculated_at?: string | null
          calculated_on?: string | null
          calculation_version?: string | null
          churn_risk_score?: number | null
          client_segment?: string | null
          created_at?: string | null
          days_since_last_session?: number | null
          days_until_renewal?: number | null
          early_warning_flag?: boolean | null
          email: string
          engagement_score?: number | null
          financial_score?: number | null
          firstname?: string | null
          health_score?: number | null
          health_trend?: string | null
          health_zone?: string | null
          hubspot_contact_id?: string | null
          id?: number
          intervention_priority?: string | null
          lastname?: string | null
          momentum_indicator?: string | null
          momentum_score?: number | null
          outstanding_sessions?: number | null
          package_health_score?: number | null
          package_type?: string | null
          package_value_aed?: number | null
          predictive_risk_score?: number | null
          rate_of_change_percent?: number | null
          relationship_score?: number | null
          risk_category?: string | null
          risk_factors?: Json | null
          sessions_last_30d?: number | null
          sessions_last_7d?: number | null
          sessions_last_90d?: number | null
          sessions_purchased?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_coach?: string | null
          calculated_at?: string | null
          calculated_on?: string | null
          calculation_version?: string | null
          churn_risk_score?: number | null
          client_segment?: string | null
          created_at?: string | null
          days_since_last_session?: number | null
          days_until_renewal?: number | null
          early_warning_flag?: boolean | null
          email?: string
          engagement_score?: number | null
          financial_score?: number | null
          firstname?: string | null
          health_score?: number | null
          health_trend?: string | null
          health_zone?: string | null
          hubspot_contact_id?: string | null
          id?: number
          intervention_priority?: string | null
          lastname?: string | null
          momentum_indicator?: string | null
          momentum_score?: number | null
          outstanding_sessions?: number | null
          package_health_score?: number | null
          package_type?: string | null
          package_value_aed?: number | null
          predictive_risk_score?: number | null
          rate_of_change_percent?: number | null
          relationship_score?: number | null
          risk_category?: string | null
          risk_factors?: Json | null
          sessions_last_30d?: number | null
          sessions_last_7d?: number | null
          sessions_last_90d?: number | null
          sessions_purchased?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_lifecycle_history: {
        Row: {
          created_at: string | null
          email: string
          engagement_trend: string | null
          health_score: number | null
          health_zone: string | null
          id: number
          predictive_risk_score: number | null
          sessions_previous_week: number | null
          sessions_this_week: number | null
          week_ending_date: string
          week_over_week_change: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          engagement_trend?: string | null
          health_score?: number | null
          health_zone?: string | null
          id?: number
          predictive_risk_score?: number | null
          sessions_previous_week?: number | null
          sessions_this_week?: number | null
          week_ending_date: string
          week_over_week_change?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          engagement_trend?: string | null
          health_score?: number | null
          health_zone?: string | null
          id?: number
          predictive_risk_score?: number | null
          sessions_previous_week?: number | null
          sessions_this_week?: number | null
          week_ending_date?: string
          week_over_week_change?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      coach_performance: {
        Row: {
          active_clients: number | null
          at_risk_revenue_aed: number | null
          avg_client_health: number | null
          avg_health_change_7d: number | null
          avg_sessions_per_client: number | null
          churn_risk_30d: number | null
          clients_at_risk: number | null
          clients_declining: number | null
          clients_green: number | null
          clients_improving: number | null
          clients_purple: number | null
          clients_red: number | null
          clients_yellow: number | null
          coach_name: string
          coach_rank: number | null
          created_at: string | null
          critical_interventions: number | null
          declining_clients: number | null
          health_score_stdev: number | null
          health_trend: string | null
          highest_health_client: string | null
          id: number
          improving_clients: number | null
          intervention_success_rate: number | null
          lowest_health_client: string | null
          median_client_health: number | null
          performance_score: number | null
          red_flags: Json | null
          report_date: string
          strengths: string | null
          total_clients: number | null
          weaknesses: string | null
        }
        Insert: {
          active_clients?: number | null
          at_risk_revenue_aed?: number | null
          avg_client_health?: number | null
          avg_health_change_7d?: number | null
          avg_sessions_per_client?: number | null
          churn_risk_30d?: number | null
          clients_at_risk?: number | null
          clients_declining?: number | null
          clients_green?: number | null
          clients_improving?: number | null
          clients_purple?: number | null
          clients_red?: number | null
          clients_yellow?: number | null
          coach_name: string
          coach_rank?: number | null
          created_at?: string | null
          critical_interventions?: number | null
          declining_clients?: number | null
          health_score_stdev?: number | null
          health_trend?: string | null
          highest_health_client?: string | null
          id?: number
          improving_clients?: number | null
          intervention_success_rate?: number | null
          lowest_health_client?: string | null
          median_client_health?: number | null
          performance_score?: number | null
          red_flags?: Json | null
          report_date: string
          strengths?: string | null
          total_clients?: number | null
          weaknesses?: string | null
        }
        Update: {
          active_clients?: number | null
          at_risk_revenue_aed?: number | null
          avg_client_health?: number | null
          avg_health_change_7d?: number | null
          avg_sessions_per_client?: number | null
          churn_risk_30d?: number | null
          clients_at_risk?: number | null
          clients_declining?: number | null
          clients_green?: number | null
          clients_improving?: number | null
          clients_purple?: number | null
          clients_red?: number | null
          clients_yellow?: number | null
          coach_name?: string
          coach_rank?: number | null
          created_at?: string | null
          critical_interventions?: number | null
          declining_clients?: number | null
          health_score_stdev?: number | null
          health_trend?: string | null
          highest_health_client?: string | null
          id?: number
          improving_clients?: number | null
          intervention_success_rate?: number | null
          lowest_health_client?: string | null
          median_client_health?: number | null
          performance_score?: number | null
          red_flags?: Json | null
          report_date?: string
          strengths?: string | null
          total_clients?: number | null
          weaknesses?: string | null
        }
        Relationships: []
      }
      coach_reviews: {
        Row: {
          coach: string
          created_at: string | null
          id: number
          period_month: number
          period_year: number
          summary: Json | null
        }
        Insert: {
          coach: string
          created_at?: string | null
          id?: number
          period_month: number
          period_year: number
          summary?: Json | null
        }
        Update: {
          coach?: string
          created_at?: string | null
          id?: number
          period_month?: number
          period_year?: number
          summary?: Json | null
        }
        Relationships: []
      }
      daily_summary: {
        Row: {
          at_risk_revenue_aed: number | null
          avg_health_score: number | null
          clients_green: number | null
          clients_purple: number | null
          clients_red: number | null
          clients_yellow: number | null
          created_at: string | null
          critical_interventions: number | null
          generated_at: string | null
          green_count: number | null
          id: number
          interventions_recommended: number | null
          new_risks_identified: number | null
          patterns_detected: Json | null
          purple_count: number | null
          red_count: number | null
          summary_date: string
          top_risks: Json | null
          total_at_risk: number | null
          total_clients: number | null
          yellow_count: number | null
          zone_changes_24h: Json | null
        }
        Insert: {
          at_risk_revenue_aed?: number | null
          avg_health_score?: number | null
          clients_green?: number | null
          clients_purple?: number | null
          clients_red?: number | null
          clients_yellow?: number | null
          created_at?: string | null
          critical_interventions?: number | null
          generated_at?: string | null
          green_count?: number | null
          id?: number
          interventions_recommended?: number | null
          new_risks_identified?: number | null
          patterns_detected?: Json | null
          purple_count?: number | null
          red_count?: number | null
          summary_date: string
          top_risks?: Json | null
          total_at_risk?: number | null
          total_clients?: number | null
          yellow_count?: number | null
          zone_changes_24h?: Json | null
        }
        Update: {
          at_risk_revenue_aed?: number | null
          avg_health_score?: number | null
          clients_green?: number | null
          clients_purple?: number | null
          clients_red?: number | null
          clients_yellow?: number | null
          created_at?: string | null
          critical_interventions?: number | null
          generated_at?: string | null
          green_count?: number | null
          id?: number
          interventions_recommended?: number | null
          new_risks_identified?: number | null
          patterns_detected?: Json | null
          purple_count?: number | null
          red_count?: number | null
          summary_date?: string
          top_risks?: Json | null
          total_at_risk?: number | null
          total_clients?: number | null
          yellow_count?: number | null
          zone_changes_24h?: Json | null
        }
        Relationships: []
      }
      event_mappings: {
        Row: {
          created_at: string | null
          event_parameters: Json | null
          hubspot_event_name: string
          id: string
          is_active: boolean | null
          meta_event_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_parameters?: Json | null
          hubspot_event_name: string
          id?: string
          is_active?: boolean | null
          meta_event_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_parameters?: Json | null
          hubspot_event_name?: string
          id?: string
          is_active?: boolean | null
          meta_event_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          as_of: string
          client_id: string
          details: Json | null
          health_score: number
          id: number
          improving: boolean | null
          inserted_at: string | null
          risk_score: number | null
          zone: string | null
        }
        Insert: {
          as_of: string
          client_id: string
          details?: Json | null
          health_score: number
          id?: number
          improving?: boolean | null
          inserted_at?: string | null
          risk_score?: number | null
          zone?: string | null
        }
        Update: {
          as_of?: string
          client_id?: string
          details?: Json | null
          health_score?: number
          id?: number
          improving?: boolean | null
          inserted_at?: string | null
          risk_score?: number | null
          zone?: string | null
        }
        Relationships: []
      }
      intervention_log: {
        Row: {
          actioned_at: string | null
          ai_confidence: number | null
          ai_insight: string | null
          ai_reasoning: string | null
          ai_recommendation: string | null
          assigned_to: string | null
          churn_risk_at_trigger: number | null
          client_email: string
          client_persona: string | null
          communication_method: string | null
          communication_timing: string | null
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          email: string
          executed_by: string | null
          firstname: string | null
          follow_up_date: string | null
          health_score: number | null
          health_score_after: number | null
          health_score_at_trigger: number | null
          health_score_before: number | null
          health_trend: string | null
          health_zone: string | null
          health_zone_after: string | null
          health_zone_at_trigger: string | null
          hubspot_contact_id: string | null
          id: number
          intervention_date: string | null
          intervention_effectiveness_score: number | null
          intervention_type: string
          lastname: string | null
          message_tone: string | null
          notes: string | null
          outcome: string | null
          outcome_measured_at: string | null
          owner_notes: string | null
          priority: string | null
          psychological_insight: string | null
          recommended_action: string | null
          recommended_by: string | null
          revenue_protected_aed: number | null
          root_cause: string | null
          sessions_recovered: number | null
          status: string | null
          success_probability: number | null
          trigger_reason: string | null
          triggered_at: string | null
        }
        Insert: {
          actioned_at?: string | null
          ai_confidence?: number | null
          ai_insight?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          assigned_to?: string | null
          churn_risk_at_trigger?: number | null
          client_email: string
          client_persona?: string | null
          communication_method?: string | null
          communication_timing?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          email: string
          executed_by?: string | null
          firstname?: string | null
          follow_up_date?: string | null
          health_score?: number | null
          health_score_after?: number | null
          health_score_at_trigger?: number | null
          health_score_before?: number | null
          health_trend?: string | null
          health_zone?: string | null
          health_zone_after?: string | null
          health_zone_at_trigger?: string | null
          hubspot_contact_id?: string | null
          id?: number
          intervention_date?: string | null
          intervention_effectiveness_score?: number | null
          intervention_type: string
          lastname?: string | null
          message_tone?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_measured_at?: string | null
          owner_notes?: string | null
          priority?: string | null
          psychological_insight?: string | null
          recommended_action?: string | null
          recommended_by?: string | null
          revenue_protected_aed?: number | null
          root_cause?: string | null
          sessions_recovered?: number | null
          status?: string | null
          success_probability?: number | null
          trigger_reason?: string | null
          triggered_at?: string | null
        }
        Update: {
          actioned_at?: string | null
          ai_confidence?: number | null
          ai_insight?: string | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          assigned_to?: string | null
          churn_risk_at_trigger?: number | null
          client_email?: string
          client_persona?: string | null
          communication_method?: string | null
          communication_timing?: string | null
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          email?: string
          executed_by?: string | null
          firstname?: string | null
          follow_up_date?: string | null
          health_score?: number | null
          health_score_after?: number | null
          health_score_at_trigger?: number | null
          health_score_before?: number | null
          health_trend?: string | null
          health_zone?: string | null
          health_zone_after?: string | null
          health_zone_at_trigger?: string | null
          hubspot_contact_id?: string | null
          id?: number
          intervention_date?: string | null
          intervention_effectiveness_score?: number | null
          intervention_type?: string
          lastname?: string | null
          message_tone?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_measured_at?: string | null
          owner_notes?: string | null
          priority?: string | null
          psychological_insight?: string | null
          recommended_action?: string | null
          recommended_by?: string | null
          revenue_protected_aed?: number | null
          root_cause?: string | null
          sessions_recovered?: number | null
          status?: string | null
          success_probability?: number | null
          trigger_reason?: string | null
          triggered_at?: string | null
        }
        Relationships: []
      }
      intervention_outcomes: {
        Row: {
          client_email: string
          client_persona: string | null
          created_at: string | null
          executed_at: string | null
          health_score_30d_after: number | null
          health_score_7d_after: number | null
          health_score_before: number | null
          health_zone_at_intervention: string | null
          id: number
          intervention_id: number | null
          intervention_type: string | null
          outcome_success_score: number | null
          risk_score_30d_after: number | null
          risk_score_7d_after: number | null
          risk_score_at_intervention: number | null
          risk_score_before: number | null
          sessions_booked_within_7d: number | null
          trend_changed_to_positive: boolean | null
        }
        Insert: {
          client_email: string
          client_persona?: string | null
          created_at?: string | null
          executed_at?: string | null
          health_score_30d_after?: number | null
          health_score_7d_after?: number | null
          health_score_before?: number | null
          health_zone_at_intervention?: string | null
          id?: number
          intervention_id?: number | null
          intervention_type?: string | null
          outcome_success_score?: number | null
          risk_score_30d_after?: number | null
          risk_score_7d_after?: number | null
          risk_score_at_intervention?: number | null
          risk_score_before?: number | null
          sessions_booked_within_7d?: number | null
          trend_changed_to_positive?: boolean | null
        }
        Update: {
          client_email?: string
          client_persona?: string | null
          created_at?: string | null
          executed_at?: string | null
          health_score_30d_after?: number | null
          health_score_7d_after?: number | null
          health_score_before?: number | null
          health_zone_at_intervention?: string | null
          id?: number
          intervention_id?: number | null
          intervention_type?: string | null
          outcome_success_score?: number | null
          risk_score_30d_after?: number | null
          risk_score_7d_after?: number | null
          risk_score_at_intervention?: number | null
          risk_score_before?: number | null
          sessions_booked_within_7d?: number | null
          trend_changed_to_positive?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_outcomes_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "intervention_log"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_patterns: {
        Row: {
          avg_health_score: number | null
          clients_declining: number | null
          clients_improving: number | null
          created_at: string | null
          green_clients: number | null
          id: number
          pattern_insights: string | null
          purple_clients: number | null
          red_clients: number | null
          total_clients: number | null
          updated_at: string | null
          week_end_date: string
          week_start_date: string
          yellow_clients: number | null
        }
        Insert: {
          avg_health_score?: number | null
          clients_declining?: number | null
          clients_improving?: number | null
          created_at?: string | null
          green_clients?: number | null
          id?: number
          pattern_insights?: string | null
          purple_clients?: number | null
          red_clients?: number | null
          total_clients?: number | null
          updated_at?: string | null
          week_end_date: string
          week_start_date: string
          yellow_clients?: number | null
        }
        Update: {
          avg_health_score?: number | null
          clients_declining?: number | null
          clients_improving?: number | null
          created_at?: string | null
          green_clients?: number | null
          id?: number
          pattern_insights?: string | null
          purple_clients?: number | null
          red_clients?: number | null
          total_clients?: number | null
          updated_at?: string | null
          week_end_date?: string
          week_start_date?: string
          yellow_clients?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      company_health_aggregates: {
        Row: {
          clients_declining: number | null
          clients_improving: number | null
          company_avg_score: number | null
          green_count: number | null
          health_score_stdev: number | null
          median_health_score: number | null
          purple_count: number | null
          red_count: number | null
          red_pct: number | null
          yellow_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_daily_health_scores: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_at_risk_clients: {
        Args: { target_date: string }
        Returns: {
          assigned_coach: string
          churn_risk_score: number
          client_name: string
          days_since_last_session: number
          email: string
          health_score: number
          health_zone: string
          id: number
        }[]
      }
      get_overall_avg: {
        Args: { target_date: string }
        Returns: {
          avg_score: number
        }[]
      }
      get_zone_distribution: {
        Args: { target_date: string }
        Returns: {
          count: number
          health_zone: string
        }[]
      }
      monthly_coach_review: {
        Args: { p_coach: string }
        Returns: Json
      }
      upsert_capi_event: {
        Args: { p_event: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
