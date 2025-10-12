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
      client_health_scores: {
        Row: {
          assigned_coach: string | null
          calculated_at: string | null
          calculation_version: string | null
          churn_risk_score: number | null
          client_segment: string | null
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
        }
        Insert: {
          assigned_coach?: string | null
          calculated_at?: string | null
          calculation_version?: string | null
          churn_risk_score?: number | null
          client_segment?: string | null
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
        }
        Update: {
          assigned_coach?: string | null
          calculated_at?: string | null
          calculation_version?: string | null
          churn_risk_score?: number | null
          client_segment?: string | null
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
        }
        Relationships: []
      }
      coach_performance: {
        Row: {
          avg_health_score: number | null
          clients_declining: number | null
          clients_improving: number | null
          coach_name: string
          created_at: string | null
          green_clients: number | null
          id: number
          purple_clients: number | null
          red_clients: number | null
          report_date: string
          total_clients: number | null
          trend: string | null
          updated_at: string | null
          yellow_clients: number | null
        }
        Insert: {
          avg_health_score?: number | null
          clients_declining?: number | null
          clients_improving?: number | null
          coach_name: string
          created_at?: string | null
          green_clients?: number | null
          id?: number
          purple_clients?: number | null
          red_clients?: number | null
          report_date: string
          total_clients?: number | null
          trend?: string | null
          updated_at?: string | null
          yellow_clients?: number | null
        }
        Update: {
          avg_health_score?: number | null
          clients_declining?: number | null
          clients_improving?: number | null
          coach_name?: string
          created_at?: string | null
          green_clients?: number | null
          id?: number
          purple_clients?: number | null
          red_clients?: number | null
          report_date?: string
          total_clients?: number | null
          trend?: string | null
          updated_at?: string | null
          yellow_clients?: number | null
        }
        Relationships: []
      }
      daily_summary: {
        Row: {
          at_risk_revenue: number | null
          avg_health_score: number | null
          created_at: string | null
          critical_interventions: number | null
          green_clients: number | null
          green_percentage: number | null
          id: number
          purple_clients: number | null
          purple_percentage: number | null
          red_clients: number | null
          red_percentage: number | null
          summary_date: string
          total_active_clients: number | null
          updated_at: string | null
          yellow_clients: number | null
          yellow_percentage: number | null
        }
        Insert: {
          at_risk_revenue?: number | null
          avg_health_score?: number | null
          created_at?: string | null
          critical_interventions?: number | null
          green_clients?: number | null
          green_percentage?: number | null
          id?: number
          purple_clients?: number | null
          purple_percentage?: number | null
          red_clients?: number | null
          red_percentage?: number | null
          summary_date: string
          total_active_clients?: number | null
          updated_at?: string | null
          yellow_clients?: number | null
          yellow_percentage?: number | null
        }
        Update: {
          at_risk_revenue?: number | null
          avg_health_score?: number | null
          created_at?: string | null
          critical_interventions?: number | null
          green_clients?: number | null
          green_percentage?: number | null
          id?: number
          purple_clients?: number | null
          purple_percentage?: number | null
          red_clients?: number | null
          red_percentage?: number | null
          summary_date?: string
          total_active_clients?: number | null
          updated_at?: string | null
          yellow_clients?: number | null
          yellow_percentage?: number | null
        }
        Relationships: []
      }
      intervention_log: {
        Row: {
          ai_recommendation: string | null
          assigned_coach: string | null
          client_id: string
          client_name: string | null
          created_at: string | null
          follow_up_date: string | null
          id: number
          intervention_date: string | null
          intervention_type: string
          notes: string | null
          outcome: string | null
          status: string | null
          success_rating: number | null
          updated_at: string | null
        }
        Insert: {
          ai_recommendation?: string | null
          assigned_coach?: string | null
          client_id: string
          client_name?: string | null
          created_at?: string | null
          follow_up_date?: string | null
          id?: number
          intervention_date?: string | null
          intervention_type: string
          notes?: string | null
          outcome?: string | null
          status?: string | null
          success_rating?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_recommendation?: string | null
          assigned_coach?: string | null
          client_id?: string
          client_name?: string | null
          created_at?: string | null
          follow_up_date?: string | null
          id?: number
          intervention_date?: string | null
          intervention_type?: string
          notes?: string | null
          outcome?: string | null
          status?: string | null
          success_rating?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
