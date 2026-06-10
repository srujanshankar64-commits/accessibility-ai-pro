export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          user_id: string
          agency_name: string | null
          agency_logo_url: string | null
          brand_color: string
          gemini_api_key: string | null
          plan: string
          audits_used: number
          audits_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          agency_name?: string | null
          agency_logo_url?: string | null
          brand_color?: string
          gemini_api_key?: string | null
          plan?: string
          audits_used?: number
          audits_limit?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          agency_name?: string | null
          agency_logo_url?: string | null
          brand_color?: string
          gemini_api_key?: string | null
          plan?: string
          audits_used?: number
          audits_limit?: number
          created_at?: string
          updated_at?: string
        }
      }
      audits: {
        Row: {
          id: string
          user_id: string
          url: string
          overall_score: number
          category_scores: Json
          violations: Json
          has_proposal: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          overall_score?: number
          category_scores?: Json
          violations?: Json
          has_proposal?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          overall_score?: number
          category_scores?: Json
          violations?: Json
          has_proposal?: boolean
          created_at?: string
        }
      }
      proposals: {
        Row: {
          id: string
          user_id: string
          audit_id: string | null
          client_name: string | null
          client_industry: string | null
          tone: string
          price_min: number
          price_max: number
          content: Json
          selected_violations: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          audit_id?: string | null
          client_name?: string | null
          client_industry?: string | null
          tone?: string
          price_min?: number
          price_max?: number
          content?: Json
          selected_violations?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          audit_id?: string | null
          client_name?: string | null
          client_industry?: string | null
          tone?: string
          price_min?: number
          price_max?: number
          content?: Json
          selected_violations?: Json
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          dodo_subscription_id: string | null
          dodo_customer_id: string | null
          tier: string
          status: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          cancelled_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          dodo_subscription_id?: string | null
          dodo_customer_id?: string | null
          tier?: string
          status?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          dodo_subscription_id?: string | null
          dodo_customer_id?: string | null
          tier?: string
          status?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          dodo_payment_id: string | null
          dodo_checkout_id: string | null
          amount: number
          currency: string
          status: string
          tier: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          dodo_payment_id?: string | null
          dodo_checkout_id?: string | null
          amount: number
          currency?: string
          status?: string
          tier?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          dodo_payment_id?: string | null
          dodo_checkout_id?: string | null
          amount?: number
          currency?: string
          status?: string
          tier?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
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
  }
}
