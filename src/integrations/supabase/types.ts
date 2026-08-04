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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      commission_ledger: {
        Row: {
          amount_cents: number
          available_at: string
          created_at: string
          creator_id: string
          currency: string
          id: string
          note: string | null
          referred_user_id: string | null
          status: string
          stripe_invoice_id: string | null
          type: string
        }
        Insert: {
          amount_cents: number
          available_at?: string
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          note?: string | null
          referred_user_id?: string | null
          status: string
          stripe_invoice_id?: string | null
          type: string
        }
        Update: {
          amount_cents?: number
          available_at?: string
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          note?: string | null
          referred_user_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_applications: {
        Row: {
          audience_description: string
          audience_size: number | null
          channel_url: string | null
          contact_email: string
          created_at: string
          id: string
          pitch: string | null
          primary_channel: string
          review_note: string | null
          reviewed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience_description: string
          audience_size?: number | null
          channel_url?: string | null
          contact_email: string
          created_at?: string
          id?: string
          pitch?: string | null
          primary_channel: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience_description?: string
          audience_size?: number | null
          channel_url?: string | null
          contact_email?: string
          created_at?: string
          id?: string
          pitch?: string | null
          primary_channel?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_payouts: {
        Row: {
          amount_cents: number
          created_at: string
          creator_id: string
          currency: string
          id: string
          period_end: string | null
          period_start: string | null
          status: string
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          approved_at: string
          code: string
          created_at: string
          id: string
          payouts_enabled: boolean
          status: string
          stripe_connect_account_id: string | null
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string
          code: string
          created_at?: string
          id?: string
          payouts_enabled?: boolean
          status?: string
          stripe_connect_account_id?: string | null
          terms_version?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string
          code?: string
          created_at?: string
          id?: string
          payouts_enabled?: boolean
          status?: string
          stripe_connect_account_id?: string | null
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          creator_id: string | null
          detail: Json
          id: string
          kind: string
          referred_user_id: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id?: string | null
          detail?: Json
          id?: string
          kind: string
          referred_user_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string | null
          detail?: Json
          id?: string
          kind?: string
          referred_user_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          free_months_granted: number
          heard_about: string | null
          id: string
          plan: string
          referral_code: string
          referral_program: string | null
          referred_at: string | null
          referred_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          free_months_granted?: number
          heard_about?: string | null
          id: string
          plan?: string
          referral_code: string
          referral_program?: string | null
          referred_at?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          free_months_granted?: number
          heard_about?: string | null
          id?: string
          plan?: string
          referral_code?: string
          referral_program?: string | null
          referred_at?: string | null
          referred_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          code: string
          created_at: string
          id: string
          landing_path: string | null
          program: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          landing_path?: string | null
          program: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          landing_path?: string | null
          program?: string
        }
        Relationships: []
      }
      user_referral_rewards: {
        Row: {
          created_at: string
          eligible_at: string
          free_months: number
          granted_at: string | null
          id: string
          referred_user_id: string
          referrer_id: string
          side: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligible_at?: string
          free_months?: number
          granted_at?: string | null
          id?: string
          referred_user_id: string
          referrer_id: string
          side: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligible_at?: string
          free_months?: number
          granted_at?: string | null
          id?: string
          referred_user_id?: string
          referrer_id?: string
          side?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_referral_rewards_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      creator_balance: {
        Args: { _creator_id: string }
        Returns: {
          available_cents: number
          lifetime_cents: number
          paid_cents: number
          pending_cents: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "creator" | "user"
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
      app_role: ["admin", "creator", "user"],
    },
  },
} as const
