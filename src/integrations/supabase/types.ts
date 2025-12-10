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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      agent_context: {
        Row: {
          agent_type: string | null
          created_at: string | null
          expires_at: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          agent_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          agent_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: []
      }
      ai_feedback_learning: {
        Row: {
          applied_at: string | null
          applied_to_model: boolean | null
          context_data: Json | null
          corrected_recommendation: string | null
          created_at: string | null
          created_by: string | null
          feedback_notes: string | null
          feedback_score: number | null
          feedback_type: string
          id: string
          insight_id: string | null
          insight_type: string | null
          intervention_id: number | null
          original_recommendation: string | null
          user_correction: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_to_model?: boolean | null
          context_data?: Json | null
          corrected_recommendation?: string | null
          created_at?: string | null
          created_by?: string | null
          feedback_notes?: string | null
          feedback_score?: number | null
          feedback_type: string
          id?: string
          insight_id?: string | null
          insight_type?: string | null
          intervention_id?: number | null
          original_recommendation?: string | null
          user_correction?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_to_model?: boolean | null
          context_data?: Json | null
          corrected_recommendation?: string | null
          created_at?: string | null
          created_by?: string | null
          feedback_notes?: string | null
          feedback_score?: number | null
          feedback_type?: string
          id?: string
          insight_id?: string | null
          insight_type?: string | null
          intervention_id?: number | null
          original_recommendation?: string | null
          user_correction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_learning_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "proactive_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_learning_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "intervention_log"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_learning_rules: {
        Row: {
          action_pattern: Json
          condition_pattern: Json
          confidence_score: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          rule_type: string
          source: string | null
          success_count: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          action_pattern: Json
          condition_pattern: Json
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          rule_type: string
          source?: string | null
          success_count?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          action_pattern?: Json
          condition_pattern?: Json
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          rule_type?: string
          source?: string | null
          success_count?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          ip_address: unknown
          page_url: string | null
          properties: Json | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          user_properties: Json | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          ip_address?: unknown
          page_url?: string | null
          properties?: Json | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_properties?: Json | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          ip_address?: unknown
          page_url?: string | null
          properties?: Json | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_properties?: Json | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          scheduled_at: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      attribution_events: {
        Row: {
          attribution_model: string | null
          attribution_weight: number | null
          browser: string | null
          campaign: string | null
          city: string | null
          contact_id: string | null
          created_at: string | null
          currency: string | null
          device_type: string | null
          email: string | null
          event_id: string
          event_name: string
          event_time: string | null
          first_name: string | null
          id: string
          ip_address: unknown
          journey_id: string | null
          landing_page: string | null
          last_name: string | null
          medium: string | null
          os: string | null
          owner_id: string | null
          phone: string | null
          pipeline_stage: string | null
          platform: string | null
          referrer: string | null
          session_id: string | null
          source: string | null
          touchpoint_sequence: number | null
          updated_at: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
        }
        Insert: {
          attribution_model?: string | null
          attribution_weight?: number | null
          browser?: string | null
          campaign?: string | null
          city?: string | null
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          device_type?: string | null
          email?: string | null
          event_id: string
          event_name: string
          event_time?: string | null
          first_name?: string | null
          id?: string
          ip_address?: unknown
          journey_id?: string | null
          landing_page?: string | null
          last_name?: string | null
          medium?: string | null
          os?: string | null
          owner_id?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          platform?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          touchpoint_sequence?: number | null
          updated_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
        }
        Update: {
          attribution_model?: string | null
          attribution_weight?: number | null
          browser?: string | null
          campaign?: string | null
          city?: string | null
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          device_type?: string | null
          email?: string | null
          event_id?: string
          event_name?: string
          event_time?: string | null
          first_name?: string | null
          id?: string
          ip_address?: unknown
          journey_id?: string | null
          landing_page?: string | null
          last_name?: string | null
          medium?: string | null
          os?: string | null
          owner_id?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          platform?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          touchpoint_sequence?: number | null
          updated_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
        }
        Relationships: []
      }
      attribution_models: {
        Row: {
          configuration: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audience_definitions: {
        Row: {
          auto_refresh: boolean | null
          created_at: string | null
          criteria: Json
          description: string | null
          id: string
          last_synced: string | null
          name: string
          platform: string
          platform_audience_id: string | null
          refresh_frequency: string | null
          size_estimate: number | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          auto_refresh?: boolean | null
          created_at?: string | null
          criteria: Json
          description?: string | null
          id?: string
          last_synced?: string | null
          name: string
          platform: string
          platform_audience_id?: string | null
          refresh_frequency?: string | null
          size_estimate?: number | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_refresh?: boolean | null
          created_at?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          last_synced?: string | null
          name?: string
          platform?: string
          platform_audience_id?: string | null
          refresh_frequency?: string | null
          size_estimate?: number | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      business_forecasts: {
        Row: {
          actual_value: number | null
          confidence_level: number | null
          created_at: string
          forecast_type: string
          id: string
          model_used: string
          period_month: number
          period_year: number
          predicted_value: number
        }
        Insert: {
          actual_value?: number | null
          confidence_level?: number | null
          created_at?: string
          forecast_type: string
          id?: string
          model_used?: string
          period_month: number
          period_year: number
          predicted_value: number
        }
        Update: {
          actual_value?: number | null
          confidence_level?: number | null
          created_at?: string
          forecast_type?: string
          id?: string
          model_used?: string
          period_month?: number
          period_year?: number
          predicted_value?: number
        }
        Relationships: []
      }
      business_reports: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          generated_at: string
          id: string
          report_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          generated_at?: string
          id?: string
          report_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          generated_at?: string
          id?: string
          report_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_category: string
          rule_config: Json
          rule_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_category: string
          rule_config: Json
          rule_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_category?: string
          rule_config?: Json
          rule_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      call_analytics: {
        Row: {
          answered_calls: number | null
          avg_call_duration: number | null
          campaign: string | null
          conversion_rate: number | null
          cost_per_call: number | null
          created_at: string | null
          date: string
          id: string
          missed_calls: number | null
          revenue_generated: number | null
          source: string | null
          total_calls: number | null
          total_duration_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          answered_calls?: number | null
          avg_call_duration?: number | null
          campaign?: string | null
          conversion_rate?: number | null
          cost_per_call?: number | null
          created_at?: string | null
          date: string
          id?: string
          missed_calls?: number | null
          revenue_generated?: number | null
          source?: string | null
          total_calls?: number | null
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          answered_calls?: number | null
          avg_call_duration?: number | null
          campaign?: string | null
          conversion_rate?: number | null
          cost_per_call?: number | null
          created_at?: string | null
          date?: string
          id?: string
          missed_calls?: number | null
          revenue_generated?: number | null
          source?: string | null
          total_calls?: number | null
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      call_integrations: {
        Row: {
          api_credentials: Json | null
          configuration: Json
          created_at: string | null
          id: string
          integration_name: string
          integration_type: string
          last_sync_at: string | null
          secret_ref: string | null
          status: string
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_credentials?: Json | null
          configuration?: Json
          created_at?: string | null
          id?: string
          integration_name: string
          integration_type: string
          last_sync_at?: string | null
          secret_ref?: string | null
          status?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_credentials?: Json | null
          configuration?: Json
          created_at?: string | null
          id?: string
          integration_name?: string
          integration_type?: string
          last_sync_at?: string | null
          secret_ref?: string | null
          status?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      call_records: {
        Row: {
          appointment_set: boolean | null
          call_direction: string | null
          call_outcome: string | null
          call_score: number | null
          call_status: string
          caller_city: string | null
          caller_country: string | null
          caller_number: string
          caller_state: string | null
          conversion_outcome: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          forwarded_from: string | null
          id: string
          keywords_mentioned: string[] | null
          lead_quality: string | null
          provider_call_id: string | null
          recording_url: string | null
          revenue_generated: number | null
          sentiment_score: number | null
          started_at: string | null
          tracking_number_id: string | null
          transcription: string | null
          transcription_confidence: number | null
          updated_at: string | null
        }
        Insert: {
          appointment_set?: boolean | null
          call_direction?: string | null
          call_outcome?: string | null
          call_score?: number | null
          call_status?: string
          caller_city?: string | null
          caller_country?: string | null
          caller_number: string
          caller_state?: string | null
          conversion_outcome?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          forwarded_from?: string | null
          id?: string
          keywords_mentioned?: string[] | null
          lead_quality?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          revenue_generated?: number | null
          sentiment_score?: number | null
          started_at?: string | null
          tracking_number_id?: string | null
          transcription?: string | null
          transcription_confidence?: number | null
          updated_at?: string | null
        }
        Update: {
          appointment_set?: boolean | null
          call_direction?: string | null
          call_outcome?: string | null
          call_score?: number | null
          call_status?: string
          caller_city?: string | null
          caller_country?: string | null
          caller_number?: string
          caller_state?: string | null
          conversion_outcome?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          forwarded_from?: string | null
          id?: string
          keywords_mentioned?: string[] | null
          lead_quality?: string | null
          provider_call_id?: string | null
          recording_url?: string | null
          revenue_generated?: number | null
          sentiment_score?: number | null
          started_at?: string | null
          tracking_number_id?: string | null
          transcription?: string | null
          transcription_confidence?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_records_tracking_number_id_fkey"
            columns: ["tracking_number_id"]
            isOneToOne: false
            referencedRelation: "call_tracking_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_tracking_numbers: {
        Row: {
          assigned_at: string | null
          campaign: string | null
          created_at: string | null
          formatted_number: string
          forward_to: string
          id: string
          medium: string | null
          phone_number: string
          provider: string
          source: string | null
          status: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          assigned_at?: string | null
          campaign?: string | null
          created_at?: string | null
          formatted_number: string
          forward_to: string
          id?: string
          medium?: string | null
          phone_number: string
          provider?: string
          source?: string | null
          status?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          assigned_at?: string | null
          campaign?: string | null
          created_at?: string | null
          formatted_number?: string
          forward_to?: string
          id?: string
          medium?: string | null
          phone_number?: string
          provider?: string
          source?: string | null
          status?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      call_transcription_jobs: {
        Row: {
          call_record_id: string | null
          confidence_score: number | null
          created_at: string | null
          error_message: string | null
          id: string
          processing_completed_at: string | null
          processing_started_at: string | null
          recording_url: string
          status: string
          transcription_result: string | null
          updated_at: string | null
        }
        Insert: {
          call_record_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          recording_url: string
          status?: string
          transcription_result?: string | null
          updated_at?: string | null
        }
        Update: {
          call_record_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processing_completed_at?: string | null
          processing_started_at?: string | null
          recording_url?: string
          status?: string
          transcription_result?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transcription_jobs_call_record_id_fkey"
            columns: ["call_record_id"]
            isOneToOne: false
            referencedRelation: "call_records"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_performance: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          leads: number | null
          platform: string
          revenue: number | null
          roas: number | null
          spend: number | null
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          leads?: number | null
          platform: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          platform?: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
        }
        Relationships: []
      }
      client_health_scores: {
        Row: {
          assigned_coach: string | null
          calculated_at: string | null
          calculated_date: string | null
          calculated_on: string | null
          calculation_version: string | null
          churn_risk_score: number | null
          client_segment: string | null
          created_at: string | null
          days_since_last_session: number | null
          days_until_renewal: number | null
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
          momentum_score: number | null
          outstanding_sessions: number | null
          package_health_score: number | null
          package_type: string | null
          package_value_aed: number | null
          relationship_score: number | null
          sessions_last_30d: number | null
          sessions_last_7d: number | null
          sessions_last_90d: number | null
          sessions_purchased: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_coach?: string | null
          calculated_at?: string | null
          calculated_date?: string | null
          calculated_on?: string | null
          calculation_version?: string | null
          churn_risk_score?: number | null
          client_segment?: string | null
          created_at?: string | null
          days_since_last_session?: number | null
          days_until_renewal?: number | null
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
          momentum_score?: number | null
          outstanding_sessions?: number | null
          package_health_score?: number | null
          package_type?: string | null
          package_value_aed?: number | null
          relationship_score?: number | null
          sessions_last_30d?: number | null
          sessions_last_7d?: number | null
          sessions_last_90d?: number | null
          sessions_purchased?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_coach?: string | null
          calculated_at?: string | null
          calculated_date?: string | null
          calculated_on?: string | null
          calculation_version?: string | null
          churn_risk_score?: number | null
          client_segment?: string | null
          created_at?: string | null
          days_since_last_session?: number | null
          days_until_renewal?: number | null
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
          momentum_score?: number | null
          outstanding_sessions?: number | null
          package_health_score?: number | null
          package_type?: string | null
          package_value_aed?: number | null
          relationship_score?: number | null
          sessions_last_30d?: number | null
          sessions_last_7d?: number | null
          sessions_last_90d?: number | null
          sessions_purchased?: number | null
          updated_at?: string | null
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
          ai_recommendations: string | null
          coach_id: string
          created_at: string | null
          id: string
          review_month: string
          review_summary: Json | null
        }
        Insert: {
          ai_recommendations?: string | null
          coach_id: string
          created_at?: string | null
          id?: string
          review_month: string
          review_summary?: Json | null
        }
        Update: {
          ai_recommendations?: string | null
          coach_id?: string
          created_at?: string | null
          id?: string
          review_month?: string
          review_summary?: Json | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          annual_revenue: number | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          domain: string | null
          employee_count: number | null
          hubspot_company_id: string | null
          id: string
          industry: string | null
          updated_at: string
        }
        Insert: {
          annual_revenue?: number | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          employee_count?: number | null
          hubspot_company_id?: string | null
          id?: string
          industry?: string | null
          updated_at?: string
        }
        Update: {
          annual_revenue?: number | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          employee_count?: number | null
          hubspot_company_id?: string | null
          id?: string
          industry?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          activity_description: string | null
          activity_title: string | null
          activity_type: string
          contact_id: string | null
          created_at: string | null
          hubspot_contact_id: string | null
          id: string
          metadata: Json | null
          occurred_at: string | null
          performed_by: string | null
        }
        Insert: {
          activity_description?: string | null
          activity_title?: string | null
          activity_type: string
          contact_id?: string | null
          created_at?: string | null
          hubspot_contact_id?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          performed_by?: string | null
        }
        Update: {
          activity_description?: string | null
          activity_title?: string | null
          activity_type?: string
          contact_id?: string | null
          created_at?: string | null
          hubspot_contact_id?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          call_attempt_count: number | null
          city: string | null
          contact_unworked: boolean | null
          count_of_reassignations: number | null
          created_at: string | null
          currently_in_prospecting: boolean | null
          custom_lifecycle_stage: string | null
          delegation_date: string | null
          email: string | null
          email_domain: string | null
          facebook_id: string | null
          first_conversion_date: string | null
          first_name: string | null
          first_outbound_call_time: string | null
          first_touch_source: string | null
          first_touch_time: string | null
          ghl_contact_id: string | null
          google_id: string | null
          hubspot_contact_id: string | null
          hubspot_team: string | null
          id: string
          job_title: string | null
          last_activity_date: string | null
          last_name: string | null
          last_touch_source: string | null
          last_touch_time: string | null
          latest_traffic_source: string | null
          latest_traffic_source_2: string | null
          lead_status: string | null
          lifecycle_stage: string | null
          location: string | null
          member_accessed_private_content: number | null
          neighborhood: string | null
          num_form_submissions: number | null
          num_unique_forms_submitted: number | null
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          recent_conversion: string | null
          recent_conversion_date: string | null
          registered_member: number | null
          segment_memberships: string[] | null
          sla_first_touch: string | null
          speed_to_lead_minutes: number | null
          status: string | null
          time_of_entry: string | null
          total_events: number | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          call_attempt_count?: number | null
          city?: string | null
          contact_unworked?: boolean | null
          count_of_reassignations?: number | null
          created_at?: string | null
          currently_in_prospecting?: boolean | null
          custom_lifecycle_stage?: string | null
          delegation_date?: string | null
          email?: string | null
          email_domain?: string | null
          facebook_id?: string | null
          first_conversion_date?: string | null
          first_name?: string | null
          first_outbound_call_time?: string | null
          first_touch_source?: string | null
          first_touch_time?: string | null
          ghl_contact_id?: string | null
          google_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_team?: string | null
          id?: string
          job_title?: string | null
          last_activity_date?: string | null
          last_name?: string | null
          last_touch_source?: string | null
          last_touch_time?: string | null
          latest_traffic_source?: string | null
          latest_traffic_source_2?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          location?: string | null
          member_accessed_private_content?: number | null
          neighborhood?: string | null
          num_form_submissions?: number | null
          num_unique_forms_submitted?: number | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          recent_conversion?: string | null
          recent_conversion_date?: string | null
          registered_member?: number | null
          segment_memberships?: string[] | null
          sla_first_touch?: string | null
          speed_to_lead_minutes?: number | null
          status?: string | null
          time_of_entry?: string | null
          total_events?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          call_attempt_count?: number | null
          city?: string | null
          contact_unworked?: boolean | null
          count_of_reassignations?: number | null
          created_at?: string | null
          currently_in_prospecting?: boolean | null
          custom_lifecycle_stage?: string | null
          delegation_date?: string | null
          email?: string | null
          email_domain?: string | null
          facebook_id?: string | null
          first_conversion_date?: string | null
          first_name?: string | null
          first_outbound_call_time?: string | null
          first_touch_source?: string | null
          first_touch_time?: string | null
          ghl_contact_id?: string | null
          google_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_team?: string | null
          id?: string
          job_title?: string | null
          last_activity_date?: string | null
          last_name?: string | null
          last_touch_source?: string | null
          last_touch_time?: string | null
          latest_traffic_source?: string | null
          latest_traffic_source_2?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          location?: string | null
          member_accessed_private_content?: number | null
          neighborhood?: string | null
          num_form_submissions?: number | null
          num_unique_forms_submitted?: number | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          recent_conversion?: string | null
          recent_conversion_date?: string | null
          registered_member?: number | null
          segment_memberships?: string[] | null
          sla_first_touch?: string | null
          speed_to_lead_minutes?: number | null
          status?: string | null
          time_of_entry?: string | null
          total_events?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversion_events: {
        Row: {
          action_source: string | null
          created_at: string | null
          custom_data: Json | null
          event_name: string
          event_source_url: string | null
          event_time: string | null
          id: string
          user_data: Json | null
        }
        Insert: {
          action_source?: string | null
          created_at?: string | null
          custom_data?: Json | null
          event_name: string
          event_source_url?: string | null
          event_time?: string | null
          id?: string
          user_data?: Json | null
        }
        Update: {
          action_source?: string | null
          created_at?: string | null
          custom_data?: Json | null
          event_name?: string
          event_source_url?: string | null
          event_time?: string | null
          id?: string
          user_data?: Json | null
        }
        Relationships: []
      }
      conversion_tracking: {
        Row: {
          created_at: string | null
          default_value: number | null
          enabled: boolean | null
          event_name: string
          id: string
          platform: string
          platform_event_name: string
          updated_at: string | null
          value_mapping: Json | null
        }
        Insert: {
          created_at?: string | null
          default_value?: number | null
          enabled?: boolean | null
          event_name: string
          id?: string
          platform: string
          platform_event_name: string
          updated_at?: string | null
          value_mapping?: Json | null
        }
        Update: {
          created_at?: string | null
          default_value?: number | null
          enabled?: boolean | null
          event_name?: string
          id?: string
          platform?: string
          platform_event_name?: string
          updated_at?: string | null
          value_mapping?: Json | null
        }
        Relationships: []
      }
      customer_journeys: {
        Row: {
          attribution_model: string | null
          conversion_event: string | null
          conversion_value: number | null
          created_at: string | null
          customer_id: string
          id: string
          journey_end: string | null
          journey_start: string
          total_touchpoints: number | null
          updated_at: string | null
        }
        Insert: {
          attribution_model?: string | null
          conversion_event?: string | null
          conversion_value?: number | null
          created_at?: string | null
          customer_id: string
          id?: string
          journey_end?: string | null
          journey_start: string
          total_touchpoints?: number | null
          updated_at?: string | null
        }
        Update: {
          attribution_model?: string | null
          conversion_event?: string | null
          conversion_value?: number | null
          created_at?: string | null
          customer_id?: string
          id?: string
          journey_end?: string | null
          journey_start?: string
          total_touchpoints?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          event_count: number | null
          first_name: string | null
          first_seen: string | null
          id: string
          identity_print: string
          last_event: string | null
          last_name: string | null
          last_seen: string | null
          phone: string | null
          predicted_ltv: number | null
          segment: string | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          event_count?: number | null
          first_name?: string | null
          first_seen?: string | null
          id?: string
          identity_print: string
          last_event?: string | null
          last_name?: string | null
          last_seen?: string | null
          phone?: string | null
          predicted_ltv?: number | null
          segment?: string | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          event_count?: number | null
          first_name?: string | null
          first_seen?: string | null
          id?: string
          identity_print?: string
          last_event?: string | null
          last_name?: string | null
          last_seen?: string | null
          phone?: string | null
          predicted_ltv?: number | null
          segment?: string | null
          total_value?: number | null
          updated_at?: string | null
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
      deals: {
        Row: {
          appointment_id: string | null
          cash_collected: number | null
          close_date: string | null
          closer_id: string | null
          collection_date: string | null
          created_at: string | null
          deal_name: string | null
          deal_type: string | null
          deal_value: number
          hubspot_deal_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          pipeline: string | null
          stage: string | null
          status: Database["public"]["Enums"]["deal_status"] | null
          updated_at: string | null
          value_aed: number | null
        }
        Insert: {
          appointment_id?: string | null
          cash_collected?: number | null
          close_date?: string | null
          closer_id?: string | null
          collection_date?: string | null
          created_at?: string | null
          deal_name?: string | null
          deal_type?: string | null
          deal_value: number
          hubspot_deal_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          pipeline?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["deal_status"] | null
          updated_at?: string | null
          value_aed?: number | null
        }
        Update: {
          appointment_id?: string | null
          cash_collected?: number | null
          close_date?: string | null
          closer_id?: string | null
          collection_date?: string | null
          created_at?: string | null
          deal_name?: string | null
          deal_type?: string | null
          deal_value?: number
          hubspot_deal_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          pipeline?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["deal_status"] | null
          updated_at?: string | null
          value_aed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      "deals hub": {
        Row: {
          attrs: Json | null
          id: string | null
          updated_at: string | null
        }
        Insert: {
          attrs?: Json | null
          id?: string | null
          updated_at?: string | null
        }
        Update: {
          attrs?: Json | null
          id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      diagnostics: {
        Row: {
          coverage: number | null
          created_at: string | null
          date: string
          id: string
          match_quality: number | null
          notes: Json | null
          server_dedup_rate: number | null
          web_dedup_rate: number | null
        }
        Insert: {
          coverage?: number | null
          created_at?: string | null
          date: string
          id?: string
          match_quality?: number | null
          notes?: Json | null
          server_dedup_rate?: number | null
          web_dedup_rate?: number | null
        }
        Update: {
          coverage?: number | null
          created_at?: string | null
          date?: string
          id?: string
          match_quality?: number | null
          notes?: Json | null
          server_dedup_rate?: number | null
          web_dedup_rate?: number | null
        }
        Relationships: []
      }
      enhanced_leads: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          assigned_coach_id: string | null
          availability: string | null
          browser: string | null
          budget_range: string | null
          campaign_id: string | null
          campaign_name: string | null
          conversion_status: string | null
          created_at: string | null
          deal_value: number | null
          device_type: string | null
          dubai_area: string | null
          email: string | null
          experience_level: string | null
          facebook_click_id: string | null
          facebook_lead_id: string | null
          first_contact_at: string | null
          first_name: string | null
          fitness_goal: string | null
          follow_up_status: string | null
          form_id: string | null
          form_name: string | null
          health_conditions: string | null
          hubspot_contact_id: string | null
          id: string
          ip_address: unknown
          landing_page_url: string | null
          last_name: string | null
          lead_quality: string | null
          lead_score: number | null
          lifecycle_stage: string | null
          ltv_prediction: number | null
          operating_system: string | null
          phone: string | null
          previous_trainer_experience: string | null
          processed_at: string | null
          processing_errors: Json | null
          raw_facebook_data: Json | null
          raw_form_responses: Json | null
          referrer_url: string | null
          response_time_minutes: number | null
          routing_priority: string | null
          time_on_page_seconds: number | null
          trainer_preference: string | null
          training_location: string | null
          updated_at: string | null
          urgency: string | null
          user_agent: string | null
          webhook_received_at: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          assigned_coach_id?: string | null
          availability?: string | null
          browser?: string | null
          budget_range?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          conversion_status?: string | null
          created_at?: string | null
          deal_value?: number | null
          device_type?: string | null
          dubai_area?: string | null
          email?: string | null
          experience_level?: string | null
          facebook_click_id?: string | null
          facebook_lead_id?: string | null
          first_contact_at?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          follow_up_status?: string | null
          form_id?: string | null
          form_name?: string | null
          health_conditions?: string | null
          hubspot_contact_id?: string | null
          id?: string
          ip_address?: unknown
          landing_page_url?: string | null
          last_name?: string | null
          lead_quality?: string | null
          lead_score?: number | null
          lifecycle_stage?: string | null
          ltv_prediction?: number | null
          operating_system?: string | null
          phone?: string | null
          previous_trainer_experience?: string | null
          processed_at?: string | null
          processing_errors?: Json | null
          raw_facebook_data?: Json | null
          raw_form_responses?: Json | null
          referrer_url?: string | null
          response_time_minutes?: number | null
          routing_priority?: string | null
          time_on_page_seconds?: number | null
          trainer_preference?: string | null
          training_location?: string | null
          updated_at?: string | null
          urgency?: string | null
          user_agent?: string | null
          webhook_received_at?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          assigned_coach_id?: string | null
          availability?: string | null
          browser?: string | null
          budget_range?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          conversion_status?: string | null
          created_at?: string | null
          deal_value?: number | null
          device_type?: string | null
          dubai_area?: string | null
          email?: string | null
          experience_level?: string | null
          facebook_click_id?: string | null
          facebook_lead_id?: string | null
          first_contact_at?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          follow_up_status?: string | null
          form_id?: string | null
          form_name?: string | null
          health_conditions?: string | null
          hubspot_contact_id?: string | null
          id?: string
          ip_address?: unknown
          landing_page_url?: string | null
          last_name?: string | null
          lead_quality?: string | null
          lead_score?: number | null
          lifecycle_stage?: string | null
          ltv_prediction?: number | null
          operating_system?: string | null
          phone?: string | null
          previous_trainer_experience?: string | null
          processed_at?: string | null
          processing_errors?: Json | null
          raw_facebook_data?: Json | null
          raw_form_responses?: Json | null
          referrer_url?: string | null
          response_time_minutes?: number | null
          routing_priority?: string | null
          time_on_page_seconds?: number | null
          trainer_preference?: string | null
          training_location?: string | null
          updated_at?: string | null
          urgency?: string | null
          user_agent?: string | null
          webhook_received_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          attribution_credits: Json | null
          created_at: string | null
          custom: Json
          event_id: string
          event_name: string
          event_time: string | null
          facebook_success: boolean | null
          id: string
          identity_print: string | null
          match_score: number | null
          meta: Json | null
          predicted_ltv: number | null
          source: string
          status: string
          user_data: Json
        }
        Insert: {
          attribution_credits?: Json | null
          created_at?: string | null
          custom?: Json
          event_id: string
          event_name: string
          event_time?: string | null
          facebook_success?: boolean | null
          id?: string
          identity_print?: string | null
          match_score?: number | null
          meta?: Json | null
          predicted_ltv?: number | null
          source: string
          status?: string
          user_data: Json
        }
        Update: {
          attribution_credits?: Json | null
          created_at?: string | null
          custom?: Json
          event_id?: string
          event_name?: string
          event_time?: string | null
          facebook_success?: boolean | null
          id?: string
          identity_print?: string | null
          match_score?: number | null
          meta?: Json | null
          predicted_ltv?: number | null
          source?: string
          status?: string
          user_data?: Json
        }
        Relationships: []
      }
      facebook_campaigns: {
        Row: {
          account_id: string | null
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          cpc: number | null
          created_at: string
          ctr: number | null
          daily_budget: number | null
          frequency: number | null
          id: string
          impressions: number | null
          lifetime_budget: number | null
          objective: string | null
          reach: number | null
          spend: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          daily_budget?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          lifetime_budget?: number | null
          objective?: string | null
          reach?: number | null
          spend?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          daily_budget?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          lifetime_budget?: number | null
          objective?: string | null
          reach?: number | null
          spend?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      facebook_creatives: {
        Row: {
          ad_id: string
          body: string | null
          campaign_id: string | null
          created_at: string
          creative_name: string | null
          id: string
          image_url: string | null
          status: string | null
          title: string | null
          updated_at: string
          video_id: string | null
        }
        Insert: {
          ad_id: string
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          creative_name?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          ad_id?: string
          body?: string | null
          campaign_id?: string | null
          created_at?: string
          creative_name?: string | null
          id?: string
          image_url?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Relationships: []
      }
      facebook_leads: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          created_time: string
          field_data: Json
          form_id: string
          id: string
          page_id: string
          processed: boolean | null
          received_at: string | null
          updated_at: string | null
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_time: string
          field_data?: Json
          form_id: string
          id: string
          page_id: string
          processed?: boolean | null
          received_at?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_time?: string
          field_data?: Json
          form_id?: string
          id?: string
          page_id?: string
          processed?: boolean | null
          received_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hubspot_contact_changes: {
        Row: {
          contact_email: string | null
          contact_id: string
          created_at: string | null
          event_type: string
          id: string
          new_value: string | null
          occurred_at: string | null
          old_value: string | null
          property_name: string | null
          raw: Json | null
          risk_reasons: string[] | null
          risk_score: number | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_id: string
          created_at?: string | null
          event_type: string
          id?: string
          new_value?: string | null
          occurred_at?: string | null
          old_value?: string | null
          property_name?: string | null
          raw?: Json | null
          risk_reasons?: string[] | null
          risk_score?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          new_value?: string | null
          occurred_at?: string | null
          old_value?: string | null
          property_name?: string | null
          raw?: Json | null
          risk_reasons?: string[] | null
          risk_score?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hubspot_login_activity: {
        Row: {
          created_at: string | null
          hubspot_id: string | null
          id: string
          ip_address: string | null
          location: string | null
          login_type: string | null
          occurred_at: string | null
          raw: Json | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          hubspot_id?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          login_type?: string | null
          occurred_at?: string | null
          raw?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          hubspot_id?: string | null
          id?: string
          ip_address?: string | null
          location?: string | null
          login_type?: string | null
          occurred_at?: string | null
          raw?: Json | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hubspot_property_definitions: {
        Row: {
          description: string | null
          field_type: string | null
          is_hidden: boolean | null
          is_required: boolean | null
          last_synced_at: string | null
          object_type: string
          options: Json | null
          property_label: string | null
          property_name: string
        }
        Insert: {
          description?: string | null
          field_type?: string | null
          is_hidden?: boolean | null
          is_required?: boolean | null
          last_synced_at?: string | null
          object_type: string
          options?: Json | null
          property_label?: string | null
          property_name: string
        }
        Update: {
          description?: string | null
          field_type?: string | null
          is_hidden?: boolean | null
          is_required?: boolean | null
          last_synced_at?: string | null
          object_type?: string
          options?: Json | null
          property_label?: string | null
          property_name?: string
        }
        Relationships: []
      }
      hubspot_security_activity: {
        Row: {
          created_at: string | null
          details: string | null
          event_type: string
          hubspot_id: string | null
          id: string
          ip_address: string | null
          occurred_at: string | null
          raw: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          event_type: string
          hubspot_id?: string | null
          id?: string
          ip_address?: string | null
          occurred_at?: string | null
          raw?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          event_type?: string
          hubspot_id?: string | null
          id?: string
          ip_address?: string | null
          occurred_at?: string | null
          raw?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hubspot_user_daily_summary: {
        Row: {
          anomaly_flags: string[] | null
          contact_creations: number | null
          contact_deletions: number | null
          contact_updates: number | null
          created_at: string | null
          exports: number | null
          id: string
          logins: number | null
          owner_changes: number | null
          risk_score: number | null
          security_events: number | null
          status_changes: number | null
          summary_date: string
          updated_at: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          anomaly_flags?: string[] | null
          contact_creations?: number | null
          contact_deletions?: number | null
          contact_updates?: number | null
          created_at?: string | null
          exports?: number | null
          id?: string
          logins?: number | null
          owner_changes?: number | null
          risk_score?: number | null
          security_events?: number | null
          status_changes?: number | null
          summary_date: string
          updated_at?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          anomaly_flags?: string[] | null
          contact_creations?: number | null
          contact_deletions?: number | null
          contact_updates?: number | null
          created_at?: string | null
          exports?: number | null
          id?: string
          logins?: number | null
          owner_changes?: number | null
          risk_score?: number | null
          security_events?: number | null
          status_changes?: number | null
          summary_date?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      intervention_log: {
        Row: {
          actioned_at: string | null
          ai_confidence: number | null
          ai_insight: string | null
          ai_recommendation: string | null
          assigned_to: string | null
          churn_risk_at_trigger: number | null
          client_email: string
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
          intervention_type: string
          lastname: string | null
          message_tone: string | null
          notes: string | null
          outcome: string | null
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
          ai_recommendation?: string | null
          assigned_to?: string | null
          churn_risk_at_trigger?: number | null
          client_email: string
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
          intervention_type: string
          lastname?: string | null
          message_tone?: string | null
          notes?: string | null
          outcome?: string | null
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
          ai_recommendation?: string | null
          assigned_to?: string | null
          churn_risk_at_trigger?: number | null
          client_email?: string
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
          intervention_type?: string
          lastname?: string | null
          message_tone?: string | null
          notes?: string | null
          outcome?: string | null
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
      knowledge_documents: {
        Row: {
          content: string
          content_chunks: string[] | null
          created_at: string | null
          embedding: string | null
          filename: string
          id: string
          metadata: Json | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          content: string
          content_chunks?: string[] | null
          created_at?: string | null
          embedding?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          content?: string
          content_chunks?: string[] | null
          created_at?: string | null
          embedding?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      kpi_tracking: {
        Row: {
          category: string
          created_at: string
          id: string
          location: string | null
          metadata: Json | null
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
          target_value: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          location?: string | null
          metadata?: Json | null
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
          target_value?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          location?: string | null
          metadata?: Json | null
          metric_name?: string
          metric_value?: number
          period_end?: string
          period_start?: string
          target_value?: number | null
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          id: string
          lead_id: string
          raw: Json
          received_at: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          raw: Json
          received_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string
          raw?: Json
          received_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          closer_id: string | null
          created_at: string | null
          email: string | null
          facebook_lead_id: string | null
          first_name: string | null
          hubspot_id: string | null
          id: string
          last_name: string | null
          name: string
          phone: string | null
          score: number | null
          setter_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          updated_at: string | null
        }
        Insert: {
          closer_id?: string | null
          created_at?: string | null
          email?: string | null
          facebook_lead_id?: string | null
          first_name?: string | null
          hubspot_id?: string | null
          id?: string
          last_name?: string | null
          name: string
          phone?: string | null
          score?: number | null
          setter_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
        }
        Update: {
          closer_id?: string | null
          created_at?: string | null
          email?: string | null
          facebook_lead_id?: string | null
          first_name?: string | null
          hubspot_id?: string | null
          id?: string
          last_name?: string | null
          name?: string
          phone?: string | null
          score?: number | null
          setter_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_setter_id_fkey"
            columns: ["setter_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_costs: {
        Row: {
          ad_spend: number
          created_at: string | null
          date: string
          id: string
          other_costs: number | null
          platform: string | null
        }
        Insert: {
          ad_spend?: number
          created_at?: string | null
          date: string
          id?: string
          other_costs?: number | null
          platform?: string | null
        }
        Update: {
          ad_spend?: number
          created_at?: string | null
          date?: string
          id?: string
          other_costs?: number | null
          platform?: string | null
        }
        Relationships: []
      }
      member_analytics: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          class_name: string | null
          created_at: string
          id: string
          location: string
          member_id: string
          satisfaction_score: number | null
          session_duration: number | null
          session_type: string | null
          trainer_id: string | null
          visit_date: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          class_name?: string | null
          created_at?: string
          id?: string
          location?: string
          member_id: string
          satisfaction_score?: number | null
          session_duration?: number | null
          session_type?: string | null
          trainer_id?: string | null
          visit_date: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          class_name?: string | null
          created_at?: string
          id?: string
          location?: string
          member_id?: string
          satisfaction_score?: number | null
          session_duration?: number | null
          session_type?: string | null
          trainer_id?: string | null
          visit_date?: string
        }
        Relationships: []
      }
      owner_performance: {
        Row: {
          bookings: number | null
          commission: number | null
          created_at: string | null
          date: string
          id: string
          leads: number | null
          owner_id: string
          owner_name: string | null
          revenue: number | null
          shows: number | null
          wins: number | null
        }
        Insert: {
          bookings?: number | null
          commission?: number | null
          created_at?: string | null
          date: string
          id?: string
          leads?: number | null
          owner_id: string
          owner_name?: string | null
          revenue?: number | null
          shows?: number | null
          wins?: number | null
        }
        Update: {
          bookings?: number | null
          commission?: number | null
          created_at?: string | null
          date?: string
          id?: string
          leads?: number | null
          owner_id?: string
          owner_name?: string | null
          revenue?: number | null
          shows?: number | null
          wins?: number | null
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          access_token: string
          account_id: string
          account_name: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          last_sync: string | null
          platform: string
          refresh_token: string | null
          scopes: string[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          account_id: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_sync?: string | null
          platform: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          account_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_sync?: string | null
          platform?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_metrics: {
        Row: {
          ad_id: string | null
          ad_set_id: string | null
          campaign_id: string | null
          created_at: string | null
          date_recorded: string
          hour_recorded: number | null
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          platform: string
        }
        Insert: {
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          date_recorded: string
          hour_recorded?: number | null
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
          platform: string
        }
        Update: {
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          date_recorded?: string
          hour_recorded?: number | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          platform?: string
        }
        Relationships: []
      }
      proactive_insights: {
        Row: {
          best_call_time: string | null
          call_script: string | null
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          insight_type: string
          is_dismissed: boolean | null
          lead_id: string | null
          notes: string | null
          outcome: string | null
          priority: string | null
          reason: string | null
          recommended_action: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          best_call_time?: string | null
          call_script?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          insight_type: string
          is_dismissed?: boolean | null
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          priority?: string | null
          reason?: string | null
          recommended_action?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          best_call_time?: string | null
          call_script?: string | null
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          insight_type?: string
          is_dismissed?: boolean | null
          lead_id?: string | null
          notes?: string | null
          outcome?: string | null
          priority?: string | null
          reason?: string | null
          recommended_action?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proactive_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_insights_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          lead_source: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          lead_source?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          lead_source?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: []
      }
      sync_errors: {
        Row: {
          created_at: string | null
          error_details: Json | null
          error_message: string
          error_type: string
          id: string
          max_retries: number | null
          next_retry_at: string | null
          object_id: string | null
          object_type: string | null
          operation: string | null
          request_payload: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          response_payload: Json | null
          retry_count: number | null
          source: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          error_message: string
          error_type: string
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          object_id?: string | null
          object_type?: string | null
          operation?: string | null
          request_payload?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_payload?: Json | null
          retry_count?: number | null
          source: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          object_id?: string | null
          object_type?: string | null
          operation?: string | null
          request_payload?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_payload?: Json | null
          retry_count?: number | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_details: Json | null
          id: string
          platform: string
          records_failed: number | null
          records_processed: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          id?: string
          platform: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          id?: string
          platform?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      sync_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          id: string
          job_type: string
          next_attempt_at: string | null
          payload: Json | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          job_type: string
          next_attempt_at?: string | null
          payload?: Json | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          job_type?: string
          next_attempt_at?: string | null
          payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      table_name: {
        Row: {
          data: Json | null
          id: number
          inserted_at: string
          name: string | null
          updated_at: string
        }
        Insert: {
          data?: Json | null
          id?: number
          inserted_at?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          data?: Json | null
          id?: number
          inserted_at?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          kind: string
          updated_at: string | null
          user_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          updated_at?: string | null
          user_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          updated_at?: string | null
          user_id?: string | null
          value?: string
        }
        Relationships: []
      }
      touchpoints: {
        Row: {
          attribution_credit: number | null
          attribution_event_id: string | null
          created_at: string | null
          id: string
          journey_id: string | null
          sequence_number: number
          time_to_next_touch: unknown
        }
        Insert: {
          attribution_credit?: number | null
          attribution_event_id?: string | null
          created_at?: string | null
          id?: string
          journey_id?: string | null
          sequence_number: number
          time_to_next_touch?: unknown
        }
        Update: {
          attribution_credit?: number | null
          attribution_event_id?: string | null
          created_at?: string | null
          id?: string
          journey_id?: string | null
          sequence_number?: number
          time_to_next_touch?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "touchpoints_attribution_event_id_fkey"
            columns: ["attribution_event_id"]
            isOneToOne: false
            referencedRelation: "attribution_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "touchpoints_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "customer_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_performance: {
        Row: {
          avg_rating: number | null
          certifications_updated: boolean | null
          created_at: string
          id: string
          location: string
          member_retention_rate: number | null
          period_end: string
          period_start: string
          sessions_conducted: number
          total_revenue: number
          trainer_id: string
          updated_at: string
        }
        Insert: {
          avg_rating?: number | null
          certifications_updated?: boolean | null
          created_at?: string
          id?: string
          location?: string
          member_retention_rate?: number | null
          period_end: string
          period_start: string
          sessions_conducted?: number
          total_revenue?: number
          trainer_id: string
          updated_at?: string
        }
        Update: {
          avg_rating?: number | null
          certifications_updated?: boolean | null
          created_at?: string
          id?: string
          location?: string
          member_retention_rate?: number | null
          period_end?: string
          period_start?: string
          sessions_conducted?: number
          total_revenue?: number
          trainer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          analytics_enabled: boolean | null
          created_at: string
          id: string
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_enabled?: boolean | null
          created_at?: string
          id?: string
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_enabled?: boolean | null
          created_at?: string
          id?: string
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          facebook_id: string | null
          full_name: string | null
          hubspot_contact_id: string | null
          id: string
          last_sync_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          facebook_id?: string | null
          full_name?: string | null
          hubspot_contact_id?: string | null
          id?: string
          last_sync_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          facebook_id?: string | null
          full_name?: string | null
          hubspot_contact_id?: string | null
          id?: string
          last_sync_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string | null
          id: string
          object_id: string | null
          payload: Json | null
          processed: boolean | null
          source: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          object_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          source: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          object_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          source?: string
        }
        Relationships: []
      }
      weekly_patterns: {
        Row: {
          ai_insights: string | null
          client_id: string
          created_at: string | null
          id: string
          pattern_summary: Json | null
          week_start: string
        }
        Insert: {
          ai_insights?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          pattern_summary?: Json | null
          week_start: string
        }
        Update: {
          ai_insights?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          pattern_summary?: Json | null
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_analytics: {
        Row: {
          avg_match_score: number | null
          avg_predicted_ltv: number | null
          date: string | null
          fb_success_count: number | null
          purchases: number | null
          revenue: number | null
          total_events: number | null
          total_value: number | null
          unique_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_attribution_weights: {
        Args: { journey_id_param: string; model_type?: string }
        Returns: {
          touchpoint_id: string
          weight: number
        }[]
      }
      calculate_lead_score: {
        Args: {
          budget_range_param: string
          dubai_area_param: string
          experience_level_param: string
          fitness_goal_param: string
          urgency_param: string
        }
        Returns: number
      }
      cleanup_old_logs: { Args: never; Returns: undefined }
      get_dashboard_metrics: {
        Args: never
        Returns: {
          follow_up: number
          no_show: number
          rescheduled: number
          total_appointments: number
          total_closes: number
          total_leads: number
          total_pitches: number
        }[]
      }
      get_event_volume_by_source: {
        Args: never
        Returns: {
          day: string
          events: number
          source: string
        }[]
      }
      get_events_metrics: {
        Args: never
        Returns: {
          appointment_held_leads: number
          appointment_set_leads: number
          avg_deal_value: number
          closed_deals: number
          closed_leads: number
          facebook_leads: number
          follow_up_leads: number
          google_leads: number
          month_leads: number
          new_leads: number
          no_show_leads: number
          pending_deals: number
          pitch_given_leads: number
          rescheduled_leads: number
          today_leads: number
          total_revenue: number
          week_leads: number
        }[]
      }
      get_events_metrics_secure: {
        Args: never
        Returns: {
          appointment_held_leads: number
          appointment_set_leads: number
          avg_deal_value: number
          closed_deals: number
          closed_leads: number
          facebook_leads: number
          follow_up_leads: number
          google_leads: number
          month_leads: number
          new_leads: number
          no_show_leads: number
          pending_deals: number
          pitch_given_leads: number
          rescheduled_leads: number
          today_leads: number
          total_revenue: number
          week_leads: number
        }[]
      }
      get_identifier_coverage: {
        Args: never
        Returns: {
          em: number
          event_name: string
          external: number
          fbc: number
          fbp: number
          ph: number
        }[]
      }
      get_revenue_data: {
        Args: never
        Returns: {
          day: string
          events: number
          leads: number
          purchases: number
          revenue_aed: number
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { role_name: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      process_hubspot_webhook: {
        Args: { webhook_payload: Json }
        Returns: Json
      }
      refresh_daily_analytics: { Args: never; Returns: undefined }
      refresh_platform_metrics: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      deal_status: "pending" | "closed" | "cancelled"
      lead_status:
        | "new"
        | "appointment_set"
        | "appointment_held"
        | "pitch_given"
        | "closed"
        | "no_show"
        | "follow_up"
        | "rescheduled"
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
    Enums: {
      app_role: ["admin", "user"],
      deal_status: ["pending", "closed", "cancelled"],
      lead_status: [
        "new",
        "appointment_set",
        "appointment_held",
        "pitch_given",
        "closed",
        "no_show",
        "follow_up",
        "rescheduled",
      ],
    },
  },
} as const
