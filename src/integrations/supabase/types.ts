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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_jobs: {
        Row: {
          created_at: string | null
          current_step: string | null
          error_message: string | null
          id: string
          progress_log: Json | null
          progress_percent: number | null
          result: Json | null
          status: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          progress_log?: Json | null
          progress_percent?: number | null
          result?: Json | null
          status?: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_step?: string | null
          error_message?: string | null
          id?: string
          progress_log?: Json | null
          progress_percent?: number | null
          result?: Json | null
          status?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      audits: {
        Row: {
          auto_reaudit_enabled: boolean | null
          category_scores: Json | null
          competitor_audit_id: string | null
          competitor_url: string | null
          created_at: string | null
          has_competitor_benchmark: boolean | null
          has_proposal: boolean | null
          id: string
          is_parent: boolean | null
          last_reaudited_at: string | null
          overall_score: number | null
          parent_audit_id: string | null
          previous_score: number | null
          raw_html: string | null
          reaudit_frequency_days: number | null
          remediation_roadmap: Json | null
          score_drop_threshold: number | null
          status: string | null
          total_pages: number | null
          url: string
          user_id: string | null
          violations: Json | null
        }
        Insert: {
          auto_reaudit_enabled?: boolean | null
          category_scores?: Json | null
          competitor_audit_id?: string | null
          competitor_url?: string | null
          created_at?: string | null
          has_competitor_benchmark?: boolean | null
          has_proposal?: boolean | null
          id?: string
          is_parent?: boolean | null
          last_reaudited_at?: string | null
          overall_score?: number | null
          parent_audit_id?: string | null
          previous_score?: number | null
          raw_html?: string | null
          reaudit_frequency_days?: number | null
          remediation_roadmap?: Json | null
          score_drop_threshold?: number | null
          status?: string | null
          total_pages?: number | null
          url: string
          user_id?: string | null
          violations?: Json | null
        }
        Update: {
          auto_reaudit_enabled?: boolean | null
          category_scores?: Json | null
          competitor_audit_id?: string | null
          competitor_url?: string | null
          created_at?: string | null
          has_competitor_benchmark?: boolean | null
          has_proposal?: boolean | null
          id?: string
          is_parent?: boolean | null
          last_reaudited_at?: string | null
          overall_score?: number | null
          parent_audit_id?: string | null
          previous_score?: number | null
          raw_html?: string | null
          reaudit_frequency_days?: number | null
          remediation_roadmap?: Json | null
          score_drop_threshold?: number | null
          status?: string | null
          total_pages?: number | null
          url?: string
          user_id?: string | null
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audits_competitor_audit_id_fkey"
            columns: ["competitor_audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_health: {
        Row: {
          id: number
          job_name: string | null
          last_run: string | null
          status: string | null
        }
        Insert: {
          id?: number
          job_name?: string | null
          last_run?: string | null
          status?: string | null
        }
        Update: {
          id?: number
          job_name?: string | null
          last_run?: string | null
          status?: string | null
        }
        Relationships: []
      }
      email_drafts: {
        Row: {
          audit_id: string | null
          body: string | null
          created_at: string | null
          id: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          audit_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          audit_id?: string | null
          body?: string | null
          created_at?: string | null
          id?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_name: string | null
          audits_used_this_month: number | null
          billing_cycle_start: string | null
          brand_color: string | null
          created_at: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          plan: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          agency_name?: string | null
          audits_used_this_month?: number | null
          billing_cycle_start?: string | null
          brand_color?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          agency_name?: string | null
          audits_used_this_month?: number | null
          billing_cycle_start?: string | null
          brand_color?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          plan?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          audit_id: string | null
          client_name: string | null
          created_at: string | null
          id: string
          pdf_url: string | null
          price_max: number | null
          price_min: number | null
          proposal_text: string | null
          user_id: string | null
        }
        Insert: {
          audit_id?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          price_max?: number | null
          price_min?: number | null
          proposal_text?: string | null
          user_id?: string | null
        }
        Update: {
          audit_id?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          price_max?: number | null
          price_min?: number | null
          proposal_text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code: string
          referrer_id: string
          total_clicks: number | null
          total_earned_months: number | null
          total_signups: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code: string
          referrer_id: string
          total_clicks?: number | null
          total_earned_months?: number | null
          total_signups?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code?: string
          referrer_id?: string
          total_clicks?: number | null
          total_earned_months?: number | null
          total_signups?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          agency_logo_url: string | null
          agency_name: string | null
          audits_limit: number | null
          audits_used: number | null
          brand_color: string | null
          created_at: string | null
          gemini_api_key: string | null
          plan: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_logo_url?: string | null
          agency_name?: string | null
          audits_limit?: number | null
          audits_used?: number | null
          brand_color?: string | null
          created_at?: string | null
          gemini_api_key?: string | null
          plan?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_logo_url?: string | null
          agency_name?: string | null
          audits_limit?: number | null
          audits_used?: number | null
          brand_color?: string | null
          created_at?: string | null
          gemini_api_key?: string | null
          plan?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_audit_jobs: { Args: never; Returns: undefined }
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
