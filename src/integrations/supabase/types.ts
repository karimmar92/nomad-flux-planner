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
      b2b_leads: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          id: string
          message: string
          status: string
          team_size: number | null
          work_email: string
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          team_size?: number | null
          work_email: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          team_size?: number | null
          work_email?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
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
      connections: {
        Row: {
          created_at: string
          id: string
          intro_note: string
          recipient_id: string
          requester_id: string
          status: Database["public"]["Enums"]["connection_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          intro_note: string
          recipient_id: string
          requester_id: string
          status?: Database["public"]["Enums"]["connection_status"]
        }
        Update: {
          created_at?: string
          id?: string
          intro_note?: string
          recipient_id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["connection_status"]
        }
        Relationships: []
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
      documents: {
        Row: {
          country_code: string | null
          created_at: string
          expires_on: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string
          storage_path: string
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          expires_on?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string
          storage_path: string
          title: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          expires_on?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string
          storage_path?: string
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
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
      messages: {
        Row: {
          body: string
          connection_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          connection_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          connection_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          invite_email: string | null
          joined_at: string | null
          left_at: string | null
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_email?: string | null
          joined_at?: string | null
          left_at?: string | null
          org_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_email?: string | null
          joined_at?: string | null
          left_at?: string | null
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_policies: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          max_days: number
          note: string
          org_id: string
          requires_approval: boolean
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          max_days: number
          note?: string
          org_id: string
          requires_approval?: boolean
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          max_days?: number
          note?: string
          org_id?: string
          requires_approval?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          billing_email: string
          created_at: string
          id: string
          name: string
          plan: string
          seats_purchased: number
          updated_at: string
        }
        Insert: {
          billing_email: string
          created_at?: string
          id?: string
          name: string
          plan?: string
          seats_purchased?: number
          updated_at?: string
        }
        Update: {
          billing_email?: string
          created_at?: string
          id?: string
          name?: string
          plan?: string
          seats_purchased?: number
          updated_at?: string
        }
        Relationships: []
      }
      partner_clicks: {
        Row: {
          city_id: string | null
          click_day: string
          created_at: string
          id: string
          partner_id: string
          placement: string
          user_id: string | null
        }
        Insert: {
          city_id?: string | null
          click_day?: string
          created_at?: string
          id?: string
          partner_id: string
          placement: string
          user_id?: string | null
        }
        Update: {
          city_id?: string | null
          click_day?: string
          created_at?: string
          id?: string
          partner_id?: string
          placement?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: string
          avatar_url: string | null
          bio: string | null
          cell_lat: number | null
          cell_lng: number | null
          created_at: string
          display_name: string | null
          free_months_granted: number
          headline: string | null
          heard_about: string | null
          id: string
          last_active_at: string | null
          links: Json
          looking_for: string[]
          plan: string
          radar_city_id: string | null
          referral_code: string
          referral_program: string | null
          referred_at: string | null
          referred_by: string | null
          skills: string[]
          stripe_customer_id: string | null
          timezone: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["radar_visibility"]
        }
        Insert: {
          availability?: string
          avatar_url?: string | null
          bio?: string | null
          cell_lat?: number | null
          cell_lng?: number | null
          created_at?: string
          display_name?: string | null
          free_months_granted?: number
          headline?: string | null
          heard_about?: string | null
          id: string
          last_active_at?: string | null
          links?: Json
          looking_for?: string[]
          plan?: string
          radar_city_id?: string | null
          referral_code: string
          referral_program?: string | null
          referred_at?: string | null
          referred_by?: string | null
          skills?: string[]
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["radar_visibility"]
        }
        Update: {
          availability?: string
          avatar_url?: string | null
          bio?: string | null
          cell_lat?: number | null
          cell_lng?: number | null
          created_at?: string
          display_name?: string | null
          free_months_granted?: number
          headline?: string | null
          heard_about?: string | null
          id?: string
          last_active_at?: string | null
          links?: Json
          looking_for?: string[]
          plan?: string
          radar_city_id?: string | null
          referral_code?: string
          referral_program?: string | null
          referred_at?: string | null
          referred_by?: string | null
          skills?: string[]
          stripe_customer_id?: string | null
          timezone?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["radar_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "radar_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_waitlist: {
        Row: {
          city_id: string
          created_at: string
          email: string
          id: string
        }
        Insert: {
          city_id: string
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
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
      reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          plan: string
          price_id: string | null
          product_id: string | null
          quantity: number
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan?: string
          price_id?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan?: string
          price_id?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      travel_requests: {
        Row: {
          country_code: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          end_date: string
          id: string
          note: string
          org_id: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          end_date: string
          id?: string
          note?: string
          org_id: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          end_date?: string
          id?: string
          note?: string
          org_id?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          city_id: string | null
          country_code: string
          created_at: string
          entry_date: string
          exit_date: string | null
          id: string
          notes: string
          purpose: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city_id?: string | null
          country_code: string
          created_at?: string
          entry_date: string
          exit_date?: string | null
          id?: string
          notes?: string
          purpose?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city_id?: string | null
          country_code?: string
          created_at?: string
          entry_date?: string
          exit_date?: string | null
          id?: string
          notes?: string
          purpose?: string
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "user_referral_rewards_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "radar_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "radar_profiles"
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
      waitlist: {
        Row: {
          city_id: string | null
          created_at: string
          email: string
          feature: string
          id: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          email: string
          feature: string
          id?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          email?: string
          feature?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      org_member_directory: {
        Row: {
          display_name: string | null
          invite_email: string | null
          joined_at: string | null
          member_id: string | null
          org_id: string | null
          role: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_member_presence: {
        Row: {
          country_code: string | null
          entry_date: string | null
          exit_date: string | null
          logged_at: string | null
          org_id: string | null
          trip_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_profiles: {
        Row: {
          availability: string | null
          avatar_url: string | null
          bio: string | null
          cell_lat: number | null
          cell_lng: number | null
          display_name: string | null
          headline: string | null
          id: string | null
          last_active_at: string | null
          links: Json | null
          looking_for: string[] | null
          radar_city_id: string | null
          skills: string[] | null
          timezone: string | null
        }
        Insert: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          cell_lat?: never
          cell_lng?: never
          display_name?: string | null
          headline?: string | null
          id?: string | null
          last_active_at?: never
          links?: Json | null
          looking_for?: string[] | null
          radar_city_id?: string | null
          skills?: string[] | null
          timezone?: string | null
        }
        Update: {
          availability?: string | null
          avatar_url?: string | null
          bio?: string | null
          cell_lat?: never
          cell_lng?: never
          display_name?: string | null
          headline?: string | null
          id?: string | null
          last_active_at?: never
          links?: Json | null
          looking_for?: string[] | null
          radar_city_id?: string | null
          skills?: string[] | null
          timezone?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      caller_bucket_key: { Args: never; Returns: string }
      cell_occupancy: { Args: { _lat: number; _lng: number }; Returns: number }
      creator_balance: {
        Args: { _creator_id: string }
        Returns: {
          available_cents: number
          lifetime_cents: number
          paid_cents: number
          pending_cents: number
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      delete_my_radar_data: { Args: never; Returns: undefined }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      radar_peers: {
        Args: never
        Returns: {
          availability: string
          avatar_url: string
          bio: string
          cell_lat: number
          cell_lng: number
          display_name: string
          headline: string
          id: string
          last_active_at: string
          links: Json
          looking_for: string[]
          radar_city_id: string
          skills: string[]
          timezone: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "creator" | "user"
      connection_status: "pending" | "accepted" | "declined"
      document_type:
        | "passport"
        | "visa_approval"
        | "insurance"
        | "proof_of_address"
        | "onward_ticket"
        | "vaccination"
        | "other"
      radar_visibility: "ghost" | "city" | "radar"
      report_reason:
        | "spam"
        | "harassment"
        | "romantic_advance"
        | "impersonation"
        | "safety_concern"
        | "other"
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
      connection_status: ["pending", "accepted", "declined"],
      document_type: [
        "passport",
        "visa_approval",
        "insurance",
        "proof_of_address",
        "onward_ticket",
        "vaccination",
        "other",
      ],
      radar_visibility: ["ghost", "city", "radar"],
      report_reason: [
        "spam",
        "harassment",
        "romantic_advance",
        "impersonation",
        "safety_concern",
        "other",
      ],
    },
  },
} as const
