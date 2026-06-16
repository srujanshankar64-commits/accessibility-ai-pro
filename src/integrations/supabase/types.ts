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
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          progress_log: Json
          progress_percent: number
          result: Json | null
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          progress_log?: Json
          progress_percent?: number
          result?: Json | null
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          progress_log?: Json
          progress_percent?: number
          result?: Json | null
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      audits: {
        Row: {
          category_scores: Json
          created_at: string
          has_proposal: boolean
          id: string
          overall_score: number
          url: string
          user_id: string
          violations: Json
        }
        Insert: {
          category_scores?: Json
          created_at?: string
          has_proposal?: boolean
          id?: string
          overall_score?: number
          url: string
          user_id: string
          violations?: Json
        }
        Update: {
          category_scores?: Json
          created_at?: string
          has_proposal?: boolean
          id?: string
          overall_score?: number
          url?: string
          user_id?: string
          violations?: Json
        }
        Relationships: []
      }
      proposals: {
        Row: {
          audit_id: string | null
          client_industry: string | null
          client_name: string | null
          content: Json
          created_at: string
          id: string
          price_max: number | null
          price_min: number | null
          selected_violations: Json
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_id?: string | null
          client_industry?: string | null
          client_name?: string | null
          content?: Json
          created_at?: string
          id?: string
          price_max?: number | null
          price_min?: number | null
          selected_violations?: Json
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_id?: string | null
          client_industry?: string | null
          client_name?: string | null
          content?: Json
          created_at?: string
          id?: string
          price_max?: number | null
          price_min?: number | null
          selected_violations?: Json
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          agency_logo_url: string | null
          agency_name: string | null
          audits_limit: number
          audits_used: number
          brand_color: string | null
          created_at: string
          gemini_api_key: string | null
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_logo_url?: string | null
          agency_name?: string | null
          audits_limit?: number
          audits_used?: number
          brand_color?: string | null
          created_at?: string
          gemini_api_key?: string | null
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_logo_url?: string | null
          agency_name?: string | null
          audits_limit?: number
          audits_used?: number
          brand_color?: string | null
          created_at?: string
          gemini_api_key?: string | null
          plan?: string
          updated_at?: string
          user_id?: string
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
