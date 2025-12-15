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
      account_review_history: {
        Row: {
          account_id: string
          created_at: string | null
          event_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          requirements_after: Json | null
          requirements_before: Json | null
          review_date: string | null
          review_status: string | null
          review_type: string
          reviewed_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          requirements_after?: Json | null
          requirements_before?: Json | null
          review_date?: string | null
          review_status?: string | null
          review_type: string
          reviewed_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          requirements_after?: Json | null
          requirements_before?: Json | null
          review_date?: string | null
          review_status?: string | null
          review_type?: string
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_review_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "stripe_events"
            referencedColumns: ["event_id"]
          },
        ]
      }
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
      agent_decisions: {
        Row: {
          agent_id: string
          confidence_score: number | null
          created_at: string | null
          decision_output: Json | null
          decision_type: string
          executed_at: string | null
          id: string
          input_context: Json | null
          outcome: string | null
          status: string | null
        }
        Insert: {
          agent_id: string
          confidence_score?: number | null
          created_at?: string | null
          decision_output?: Json | null
          decision_type: string
          executed_at?: string | null
          id?: string
          input_context?: Json | null
          outcome?: string | null
          status?: string | null
        }
        Update: {
          agent_id?: string
          confidence_score?: number | null
          created_at?: string | null
          decision_output?: Json | null
          decision_type?: string
          executed_at?: string | null
          id?: string
          input_context?: Json | null
          outcome?: string | null
          status?: string | null
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          created_at: string | null
          embeddings: string | null
          id: string
          knowledge_extracted: Json | null
          query: string
          response: string
          thread_id: string
        }
        Insert: {
          created_at?: string | null
          embeddings?: string | null
          id?: string
          knowledge_extracted?: Json | null
          query: string
          response: string
          thread_id: string
        }
        Update: {
          created_at?: string | null
          embeddings?: string | null
          id?: string
          knowledge_extracted?: Json | null
          query?: string
          response?: string
          thread_id?: string
        }
        Relationships: []
      }
      agent_patterns: {
        Row: {
          confidence: number | null
          created_at: string | null
          description: string | null
          examples: Json[] | null
          id: string
          last_used_at: string | null
          pattern_name: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          examples?: Json[] | null
          id?: string
          last_used_at?: string | null
          pattern_name: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          examples?: Json[] | null
          id?: string
          last_used_at?: string | null
          pattern_name?: string
          updated_at?: string | null
          usage_count?: number | null
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
      app_settings: {
        Row: {
          capi_base_url: string | null
          created_at: string | null
          id: string
          meta_access_token: string | null
          meta_pixel_id: string | null
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
          supabase_anon_key?: string | null
          supabase_url?: string | null
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          test_event_code?: string | null
          updated_at?: string | null
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
          fb_ad_id: string | null
          fb_ad_name: string | null
          fb_adset_id: string | null
          fb_adset_name: string | null
          fb_campaign_id: string | null
          fb_campaign_name: string | null
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
          fb_ad_id?: string | null
          fb_ad_name?: string | null
          fb_adset_id?: string | null
          fb_adset_name?: string | null
          fb_campaign_id?: string | null
          fb_campaign_name?: string | null
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
          fb_ad_id?: string | null
          fb_ad_name?: string | null
          fb_adset_id?: string | null
          fb_adset_name?: string | null
          fb_campaign_id?: string | null
          fb_campaign_name?: string | null
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
      business_calibration: {
        Row: {
          ai_recommendation: string | null
          created_at: string
          feedback_notes: string | null
          id: string
          scenario_description: string
          was_ai_correct: boolean | null
          your_decision: string | null
        }
        Insert: {
          ai_recommendation?: string | null
          created_at?: string
          feedback_notes?: string | null
          id?: string
          scenario_description: string
          was_ai_correct?: boolean | null
          your_decision?: string | null
        }
        Update: {
          ai_recommendation?: string | null
          created_at?: string
          feedback_notes?: string | null
          id?: string
          scenario_description?: string
          was_ai_correct?: boolean | null
          your_decision?: string | null
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
      business_goals: {
        Row: {
          baseline_value: number | null
          created_at: string
          current_value: number | null
          deadline: string | null
          goal_name: string
          id: string
          metric_name: string
          status: string | null
          target_value: number
          updated_at: string
        }
        Insert: {
          baseline_value?: number | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          goal_name: string
          id?: string
          metric_name: string
          status?: string | null
          target_value: number
          updated_at?: string
        }
        Update: {
          baseline_value?: number | null
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          goal_name?: string
          id?: string
          metric_name?: string
          status?: string | null
          target_value?: number
          updated_at?: string
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
          ai_summary: string | null
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
          keywords: string[] | null
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
          transcription_status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
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
          keywords?: string[] | null
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
          transcription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
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
          keywords?: string[] | null
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
          transcription_status?: string | null
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
            referencedRelation: "campaign_lead_attribution"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_call_performance"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_journey_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "long_cycle_protection"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          analytics_score: number | null
          assessment_date: string | null
          assessment_scheduled: boolean | null
          assigned_coach: string | null
          associated_deal_ids: string[] | null
          call_attempt_count: number | null
          city: string | null
          closed_deal_value: number | null
          coach_notes: string | null
          company_domain: string | null
          company_id: string | null
          company_name: string | null
          company_size: string | null
          contact_unworked: boolean | null
          count_of_reassignations: number | null
          created_at: string | null
          currently_in_prospecting: boolean | null
          custom_lifecycle_stage: string | null
          delegation_date: string | null
          email: string | null
          email_domain: string | null
          email_opt_out: boolean | null
          facebook_clicks: number | null
          facebook_id: string | null
          first_conversion_date: string | null
          first_name: string | null
          first_outbound_call_time: string | null
          first_page_seen: string | null
          first_touch_source: string | null
          first_touch_time: string | null
          first_visit_date: string | null
          fitness_goals: string | null
          ghl_contact_id: string | null
          google_id: string | null
          hubspot_contact_id: string | null
          hubspot_team: string | null
          id: string
          industry: string | null
          job_title: string | null
          language: string | null
          last_activity_date: string | null
          last_deal_created_date: string | null
          last_email_clicked_date: string | null
          last_email_opened_date: string | null
          last_email_sent_date: string | null
          last_meeting_date: string | null
          last_name: string | null
          last_page_seen: string | null
          last_touch_source: string | null
          last_touch_time: string | null
          last_visit_date: string | null
          latest_traffic_source: string | null
          latest_traffic_source_2: string | null
          lead_status: string | null
          lifecycle_stage: string | null
          linkedin_bio: string | null
          linkedin_clicks: number | null
          linkedin_connections: number | null
          location: string | null
          marketing_opt_out: boolean | null
          member_accessed_private_content: number | null
          neighborhood: string | null
          next_meeting_date: string | null
          num_associated_deals: number | null
          num_emails: number | null
          num_emails_clicked: number | null
          num_emails_opened: number | null
          num_emails_sent: number | null
          num_event_completions: number | null
          num_form_submissions: number | null
          num_meetings: number | null
          num_notes: number | null
          num_page_views: number | null
          num_unique_forms_submitted: number | null
          num_visits: number | null
          open_deal_value: number | null
          outstanding_sessions: number | null
          owner_id: string | null
          owner_name: string | null
          package_type: string | null
          phone: string | null
          preferred_contact_method: string | null
          preferred_location: string | null
          recent_conversion: string | null
          recent_conversion_date: string | null
          registered_member: number | null
          segment_memberships: string[] | null
          sessions_purchased: number | null
          sla_first_touch: string | null
          speed_to_lead_minutes: number | null
          status: string | null
          time_of_entry: string | null
          timezone: string | null
          total_deal_value: number | null
          total_events: number | null
          total_value: number | null
          twitter_clicks: number | null
          twitter_followers: number | null
          twitter_handle: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          website: string | null
        }
        Insert: {
          analytics_score?: number | null
          assessment_date?: string | null
          assessment_scheduled?: boolean | null
          assigned_coach?: string | null
          associated_deal_ids?: string[] | null
          call_attempt_count?: number | null
          city?: string | null
          closed_deal_value?: number | null
          coach_notes?: string | null
          company_domain?: string | null
          company_id?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_unworked?: boolean | null
          count_of_reassignations?: number | null
          created_at?: string | null
          currently_in_prospecting?: boolean | null
          custom_lifecycle_stage?: string | null
          delegation_date?: string | null
          email?: string | null
          email_domain?: string | null
          email_opt_out?: boolean | null
          facebook_clicks?: number | null
          facebook_id?: string | null
          first_conversion_date?: string | null
          first_name?: string | null
          first_outbound_call_time?: string | null
          first_page_seen?: string | null
          first_touch_source?: string | null
          first_touch_time?: string | null
          first_visit_date?: string | null
          fitness_goals?: string | null
          ghl_contact_id?: string | null
          google_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_team?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          language?: string | null
          last_activity_date?: string | null
          last_deal_created_date?: string | null
          last_email_clicked_date?: string | null
          last_email_opened_date?: string | null
          last_email_sent_date?: string | null
          last_meeting_date?: string | null
          last_name?: string | null
          last_page_seen?: string | null
          last_touch_source?: string | null
          last_touch_time?: string | null
          last_visit_date?: string | null
          latest_traffic_source?: string | null
          latest_traffic_source_2?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          linkedin_bio?: string | null
          linkedin_clicks?: number | null
          linkedin_connections?: number | null
          location?: string | null
          marketing_opt_out?: boolean | null
          member_accessed_private_content?: number | null
          neighborhood?: string | null
          next_meeting_date?: string | null
          num_associated_deals?: number | null
          num_emails?: number | null
          num_emails_clicked?: number | null
          num_emails_opened?: number | null
          num_emails_sent?: number | null
          num_event_completions?: number | null
          num_form_submissions?: number | null
          num_meetings?: number | null
          num_notes?: number | null
          num_page_views?: number | null
          num_unique_forms_submitted?: number | null
          num_visits?: number | null
          open_deal_value?: number | null
          outstanding_sessions?: number | null
          owner_id?: string | null
          owner_name?: string | null
          package_type?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_location?: string | null
          recent_conversion?: string | null
          recent_conversion_date?: string | null
          registered_member?: number | null
          segment_memberships?: string[] | null
          sessions_purchased?: number | null
          sla_first_touch?: string | null
          speed_to_lead_minutes?: number | null
          status?: string | null
          time_of_entry?: string | null
          timezone?: string | null
          total_deal_value?: number | null
          total_events?: number | null
          total_value?: number | null
          twitter_clicks?: number | null
          twitter_followers?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Update: {
          analytics_score?: number | null
          assessment_date?: string | null
          assessment_scheduled?: boolean | null
          assigned_coach?: string | null
          associated_deal_ids?: string[] | null
          call_attempt_count?: number | null
          city?: string | null
          closed_deal_value?: number | null
          coach_notes?: string | null
          company_domain?: string | null
          company_id?: string | null
          company_name?: string | null
          company_size?: string | null
          contact_unworked?: boolean | null
          count_of_reassignations?: number | null
          created_at?: string | null
          currently_in_prospecting?: boolean | null
          custom_lifecycle_stage?: string | null
          delegation_date?: string | null
          email?: string | null
          email_domain?: string | null
          email_opt_out?: boolean | null
          facebook_clicks?: number | null
          facebook_id?: string | null
          first_conversion_date?: string | null
          first_name?: string | null
          first_outbound_call_time?: string | null
          first_page_seen?: string | null
          first_touch_source?: string | null
          first_touch_time?: string | null
          first_visit_date?: string | null
          fitness_goals?: string | null
          ghl_contact_id?: string | null
          google_id?: string | null
          hubspot_contact_id?: string | null
          hubspot_team?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          language?: string | null
          last_activity_date?: string | null
          last_deal_created_date?: string | null
          last_email_clicked_date?: string | null
          last_email_opened_date?: string | null
          last_email_sent_date?: string | null
          last_meeting_date?: string | null
          last_name?: string | null
          last_page_seen?: string | null
          last_touch_source?: string | null
          last_touch_time?: string | null
          last_visit_date?: string | null
          latest_traffic_source?: string | null
          latest_traffic_source_2?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          linkedin_bio?: string | null
          linkedin_clicks?: number | null
          linkedin_connections?: number | null
          location?: string | null
          marketing_opt_out?: boolean | null
          member_accessed_private_content?: number | null
          neighborhood?: string | null
          next_meeting_date?: string | null
          num_associated_deals?: number | null
          num_emails?: number | null
          num_emails_clicked?: number | null
          num_emails_opened?: number | null
          num_emails_sent?: number | null
          num_event_completions?: number | null
          num_form_submissions?: number | null
          num_meetings?: number | null
          num_notes?: number | null
          num_page_views?: number | null
          num_unique_forms_submitted?: number | null
          num_visits?: number | null
          open_deal_value?: number | null
          outstanding_sessions?: number | null
          owner_id?: string | null
          owner_name?: string | null
          package_type?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_location?: string | null
          recent_conversion?: string | null
          recent_conversion_date?: string | null
          registered_member?: number | null
          segment_memberships?: string[] | null
          sessions_purchased?: number | null
          sla_first_touch?: string | null
          speed_to_lead_minutes?: number | null
          status?: string | null
          time_of_entry?: string | null
          timezone?: string | null
          total_deal_value?: number | null
          total_events?: number | null
          total_value?: number | null
          twitter_clicks?: number | null
          twitter_followers?: number | null
          twitter_handle?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Relationships: []
      }
      conversation_summaries: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          key_points: Json | null
          session_id: string | null
          summary: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          key_points?: Json | null
          session_id?: string | null
          summary: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          key_points?: Json | null
          session_id?: string | null
          summary?: string
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
      edge_function_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          function_name: string
          id: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
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
      facebook_ads_insights: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          leads: number | null
          reach: number | null
          spend: number | null
          updated_at: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
          updated_at?: string | null
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
      hubspot_activity_cache: {
        Row: {
          activity_data: Json
          activity_timestamp: string
          activity_type: string
          contact_id: string | null
          contact_name: string | null
          created_at: string
          id: string
        }
        Insert: {
          activity_data: Json
          activity_timestamp: string
          activity_type: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          activity_data?: Json
          activity_timestamp?: string
          activity_type?: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
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
      knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
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
      notifications: {
        Row: {
          category: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
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
      prepared_actions: {
        Row: {
          action_description: string | null
          action_title: string
          action_type: string
          confidence: number | null
          created_at: string
          executed_at: string | null
          expected_impact: string | null
          id: string
          prepared_payload: Json | null
          priority: number | null
          reasoning: string | null
          rejection_reason: string | null
          risk_level: string | null
          source_agent: string | null
          status: string | null
          supporting_data: Json | null
        }
        Insert: {
          action_description?: string | null
          action_title: string
          action_type?: string
          confidence?: number | null
          created_at?: string
          executed_at?: string | null
          expected_impact?: string | null
          id?: string
          prepared_payload?: Json | null
          priority?: number | null
          reasoning?: string | null
          rejection_reason?: string | null
          risk_level?: string | null
          source_agent?: string | null
          status?: string | null
          supporting_data?: Json | null
        }
        Update: {
          action_description?: string | null
          action_title?: string
          action_type?: string
          confidence?: number | null
          created_at?: string
          executed_at?: string | null
          expected_impact?: string | null
          id?: string
          prepared_payload?: Json | null
          priority?: number | null
          reasoning?: string | null
          rejection_reason?: string | null
          risk_level?: string | null
          source_agent?: string | null
          status?: string | null
          supporting_data?: Json | null
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
            referencedRelation: "campaign_lead_attribution"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "proactive_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_call_performance"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "proactive_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_journey_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "proactive_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "long_cycle_protection"
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
      reassignment_log: {
        Row: {
          contact_id: string
          created_at: string | null
          error_message: string | null
          hubspot_contact_id: string | null
          id: string
          metadata: Json | null
          new_owner_id: string
          old_owner_id: string | null
          reason: string
          reassigned_at: string | null
          status: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          error_message?: string | null
          hubspot_contact_id?: string | null
          id?: string
          metadata?: Json | null
          new_owner_id: string
          old_owner_id?: string | null
          reason: string
          reassigned_at?: string | null
          status?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          error_message?: string | null
          hubspot_contact_id?: string | null
          id?: string
          metadata?: Json | null
          new_owner_id?: string
          old_owner_id?: string | null
          reason?: string
          reassigned_at?: string | null
          status?: string | null
        }
        Relationships: []
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
      stripe_accounts: {
        Row: {
          business_type: string | null
          charges_enabled: boolean | null
          country: string | null
          created_at: string | null
          details_submitted: boolean | null
          email: string | null
          id: string
          metadata: Json | null
          payouts_enabled: boolean | null
          requirements: Json | null
          stripe_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          business_type?: string | null
          charges_enabled?: boolean | null
          country?: string | null
          created_at?: string | null
          details_submitted?: boolean | null
          email?: string | null
          id?: string
          metadata?: Json | null
          payouts_enabled?: boolean | null
          requirements?: Json | null
          stripe_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          business_type?: string | null
          charges_enabled?: boolean | null
          country?: string | null
          created_at?: string | null
          details_submitted?: boolean | null
          email?: string | null
          id?: string
          metadata?: Json | null
          payouts_enabled?: boolean | null
          requirements?: Json | null
          stripe_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          api_version: string | null
          created_at: string | null
          data: Json | null
          event_id: string
          event_type: string
          id: string
          idempotency_key: string | null
          livemode: boolean | null
          processed: boolean | null
          processed_at: string | null
          raw_event: Json | null
          request_id: string | null
        }
        Insert: {
          api_version?: string | null
          created_at?: string | null
          data?: Json | null
          event_id: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          livemode?: boolean | null
          processed?: boolean | null
          processed_at?: string | null
          raw_event?: Json | null
          request_id?: string | null
        }
        Update: {
          api_version?: string | null
          created_at?: string | null
          data?: Json | null
          event_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          livemode?: boolean | null
          processed?: boolean | null
          processed_at?: string | null
          raw_event?: Json | null
          request_id?: string | null
        }
        Relationships: []
      }
      stripe_invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          id: string
          metadata: Json | null
          paid: boolean | null
          status: string | null
          stripe_id: string
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          paid?: boolean | null
          status?: string | null
          stripe_id: string
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          paid?: boolean | null
          status?: string | null
          stripe_id?: string
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_refunds: {
        Row: {
          amount: number
          charge_id: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          id: string
          metadata: Json | null
          payment_intent_id: string | null
          reason: string | null
          receipt_number: string | null
          status: string
          stripe_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          charge_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          reason?: string | null
          receipt_number?: string | null
          status: string
          stripe_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          charge_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          payment_intent_id?: string | null
          reason?: string | null
          receipt_number?: string | null
          status?: string
          stripe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          customer_id: string | null
          id: string
          metadata: Json | null
          status: string | null
          stripe_id: string
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          stripe_id: string
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          stripe_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_transactions: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          description: string | null
          id: string
          metadata: Json | null
          payment_method: string | null
          status: string | null
          stripe_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          status?: string | null
          stripe_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          payment_method?: string | null
          status?: string | null
          stripe_id?: string
          updated_at?: string | null
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
      sync_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          operation: string
          records_affected: number | null
          service: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          operation: string
          records_affected?: number | null
          service: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          operation?: string
          records_affected?: number | null
          service?: string
          status?: string
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
      system_metrics: {
        Row: {
          created_at: string
          id: string
          metrics_data: Json
          metrics_type: string
          recorded_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics_data?: Json
          metrics_type: string
          recorded_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics_data?: Json
          metrics_type?: string
          recorded_at?: string
        }
        Relationships: []
      }
      system_preferences: {
        Row: {
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          preference_key: string
          preference_value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
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
      ultimate_truth_events: {
        Row: {
          aligned_at: string | null
          alignment_notes: string | null
          attribution_campaign: string | null
          attribution_medium: string | null
          attribution_source: string | null
          closed_at: string | null
          confidence_score: number | null
          conversion_value: number | null
          created_at: string | null
          currency: string | null
          email: string | null
          event_name: string
          event_time: string
          fb_ad_id: string | null
          fb_adset_id: string | null
          fb_campaign_id: string | null
          first_name: string | null
          has_anytrack: boolean | null
          has_facebook_capi: boolean | null
          has_hubspot: boolean | null
          hubspot_contact_id: string | null
          hubspot_deal_id: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          aligned_at?: string | null
          alignment_notes?: string | null
          attribution_campaign?: string | null
          attribution_medium?: string | null
          attribution_source?: string | null
          closed_at?: string | null
          confidence_score?: number | null
          conversion_value?: number | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          event_name: string
          event_time: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          first_name?: string | null
          has_anytrack?: boolean | null
          has_facebook_capi?: boolean | null
          has_hubspot?: boolean | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          aligned_at?: string | null
          alignment_notes?: string | null
          attribution_campaign?: string | null
          attribution_medium?: string | null
          attribution_source?: string | null
          closed_at?: string | null
          confidence_score?: number | null
          conversion_value?: number | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          event_name?: string
          event_time?: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          first_name?: string | null
          has_anytrack?: boolean | null
          has_facebook_capi?: boolean | null
          has_hubspot?: boolean | null
          hubspot_contact_id?: string | null
          hubspot_deal_id?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
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
      campaign_intelligence: {
        Row: {
          avg_call_attempts_per_lead: number | null
          avg_call_quality_score: number | null
          avg_days_since_last_call: number | null
          avg_deal_value: number | null
          avg_email_opens: number | null
          avg_emails_sent: number | null
          avg_lead_age_days: number | null
          avg_lead_score: number | null
          avg_setter_call_score: number | null
          campaign_decision: string | null
          campaign_health_score: number | null
          campaign_name: string | null
          cold_leads_detected: number | null
          completed_calls: number | null
          converted_leads: number | null
          hot_leads_detected: number | null
          leads_with_deals: number | null
          missed_calls: number | null
          qualified_calls: number | null
          setters_assigned: number | null
          total_appointments_set: number | null
          total_call_attempts: number | null
          total_leads: number | null
          total_revenue: number | null
          unworked_leads: number | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: []
      }
      campaign_lead_attribution: {
        Row: {
          analytics_score: number | null
          call_attempt_count: number | null
          company_name: string | null
          contact_created_at: string | null
          contact_id: string | null
          contact_unworked: boolean | null
          email: string | null
          first_conversion_date: string | null
          first_name: string | null
          first_touch_source: string | null
          last_activity_date: string | null
          last_name: string | null
          last_touch_source: string | null
          latest_traffic_source: string | null
          lead_status: string | null
          lifecycle_stage: string | null
          num_associated_deals: number | null
          num_emails_clicked: number | null
          num_emails_opened: number | null
          num_emails_sent: number | null
          num_form_submissions: number | null
          phone: string | null
          recent_conversion: string | null
          setter_name: string | null
          total_deal_value: number | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          analytics_score?: number | null
          call_attempt_count?: number | null
          company_name?: string | null
          contact_created_at?: string | null
          contact_id?: string | null
          contact_unworked?: boolean | null
          email?: string | null
          first_conversion_date?: string | null
          first_name?: string | null
          first_touch_source?: string | null
          last_activity_date?: string | null
          last_name?: string | null
          last_touch_source?: string | null
          latest_traffic_source?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          num_associated_deals?: number | null
          num_emails_clicked?: number | null
          num_emails_opened?: number | null
          num_emails_sent?: number | null
          num_form_submissions?: number | null
          phone?: string | null
          recent_conversion?: string | null
          setter_name?: string | null
          total_deal_value?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          analytics_score?: number | null
          call_attempt_count?: number | null
          company_name?: string | null
          contact_created_at?: string | null
          contact_id?: string | null
          contact_unworked?: boolean | null
          email?: string | null
          first_conversion_date?: string | null
          first_name?: string | null
          first_touch_source?: string | null
          last_activity_date?: string | null
          last_name?: string | null
          last_touch_source?: string | null
          latest_traffic_source?: string | null
          lead_status?: string | null
          lifecycle_stage?: string | null
          num_associated_deals?: number | null
          num_emails_clicked?: number | null
          num_emails_opened?: number | null
          num_emails_sent?: number | null
          num_form_submissions?: number | null
          phone?: string | null
          recent_conversion?: string | null
          setter_name?: string | null
          total_deal_value?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      campaign_performance: {
        Row: {
          avg_value: number | null
          campaign_id: string | null
          campaign_name: string | null
          checkouts: number | null
          first_event: string | null
          last_event: string | null
          leads: number | null
          medium: string | null
          purchases: number | null
          source: string | null
          total_events: number | null
          total_value: number | null
          unique_leads: number | null
        }
        Relationships: []
      }
      contact_call_performance: {
        Row: {
          appointments_set: number | null
          avg_call_duration: number | null
          avg_call_score: number | null
          avg_sentiment: number | null
          best_call_score: number | null
          cold_leads: number | null
          completed_calls: number | null
          contact_id: string | null
          days_since_last_call: number | null
          email: string | null
          first_call_date: string | null
          hot_leads: number | null
          inbound_calls: number | null
          last_call_date: string | null
          missed_calls: number | null
          not_interested: number | null
          outbound_calls: number | null
          phone: string | null
          qualified_calls: number | null
          setter_name: string | null
          total_calls: number | null
          utm_campaign: string | null
          utm_source: string | null
          warm_leads: number | null
        }
        Relationships: []
      }
      creative_performance: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          appointments_set: number | null
          avg_call_score: number | null
          campaign_id: string | null
          cold_leads: number | null
          completed_calls: number | null
          creative_decision: string | null
          form_id: string | null
          hot_leads: number | null
          lead_status: string | null
          lifecycle_stage: string | null
          qualified_calls: number | null
          setter_name: string | null
          total_calls: number | null
          total_deal_value: number | null
          utm_campaign: string | null
          utm_content: string | null
        }
        Relationships: []
      }
      customer_journey_view: {
        Row: {
          anytrack_events: number | null
          close_risk: string | null
          completed_calls: number | null
          contact_id: string | null
          cycle_length: string | null
          days_since_anytrack: number | null
          days_since_first_touch: number | null
          days_since_last_call: number | null
          days_since_last_touch: number | null
          email: string | null
          first_name: string | null
          first_touch: string | null
          first_touch_source: string | null
          last_name: string | null
          last_touch: string | null
          latest_traffic_source: string | null
          lifecycle_stage: string | null
          total_calls: number | null
          total_touches: number | null
          total_value: number | null
          warning_dont_close: boolean | null
        }
        Relationships: []
      }
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
      facebook_campaign_performance: {
        Row: {
          avg_cpc: number | null
          avg_cpm: number | null
          avg_ctr: number | null
          campaign_id: string | null
          campaign_name: string | null
          daily_budget: number | null
          fb_leads_count: number | null
          first_date: string | null
          last_date: string | null
          last_synced_at: string | null
          lifetime_budget: number | null
          objective: string | null
          status: string | null
          total_clicks: number | null
          total_impressions: number | null
          total_reach: number | null
          total_spend: number | null
        }
        Relationships: []
      }
      facebook_hubspot_crosscheck: {
        Row: {
          avg_deal_value: number | null
          avg_lead_score: number | null
          campaign_name: string | null
          converted_leads: number | null
          fb_campaign_id: string | null
          fb_clicks: number | null
          fb_cost_per_lead: number | null
          fb_cpc: number | null
          fb_ctr: number | null
          fb_impressions: number | null
          fb_last_synced: string | null
          fb_leads_count: number | null
          fb_objective: string | null
          fb_spend: number | null
          fb_status: string | null
          hubspot_conversion_rate: number | null
          hubspot_last_updated: string | null
          hubspot_leads_count: number | null
          lead_count_difference: number | null
          match_status: string | null
          total_revenue: number | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: []
      }
      hubspot_campaign_performance: {
        Row: {
          avg_call_attempts: number | null
          avg_deal_value: number | null
          avg_emails_sent: number | null
          avg_lead_score: number | null
          campaign_name: string | null
          converted_leads: number | null
          first_lead_date: string | null
          hubspot_leads_count: number | null
          last_lead_date: string | null
          total_revenue: number | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: []
      }
      journey_timeline_events: {
        Row: {
          attribution_source: string | null
          campaign_name: string | null
          email: string | null
          event_date: string | null
          event_description: string | null
          event_source: string | null
          event_type: string | null
          event_value: number | null
        }
        Relationships: []
      }
      lead_lifecycle_view: {
        Row: {
          churn_risk_score: number | null
          current_lifecycle_stage: string | null
          current_lifecycle_stage_name: string | null
          days_since_update: number | null
          email: string | null
          first_name: string | null
          first_touch_source: string | null
          health_score: number | null
          health_zone: string | null
          hubspot_contact_id: string | null
          journey_stage_number: number | null
          last_name: string | null
          last_touch_source: string | null
          last_updated_at: string | null
          latest_traffic_source: string | null
          lead_created_at: string | null
          lead_status: string | null
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Relationships: []
      }
      long_cycle_protection: {
        Row: {
          anytrack_events: number | null
          closure_recommendation: string | null
          days_in_cycle: number | null
          days_since_anytrack: number | null
          days_since_call: number | null
          days_since_last_touch: number | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          lifecycle_stage: string | null
          recent_anytrack: boolean | null
          recent_call: boolean | null
          total_calls: number | null
          total_value: number | null
        }
        Relationships: []
      }
      ultimate_truth_dashboard: {
        Row: {
          anytrack_events: number | null
          attribution_source: string | null
          avg_confidence: number | null
          date: string | null
          event_count: number | null
          event_name: string | null
          facebook_events: number | null
          hubspot_events: number | null
          total_value: number | null
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
      calculate_confidence_score:
        | {
            Args: {
              data_points?: number
              recency_days?: number
              source_quality?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_email: string
              p_external_id: string
              p_fbc: string
              p_fbp: string
              p_phone: string
              p_sources_agree: boolean
            }
            Returns: number
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
      check_sync_health: {
        Args: never
        Returns: {
          alert_level: string
          last_success: string
          platform: string
          recent_failures: number
        }[]
      }
      cleanup_old_agent_memory: {
        Args: { retention_days?: number }
        Returns: number
      }
      cleanup_old_logs: { Args: never; Returns: undefined }
      get_all_functions: {
        Args: never
        Returns: {
          function_name: string
          parameter_count: number
          return_type: string
        }[]
      }
      get_all_tables: {
        Args: never
        Returns: {
          column_count: number
          row_estimate: number
          table_name: string
        }[]
      }
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
      get_data_freshness: {
        Args: never
        Returns: {
          hours_since_sync: number
          last_sync: string
          platform: string
          status: string
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
      get_last_admin_review: { Args: never; Returns: string }
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
      get_table_columns: {
        Args: { target_table: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
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
      match_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_memories: {
        Args: {
          filter_thread_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          created_at: string
          id: string
          knowledge_extracted: Json
          query: string
          response: string
          similarity: number
          thread_id: string
        }[]
      }
      normalize_phone: { Args: { phone: string }; Returns: string }
      process_hubspot_webhook: {
        Args: { webhook_payload: Json }
        Returns: Json
      }
      refresh_daily_analytics: { Args: never; Returns: undefined }
      refresh_platform_metrics: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      deal_status: "pending" | "closed" | "cancelled" | "lost"
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
      deal_status: ["pending", "closed", "cancelled", "lost"],
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
