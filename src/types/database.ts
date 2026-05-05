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
  public: {
    Tables: {
      accounting_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          is_connected: boolean
          last_sync_at: string | null
          org_id: string
          provider: string
          realm_id: string | null
          refresh_token: string | null
          settings: Json
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          org_id: string
          provider?: string
          realm_id?: string | null
          refresh_token?: string | null
          settings?: Json
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          org_id?: string
          provider?: string
          realm_id?: string | null
          refresh_token?: string | null
          settings?: Json
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_sync_log: {
        Row: {
          created_at: string
          data: Json | null
          error: string | null
          id: string
          org_id: string
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          error?: string | null
          id?: string
          org_id: string
          status?: string
          sync_type: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          error?: string | null
          id?: string
          org_id?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sync_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          org_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          org_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          org_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          category: string
          comparison_text: string | null
          details: string | null
          feedback: string | null
          generated_at: string
          id: string
          is_dismissed: boolean
          location_id: string
          metric_value: string | null
          org_id: string
          priority: string
          summary: string
          title: string
        }
        Insert: {
          category: string
          comparison_text?: string | null
          details?: string | null
          feedback?: string | null
          generated_at?: string
          id?: string
          is_dismissed?: boolean
          location_id: string
          metric_value?: string | null
          org_id: string
          priority?: string
          summary: string
          title: string
        }
        Update: {
          category?: string
          comparison_text?: string | null
          details?: string | null
          feedback?: string | null
          generated_at?: string
          id?: string
          is_dismissed?: boolean
          location_id?: string
          metric_value?: string | null
          org_id?: string
          priority?: string
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_predictions: {
        Row: {
          actual_covers: number | null
          actual_revenue: number | null
          confidence: number | null
          created_at: string
          id: string
          location_id: string
          org_id: string
          predicted_covers: number | null
          predicted_labor_hours: number | null
          predicted_revenue: number | null
          prediction_date: string
        }
        Insert: {
          actual_covers?: number | null
          actual_revenue?: number | null
          confidence?: number | null
          created_at?: string
          id?: string
          location_id: string
          org_id: string
          predicted_covers?: number | null
          predicted_labor_hours?: number | null
          predicted_revenue?: number | null
          prediction_date: string
        }
        Update: {
          actual_covers?: number | null
          actual_revenue?: number | null
          confidence?: number | null
          created_at?: string
          id?: string
          location_id?: string
          org_id?: string
          predicted_covers?: number | null
          predicted_labor_hours?: number | null
          predicted_revenue?: number | null
          prediction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_predictions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_predictions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          ask_enabled: boolean
          created_at: string
          daily_query_limit: number
          id: string
          insight_delivery: string
          insight_frequency: string
          insights_enabled: boolean
          monthly_cost_alert_cents: number
          org_id: string
          predict_enabled: boolean
          updated_at: string
        }
        Insert: {
          ask_enabled?: boolean
          created_at?: string
          daily_query_limit?: number
          id?: string
          insight_delivery?: string
          insight_frequency?: string
          insights_enabled?: boolean
          monthly_cost_alert_cents?: number
          org_id: string
          predict_enabled?: boolean
          updated_at?: string
        }
        Update: {
          ask_enabled?: boolean
          created_at?: string
          daily_query_limit?: number
          id?: string
          insight_delivery?: string
          insight_frequency?: string
          insights_enabled?: boolean
          monthly_cost_alert_cents?: number
          org_id?: string
          predict_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          estimated_cost: number
          id: string
          org_id: string
          query_type: string
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          id?: string
          org_id: string
          query_type?: string
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          id?: string
          org_id?: string
          query_type?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          location_id: string | null
          manager_pin_user_id: string | null
          new_state: Json | null
          org_id: string
          previous_state: Json | null
          reason: string | null
          terminal_id: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          location_id?: string | null
          manager_pin_user_id?: string | null
          new_state?: Json | null
          org_id: string
          previous_state?: Json | null
          reason?: string | null
          terminal_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          location_id?: string | null
          manager_pin_user_id?: string | null
          new_state?: Json | null
          org_id?: string
          previous_state?: Json | null
          reason?: string | null
          terminal_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_manager_pin_user_id_fkey"
            columns: ["manager_pin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      break_entries: {
        Row: {
          break_type: string
          created_at: string
          duration_minutes: number | null
          end_time: string | null
          id: string
          start_time: string
          time_entry_id: string
        }
        Insert: {
          break_type?: string
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          start_time: string
          time_entry_id: string
        }
        Update: {
          break_type?: string
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          start_time?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_entries_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          bounce_reason: string | null
          campaign_id: string
          channel: string
          click_count: number
          clicked_at: string | null
          clicked_url: string | null
          created_at: string | null
          customer_id: string
          id: string
          open_count: number
          opened_at: string | null
          org_id: string
          resend_message_id: string | null
          sent_at: string | null
          status: string
          tracking_id: string
          updated_at: string | null
        }
        Insert: {
          bounce_reason?: string | null
          campaign_id: string
          channel: string
          click_count?: number
          clicked_at?: string | null
          clicked_url?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          open_count?: number
          opened_at?: string | null
          org_id: string
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          tracking_id?: string
          updated_at?: string | null
        }
        Update: {
          bounce_reason?: string | null
          campaign_id?: string
          channel?: string
          click_count?: number
          clicked_at?: string | null
          clicked_url?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          open_count?: number
          opened_at?: string | null
          org_id?: string
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          tracking_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string | null
          campaign_type: string
          clicked_count: number | null
          created_at: string | null
          created_by: string
          discount_id: string | null
          id: string
          name: string
          opened_count: number | null
          org_id: string
          recipients_count: number | null
          redeemed_count: number | null
          requires_approval: boolean
          scheduled_for: string | null
          sent_at: string | null
          sms_body: string | null
          status: string
          subject: string | null
          target_count: number | null
          target_segment: Json
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          campaign_type: string
          clicked_count?: number | null
          created_at?: string | null
          created_by: string
          discount_id?: string | null
          id?: string
          name: string
          opened_count?: number | null
          org_id: string
          recipients_count?: number | null
          redeemed_count?: number | null
          requires_approval?: boolean
          scheduled_for?: string | null
          sent_at?: string | null
          sms_body?: string | null
          status?: string
          subject?: string | null
          target_count?: number | null
          target_segment: Json
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          campaign_type?: string
          clicked_count?: number | null
          created_at?: string | null
          created_by?: string
          discount_id?: string | null
          id?: string
          name?: string
          opened_count?: number | null
          org_id?: string
          recipients_count?: number | null
          redeemed_count?: number | null
          requires_approval?: boolean
          scheduled_for?: string | null
          sent_at?: string | null
          sms_body?: string | null
          status?: string
          subject?: string | null
          target_count?: number | null
          target_segment?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawer_events: {
        Row: {
          amount: number
          cash_drawer_id: string
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["cash_drawer_event_type"]
          id: string
          order_id: string | null
          payment_id: string | null
          performed_by: string
          running_total: number
        }
        Insert: {
          amount: number
          cash_drawer_id: string
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["cash_drawer_event_type"]
          id?: string
          order_id?: string | null
          payment_id?: string | null
          performed_by: string
          running_total: number
        }
        Update: {
          amount?: number
          cash_drawer_id?: string
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["cash_drawer_event_type"]
          id?: string
          order_id?: string | null
          payment_id?: string | null
          performed_by?: string
          running_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawer_events_cash_drawer_id_fkey"
            columns: ["cash_drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawer_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawer_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawer_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawers: {
        Row: {
          actual_cash: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          current_cash: number | null
          expected_cash: number | null
          id: string
          is_open: boolean
          location_id: string
          name: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          org_id: string
          over_short: number | null
          starting_cash: number | null
          terminal_id: string | null
          updated_at: string
        }
        Insert: {
          actual_cash?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          current_cash?: number | null
          expected_cash?: number | null
          id?: string
          is_open?: boolean
          location_id: string
          name?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          org_id: string
          over_short?: number | null
          starting_cash?: number | null
          terminal_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_cash?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          current_cash?: number | null
          expected_cash?: number | null
          id?: string
          is_open?: boolean
          location_id?: string
          name?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          org_id?: string
          over_short?: number | null
          starting_cash?: number | null
          terminal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawers_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_tip_reports: {
        Row: {
          id: string
          org_id: string
          reported_amount: number
          reported_at: string
          shift_date: string
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          reported_amount: number
          reported_at?: string
          shift_date: string
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          reported_amount?: number
          reported_at?: string
          shift_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_tip_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_tip_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_events: {
        Row: {
          catering_menu_id: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          deposit_amount: number | null
          deposit_paid_at: string | null
          end_time: string | null
          event_date: string
          event_name: string
          event_time: string | null
          guest_count: number
          id: string
          location_id: string
          notes: string | null
          order_id: string | null
          org_id: string
          service_charge: number | null
          special_requirements: string | null
          status: string
          subtotal: number | null
          tax_total: number | null
          total: number | null
          updated_at: string
          venue_address: Json | null
          venue_name: string | null
        }
        Insert: {
          catering_menu_id?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          end_time?: string | null
          event_date: string
          event_name: string
          event_time?: string | null
          guest_count: number
          id?: string
          location_id: string
          notes?: string | null
          order_id?: string | null
          org_id: string
          service_charge?: number | null
          special_requirements?: string | null
          status?: string
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string
          venue_address?: Json | null
          venue_name?: string | null
        }
        Update: {
          catering_menu_id?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          end_time?: string | null
          event_date?: string
          event_name?: string
          event_time?: string | null
          guest_count?: number
          id?: string
          location_id?: string
          notes?: string | null
          order_id?: string | null
          org_id?: string
          service_charge?: number | null
          special_requirements?: string | null
          status?: string
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string
          venue_address?: Json | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catering_events_catering_menu_id_fkey"
            columns: ["catering_menu_id"]
            isOneToOne: false
            referencedRelation: "catering_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catering_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catering_menus: {
        Row: {
          base_price_per_person: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          items: Json
          max_guest_count: number | null
          min_guest_count: number | null
          name: string
          org_id: string
          pricing_model: string
          service_charge_percentage: number | null
          updated_at: string
        }
        Insert: {
          base_price_per_person?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          max_guest_count?: number | null
          min_guest_count?: number | null
          name: string
          org_id: string
          pricing_model?: string
          service_charge_percentage?: number | null
          updated_at?: string
        }
        Update: {
          base_price_per_person?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          max_guest_count?: number | null
          min_guest_count?: number | null
          name?: string
          org_id?: string
          pricing_model?: string
          service_charge_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catering_menus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chargebacks: {
        Row: {
          amount: number
          created_at: string
          evidence: Json | null
          evidence_submitted_at: string | null
          id: string
          org_id: string
          payment_id: string | null
          processor_dispute_id: string
          reason_code: string
          reason_description: string | null
          received_at: string
          resolution: string | null
          resolved_at: string | null
          respond_by: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          evidence?: Json | null
          evidence_submitted_at?: string | null
          id?: string
          org_id: string
          payment_id?: string | null
          processor_dispute_id: string
          reason_code: string
          reason_description?: string | null
          received_at: string
          resolution?: string | null
          resolved_at?: string | null
          respond_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          evidence?: Json | null
          evidence_submitted_at?: string | null
          id?: string
          org_id?: string
          payment_id?: string | null
          processor_dispute_id?: string
          reason_code?: string
          reason_description?: string | null
          received_at?: string
          resolution?: string | null
          resolved_at?: string | null
          respond_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chargebacks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chargebacks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          state: string
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          state: string
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          state?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_methods: {
        Row: {
          card_brand: string
          card_last_four: string
          cardholder_name: string | null
          created_at: string
          customer_id: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_used_at: string | null
          org_id: string
          processor_card_token: string
          processor_customer_id: string | null
          processor_name: string
        }
        Insert: {
          card_brand: string
          card_last_four: string
          cardholder_name?: string | null
          created_at?: string
          customer_id: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          org_id: string
          processor_card_token: string
          processor_customer_id?: string | null
          processor_name: string
        }
        Update: {
          card_brand?: string
          card_last_four?: string
          cardholder_name?: string | null
          created_at?: string
          customer_id?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          org_id?: string
          processor_card_token?: string
          processor_customer_id?: string | null
          processor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payment_methods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          allergies: string[] | null
          anniversary: string | null
          average_check: number
          birthday: string | null
          created_at: string
          deleted_at: string | null
          dietary_preferences: string[] | null
          email: string | null
          first_name: string | null
          id: string
          is_vip: boolean | null
          last_name: string | null
          last_visit_at: string | null
          marketing_opt_in: boolean
          notes: string | null
          org_id: string
          phone: string | null
          tags: string[] | null
          total_spend: number | null
          total_spent: number
          total_visits: number
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          allergies?: string[] | null
          anniversary?: string | null
          average_check?: number
          birthday?: string | null
          created_at?: string
          deleted_at?: string | null
          dietary_preferences?: string[] | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_vip?: boolean | null
          last_name?: string | null
          last_visit_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          org_id: string
          phone?: string | null
          tags?: string[] | null
          total_spend?: number | null
          total_spent?: number
          total_visits?: number
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          allergies?: string[] | null
          anniversary?: string | null
          average_check?: number
          birthday?: string | null
          created_at?: string
          deleted_at?: string | null
          dietary_preferences?: string[] | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_vip?: boolean | null
          last_name?: string | null
          last_visit_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          org_id?: string
          phone?: string | null
          tags?: string[] | null
          total_spend?: number | null
          total_spent?: number
          total_visits?: number
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_item_metrics: {
        Row: {
          food_cost: number | null
          gross_revenue: number | null
          id: string
          location_id: string
          margin_percentage: number | null
          menu_item_id: string
          metric_date: string
          org_id: string
          quantity_sold: number | null
        }
        Insert: {
          food_cost?: number | null
          gross_revenue?: number | null
          id?: string
          location_id: string
          margin_percentage?: number | null
          menu_item_id: string
          metric_date: string
          org_id: string
          quantity_sold?: number | null
        }
        Update: {
          food_cost?: number | null
          gross_revenue?: number | null
          id?: string
          location_id?: string
          margin_percentage?: number | null
          menu_item_id?: string
          metric_date?: string
          org_id?: string
          quantity_sold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_item_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_item_metrics_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_item_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          average_check: number | null
          avg_table_turn_minutes: number | null
          avg_ticket_time_seconds: number | null
          calculated_at: string | null
          card_total: number | null
          cash_total: number | null
          comp_total: number | null
          covers: number | null
          delivery_revenue: number | null
          dine_in_revenue: number | null
          discount_total: number | null
          food_cost: number | null
          food_cost_percentage: number | null
          gift_card_total: number | null
          hourly_covers: Json | null
          hourly_revenue: Json | null
          id: string
          labor_cost: number | null
          labor_hours: number | null
          labor_percentage: number | null
          location_id: string
          metric_date: string
          net_revenue: number | null
          online_revenue: number | null
          order_count: number | null
          org_id: string
          refund_total: number | null
          revenue_per_cover: number | null
          takeout_revenue: number | null
          tip_total: number | null
          total_revenue: number | null
          void_total: number | null
        }
        Insert: {
          average_check?: number | null
          avg_table_turn_minutes?: number | null
          avg_ticket_time_seconds?: number | null
          calculated_at?: string | null
          card_total?: number | null
          cash_total?: number | null
          comp_total?: number | null
          covers?: number | null
          delivery_revenue?: number | null
          dine_in_revenue?: number | null
          discount_total?: number | null
          food_cost?: number | null
          food_cost_percentage?: number | null
          gift_card_total?: number | null
          hourly_covers?: Json | null
          hourly_revenue?: Json | null
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          labor_percentage?: number | null
          location_id: string
          metric_date: string
          net_revenue?: number | null
          online_revenue?: number | null
          order_count?: number | null
          org_id: string
          refund_total?: number | null
          revenue_per_cover?: number | null
          takeout_revenue?: number | null
          tip_total?: number | null
          total_revenue?: number | null
          void_total?: number | null
        }
        Update: {
          average_check?: number | null
          avg_table_turn_minutes?: number | null
          avg_ticket_time_seconds?: number | null
          calculated_at?: string | null
          card_total?: number | null
          cash_total?: number | null
          comp_total?: number | null
          covers?: number | null
          delivery_revenue?: number | null
          dine_in_revenue?: number | null
          discount_total?: number | null
          food_cost?: number | null
          food_cost_percentage?: number | null
          gift_card_total?: number | null
          hourly_covers?: Json | null
          hourly_revenue?: Json | null
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          labor_percentage?: number | null
          location_id?: string
          metric_date?: string
          net_revenue?: number | null
          online_revenue?: number | null
          order_count?: number | null
          org_id?: string
          refund_total?: number | null
          revenue_per_cover?: number | null
          takeout_revenue?: number | null
          tip_total?: number | null
          total_revenue?: number | null
          void_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reconciliations: {
        Row: {
          amex_total: number | null
          auto_gratuity_total: number | null
          business_date: string
          cash_counted: number | null
          cash_expected: number | null
          cash_tips_reported: number | null
          cash_total: number | null
          cash_variance: number | null
          cc_tips: number | null
          closed_at: string | null
          closed_by: string | null
          comp_total: number | null
          created_at: string
          credit_card_total: number | null
          discount_total: number | null
          discover_total: number | null
          estimated_processing_fee: number | null
          gift_card_total: number | null
          gross_sales: number
          house_account_total: number | null
          id: string
          location_id: string
          mastercard_total: number | null
          net_sales: number
          notes: string | null
          org_id: string
          refund_total: number | null
          surcharge_total: number | null
          tax_collected: number
          visa_total: number | null
          void_total: number | null
        }
        Insert: {
          amex_total?: number | null
          auto_gratuity_total?: number | null
          business_date: string
          cash_counted?: number | null
          cash_expected?: number | null
          cash_tips_reported?: number | null
          cash_total?: number | null
          cash_variance?: number | null
          cc_tips?: number | null
          closed_at?: string | null
          closed_by?: string | null
          comp_total?: number | null
          created_at?: string
          credit_card_total?: number | null
          discount_total?: number | null
          discover_total?: number | null
          estimated_processing_fee?: number | null
          gift_card_total?: number | null
          gross_sales: number
          house_account_total?: number | null
          id?: string
          location_id: string
          mastercard_total?: number | null
          net_sales: number
          notes?: string | null
          org_id: string
          refund_total?: number | null
          surcharge_total?: number | null
          tax_collected: number
          visa_total?: number | null
          void_total?: number | null
        }
        Update: {
          amex_total?: number | null
          auto_gratuity_total?: number | null
          business_date?: string
          cash_counted?: number | null
          cash_expected?: number | null
          cash_tips_reported?: number | null
          cash_total?: number | null
          cash_variance?: number | null
          cc_tips?: number | null
          closed_at?: string | null
          closed_by?: string | null
          comp_total?: number | null
          created_at?: string
          credit_card_total?: number | null
          discount_total?: number | null
          discover_total?: number | null
          estimated_processing_fee?: number | null
          gift_card_total?: number | null
          gross_sales?: number
          house_account_total?: number | null
          id?: string
          location_id?: string
          mastercard_total?: number | null
          net_sales?: number
          notes?: string | null
          org_id?: string
          refund_total?: number | null
          surcharge_total?: number | null
          tax_collected?: number
          visa_total?: number | null
          void_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reconciliations_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reconciliations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reconciliations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          actual_delivery_at: string | null
          created_at: string | null
          delivery_address: Json
          delivery_fee: number
          delivery_instructions: string | null
          delivery_time: string | null
          driver_id: string | null
          driver_lat: number | null
          driver_lng: number | null
          driver_tip: number | null
          estimated_delivery_at: string | null
          id: string
          last_location_at: string | null
          order_id: string
          org_id: string
          pickup_time: string | null
          proof_of_delivery_url: string | null
          signature_url: string | null
          status: string
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          actual_delivery_at?: string | null
          created_at?: string | null
          delivery_address: Json
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_time?: string | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_tip?: number | null
          estimated_delivery_at?: string | null
          id?: string
          last_location_at?: string | null
          order_id: string
          org_id: string
          pickup_time?: string | null
          proof_of_delivery_url?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          actual_delivery_at?: string | null
          created_at?: string | null
          delivery_address?: Json
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_time?: string | null
          driver_id?: string | null
          driver_lat?: number | null
          driver_lng?: number | null
          driver_tip?: number | null
          estimated_delivery_at?: string | null
          id?: string
          last_location_at?: string | null
          order_id?: string
          org_id?: string
          pickup_time?: string | null
          proof_of_delivery_url?: string | null
          signature_url?: string | null
          status?: string
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string | null
          delivery_fee: number
          estimated_minutes: number | null
          id: string
          is_active: boolean | null
          location_id: string
          min_order_amount: number | null
          name: string
          org_id: string
          zone_polygon: Json
        }
        Insert: {
          created_at?: string | null
          delivery_fee?: number
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          location_id: string
          min_order_amount?: number | null
          name: string
          org_id: string
          zone_polygon: Json
        }
        Update: {
          created_at?: string | null
          delivery_fee?: number
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          min_order_amount?: number | null
          name?: string
          org_id?: string
          zone_polygon?: Json
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          contact_name: string
          created_at: string
          current_pos: string | null
          email: string
          id: string
          locations_count: number | null
          phone: string | null
          restaurant_name: string
          source_page: string | null
          utm_params: Json | null
        }
        Insert: {
          contact_name: string
          created_at?: string
          current_pos?: string | null
          email: string
          id?: string
          locations_count?: number | null
          phone?: string | null
          restaurant_name: string
          source_page?: string | null
          utm_params?: Json | null
        }
        Update: {
          contact_name?: string
          created_at?: string
          current_pos?: string | null
          email?: string
          id?: string
          locations_count?: number | null
          phone?: string | null
          restaurant_name?: string
          source_page?: string | null
          utm_params?: Json | null
        }
        Relationships: []
      }
      digital_menu_boards: {
        Row: {
          board_type: string
          brightness_schedule: Json | null
          category_ids: string[] | null
          created_at: string
          display_layout: Json
          id: string
          is_active: boolean
          last_sync_at: string | null
          location_id: string
          name: string
          org_id: string
          rotation_interval_seconds: number | null
          updated_at: string
        }
        Insert: {
          board_type: string
          brightness_schedule?: Json | null
          category_ids?: string[] | null
          created_at?: string
          display_layout?: Json
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          location_id: string
          name: string
          org_id: string
          rotation_interval_seconds?: number | null
          updated_at?: string
        }
        Update: {
          board_type?: string
          brightness_schedule?: Json | null
          category_ids?: string[] | null
          created_at?: string
          display_layout?: Json
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          location_id?: string
          name?: string
          org_id?: string
          rotation_interval_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_menu_boards_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_menu_boards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          applies_to: string
          available_days: number[] | null
          available_end_time: string | null
          available_start_time: string | null
          category_ids: string[] | null
          created_at: string
          deleted_at: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          end_date: string | null
          fixed_amount: number | null
          id: string
          is_active: boolean
          item_ids: string[] | null
          max_discount_amount: number | null
          min_order_amount: number | null
          name: string
          org_id: string
          percentage: number | null
          promo_code: string | null
          requires_manager_approval: boolean
          start_date: string | null
          updated_at: string
        }
        Insert: {
          applies_to?: string
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          category_ids?: string[] | null
          created_at?: string
          deleted_at?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          end_date?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          item_ids?: string[] | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          name: string
          org_id: string
          percentage?: number | null
          promo_code?: string | null
          requires_manager_approval?: boolean
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          applies_to?: string
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          category_ids?: string[] | null
          created_at?: string
          deleted_at?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          end_date?: string | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          item_ids?: string[] | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          name?: string
          org_id?: string
          percentage?: number | null
          promo_code?: string | null
          requires_manager_approval?: boolean
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_thru_cars: {
        Row: {
          created_at: string | null
          entered_at: string | null
          exited_at: string | null
          id: string
          lane_id: string
          order_id: string | null
          order_placed_at: string | null
          org_id: string
          payment_at: string | null
          pickup_at: string | null
          position: number | null
        }
        Insert: {
          created_at?: string | null
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          lane_id: string
          order_id?: string | null
          order_placed_at?: string | null
          org_id: string
          payment_at?: string | null
          pickup_at?: string | null
          position?: number | null
        }
        Update: {
          created_at?: string | null
          entered_at?: string | null
          exited_at?: string | null
          id?: string
          lane_id?: string
          order_id?: string | null
          order_placed_at?: string | null
          org_id?: string
          payment_at?: string | null
          pickup_at?: string | null
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_thru_cars_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "drive_thru_lanes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_thru_cars_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_thru_cars_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_thru_lanes: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          location_id: string | null
          name: string | null
          number: number
          org_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name?: string | null
          number: number
          org_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name?: string | null
          number?: number
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_thru_lanes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_thru_lanes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_thru_orders: {
        Row: {
          arrived_at: string | null
          created_at: string
          departed_at: string | null
          id: string
          lane: number
          location_id: string
          order_id: string
          order_seconds: number | null
          ordered_at: string | null
          org_id: string
          paid_at: string | null
          served_at: string | null
          service_seconds: number | null
          total_seconds: number | null
          vehicle_description: string | null
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          departed_at?: string | null
          id?: string
          lane?: number
          location_id: string
          order_id: string
          order_seconds?: number | null
          ordered_at?: string | null
          org_id: string
          paid_at?: string | null
          served_at?: string | null
          service_seconds?: number | null
          total_seconds?: number | null
          vehicle_description?: string | null
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          departed_at?: string | null
          id?: string
          lane?: number
          location_id?: string
          order_id?: string
          order_seconds?: number | null
          ordered_at?: string | null
          org_id?: string
          paid_at?: string | null
          served_at?: string | null
          service_seconds?: number | null
          total_seconds?: number | null
          vehicle_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_thru_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_thru_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_thru_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          background_image_url: string | null
          canvas_height: number
          canvas_width: number
          created_at: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_royalties: {
        Row: {
          ad_fund_amount: number | null
          ad_fund_rate: number | null
          created_at: string
          gross_sales: number
          id: string
          location_id: string
          net_sales: number
          notes: string | null
          org_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          royalty_amount: number
          royalty_rate: number
          status: string
          total_due: number
        }
        Insert: {
          ad_fund_amount?: number | null
          ad_fund_rate?: number | null
          created_at?: string
          gross_sales: number
          id?: string
          location_id: string
          net_sales: number
          notes?: string | null
          org_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          royalty_amount: number
          royalty_rate: number
          status?: string
          total_due: number
        }
        Update: {
          ad_fund_amount?: number | null
          ad_fund_rate?: number | null
          created_at?: string
          gross_sales?: number
          id?: string
          location_id?: string
          net_sales?: number
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          royalty_amount?: number
          royalty_rate?: number
          status?: string
          total_due?: number
        }
        Relationships: [
          {
            foreignKeyName: "franchise_royalties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "franchise_royalties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          gift_card_id: string
          id: string
          notes: string | null
          order_id: string | null
          payment_id: string | null
          performed_by: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          gift_card_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_id?: string | null
          performed_by?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          gift_card_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_id?: string | null
          performed_by?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_transactions_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_card_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          card_number: string
          card_number_hash: string
          created_at: string
          current_balance: number
          expires_at: string | null
          id: string
          initial_balance: number
          is_active: boolean
          message: string | null
          org_id: string
          pin_hash: string | null
          purchase_order_id: string | null
          purchased_at: string
          purchased_by_customer_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          updated_at: string
        }
        Insert: {
          card_number: string
          card_number_hash: string
          created_at?: string
          current_balance: number
          expires_at?: string | null
          id?: string
          initial_balance: number
          is_active?: boolean
          message?: string | null
          org_id: string
          pin_hash?: string | null
          purchase_order_id?: string | null
          purchased_at?: string
          purchased_by_customer_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          updated_at?: string
        }
        Update: {
          card_number?: string
          card_number_hash?: string
          created_at?: string
          current_balance?: number
          expires_at?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          message?: string | null
          org_id?: string
          pin_hash?: string | null
          purchase_order_id?: string | null
          purchased_at?: string
          purchased_by_customer_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_purchased_by_customer_id_fkey"
            columns: ["purchased_by_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      house_account_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          house_account_id: string
          id: string
          order_id: string | null
          org_id: string
          payment_id: string | null
          performed_by: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          house_account_id: string
          id?: string
          order_id?: string | null
          org_id: string
          payment_id?: string | null
          performed_by?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          house_account_id?: string
          id?: string
          order_id?: string | null
          org_id?: string
          payment_id?: string | null
          performed_by?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_account_transactions_house_account_id_fkey"
            columns: ["house_account_id"]
            isOneToOne: false
            referencedRelation: "house_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_account_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_account_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_account_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_account_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      house_accounts: {
        Row: {
          account_name: string
          account_number: string
          billing_address: Json | null
          billing_cycle: string | null
          billing_email: string | null
          created_at: string
          credit_limit: number
          current_balance: number
          customer_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          org_id: string
          payment_terms: string | null
          tax_exempt: boolean
          tax_exempt_id: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          billing_address?: Json | null
          billing_cycle?: string | null
          billing_email?: string | null
          created_at?: string
          credit_limit: number
          current_balance?: number
          customer_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          tax_exempt?: boolean
          tax_exempt_id?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          billing_address?: Json | null
          billing_cycle?: string | null
          billing_email?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          customer_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          tax_exempt?: boolean
          tax_exempt_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "house_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          org_id: string
          response_body: Json | null
          response_status: number
          route: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          key: string
          org_id: string
          response_body?: Json | null
          response_status: number
          route: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          org_id?: string
          response_body?: Json | null
          response_status?: number
          route?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string | null
          current_quantity: number | null
          current_stock: number | null
          id: string
          is_active: boolean | null
          location_id: string
          name: string
          org_id: string
          par_level: number | null
          reorder_point: number | null
          sku: string | null
          unit: string | null
          unit_cost: number | null
          unit_of_measure: string
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          current_quantity?: number | null
          current_stock?: number | null
          id?: string
          is_active?: boolean | null
          location_id: string
          name: string
          org_id: string
          par_level?: number | null
          reorder_point?: number | null
          sku?: string | null
          unit?: string | null
          unit_cost?: number | null
          unit_of_measure: string
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          current_quantity?: number | null
          current_stock?: number | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
          org_id?: string
          par_level?: number | null
          reorder_point?: number | null
          sku?: string | null
          unit?: string | null
          unit_cost?: number | null
          unit_of_measure?: string
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          notes: string | null
          org_id: string
          performed_by: string | null
          quantity_after: number
          quantity_change: number
          reference_id: string | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          notes?: string | null
          org_id: string
          performed_by?: string | null
          quantity_after: number
          quantity_change: number
          reference_id?: string | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          notes?: string | null
          org_id?: string
          performed_by?: string | null
          quantity_after?: number
          quantity_change?: number
          reference_id?: string | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_waste_log: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          location_id: string | null
          notes: string | null
          org_id: string
          quantity: number
          reason: string
          recorded_by: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          location_id?: string | null
          notes?: string | null
          org_id: string
          quantity: number
          reason: string
          recorded_by?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          location_id?: string | null
          notes?: string | null
          org_id?: string
          quantity?: number
          reason?: string
          recorded_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_waste_log_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_waste_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_waste_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_waste_log_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_stations: {
        Row: {
          created_at: string | null
          display_settings: Json | null
          id: string
          is_active: boolean | null
          location_id: string
          name: string
          org_id: string
          prep_stations: string[] | null
          sort_order: number | null
          station_type: string
          terminal_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_settings?: Json | null
          id?: string
          is_active?: boolean | null
          location_id: string
          name: string
          org_id: string
          prep_stations?: string[] | null
          sort_order?: number | null
          station_type: string
          terminal_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_settings?: Json | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
          org_id?: string
          prep_stations?: string[] | null
          sort_order?: number | null
          station_type?: string
          terminal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kds_stations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_stations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_stations_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      kds_ticket_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          order_id: string
          order_item_id: string | null
          org_id: string
          performed_by: string | null
          station_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          order_id: string
          order_item_id?: string | null
          org_id: string
          performed_by?: string | null
          station_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
          org_id?: string
          performed_by?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kds_ticket_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_ticket_events_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_ticket_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kds_ticket_events_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "kds_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_hours: Json
          city: string | null
          country: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          org_id: string
          phone: string | null
          settings: Json
          slug: string
          state: string | null
          timezone: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_hours?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          org_id: string
          phone?: string | null
          settings?: Json
          slug: string
          state?: string | null
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_hours?: Json
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          org_id?: string
          phone?: string | null
          settings?: Json
          slug?: string
          state?: string | null
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          customer_id: string
          enrolled_at: string | null
          id: string
          last_activity_at: string | null
          lifetime_points: number
          org_id: string
          points_balance: number
          program_id: string
          tier: string | null
        }
        Insert: {
          customer_id: string
          enrolled_at?: string | null
          id?: string
          last_activity_at?: string | null
          lifetime_points?: number
          org_id: string
          points_balance?: number
          program_id: string
          tier?: string | null
        }
        Update: {
          customer_id?: string
          enrolled_at?: string | null
          id?: string
          last_activity_at?: string | null
          lifetime_points?: number
          org_id?: string
          points_balance?: number
          program_id?: string
          tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          points_per_dollar: number | null
          points_per_visit: number | null
          program_type: string
          redemption_threshold: number | null
          reward_value: number | null
          settings: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          points_per_dollar?: number | null
          points_per_visit?: number | null
          program_type: string
          redemption_threshold?: number | null
          reward_value?: number | null
          settings?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          points_per_dollar?: number | null
          points_per_visit?: number | null
          program_type?: string
          redemption_threshold?: number | null
          reward_value?: number | null
          settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          loyalty_account_id: string
          order_id: string | null
          org_id: string
          points: number
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          loyalty_account_id: string
          order_id?: string | null
          org_id: string
          points: number
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          loyalty_account_id?: string
          order_id?: string | null
          org_id?: string
          points?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          available_days: number[] | null
          available_end_time: string | null
          available_start_time: string | null
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          location_id: string | null
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_id?: string | null
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          location_id?: string | null
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_modifier_groups: {
        Row: {
          menu_item_id: string
          modifier_group_id: string
          sort_order: number
        }
        Insert: {
          menu_item_id: string
          modifier_group_id: string
          sort_order?: number
        }
        Update: {
          menu_item_id?: string
          modifier_group_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_modifier_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_modifier_groups_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          available_days: number[] | null
          available_end_time: string | null
          available_start_time: string | null
          barcode: string | null
          category_id: string
          color: string | null
          cost: number | null
          course: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_86d: boolean
          is_active: boolean
          is_taxable: boolean
          location_id: string | null
          name: string
          nutrition: Json | null
          org_id: string
          plu_code: string | null
          prep_station: string | null
          prep_time_minutes: number | null
          price: number
          short_name: string | null
          sort_order: number
          tax_rate_id: string | null
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          barcode?: string | null
          category_id: string
          color?: string | null
          cost?: number | null
          course?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_86d?: boolean
          is_active?: boolean
          is_taxable?: boolean
          location_id?: string | null
          name: string
          nutrition?: Json | null
          org_id: string
          plu_code?: string | null
          prep_station?: string | null
          prep_time_minutes?: number | null
          price: number
          short_name?: string | null
          sort_order?: number
          tax_rate_id?: string | null
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          barcode?: string | null
          category_id?: string
          color?: string | null
          cost?: number | null
          course?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_86d?: boolean
          is_active?: boolean
          is_taxable?: boolean
          location_id?: string | null
          name?: string
          nutrition?: Json | null
          org_id?: string
          plu_code?: string | null
          prep_station?: string | null
          prep_time_minutes?: number | null
          price?: number
          short_name?: string | null
          sort_order?: number
          tax_rate_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_required_prompt: boolean
          max_selections: number
          min_selections: number
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_required_prompt?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_required_prompt?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          is_default: boolean
          modifier_group_id: string
          name: string
          org_id: string
          price_adjustment: number
          short_name: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          modifier_group_id: string
          name: string
          org_id: string
          price_adjustment?: number
          short_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          modifier_group_id?: string
          name?: string
          org_id?: string
          price_adjustment?: number
          short_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_migrations: {
        Row: {
          applied_at: string
          id: string
          migration_name: string
          module_id: string
          org_id: string
        }
        Insert: {
          applied_at?: string
          id?: string
          migration_name: string
          module_id: string
          org_id: string
        }
        Update: {
          applied_at?: string
          id?: string
          migration_name?: string
          module_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_migrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      online_menu_items: {
        Row: {
          created_at: string | null
          id: string
          is_available: boolean | null
          menu_item_id: string
          online_description: string | null
          online_menu_id: string
          online_price: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          menu_item_id: string
          online_description?: string | null
          online_menu_id: string
          online_price?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          menu_item_id?: string
          online_description?: string | null
          online_menu_id?: string
          online_price?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "online_menu_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_menu_items_online_menu_id_fkey"
            columns: ["online_menu_id"]
            isOneToOne: false
            referencedRelation: "online_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      online_menus: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          location_id: string
          name: string
          org_id: string
          settings: Json | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id: string
          name: string
          org_id: string
          settings?: Json | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
          org_id?: string
          settings?: Json | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_menus_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_menus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      online_order_queue: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          customer_notified_at: string | null
          estimated_ready_minutes: number | null
          id: string
          location_id: string
          order_id: string
          org_id: string
          rejected_reason: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          customer_notified_at?: string | null
          estimated_ready_minutes?: number | null
          id?: string
          location_id: string
          order_id: string
          org_id: string
          rejected_reason?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          customer_notified_at?: string | null
          estimated_ready_minutes?: number | null
          id?: string
          location_id?: string
          order_id?: string
          org_id?: string
          rejected_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_order_queue_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_queue_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_discounts: {
        Row: {
          applied_amount: number
          applied_by: string
          approved_by: string | null
          created_at: string
          discount_id: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          id: string
          name: string
          order_id: string
          order_item_id: string | null
          value: number
        }
        Insert: {
          applied_amount: number
          applied_by: string
          approved_by?: string | null
          created_at?: string
          discount_id?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          id?: string
          name: string
          order_id: string
          order_item_id?: string | null
          value: number
        }
        Update: {
          applied_amount?: number
          applied_by?: string
          approved_by?: string | null
          created_at?: string
          discount_id?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          id?: string
          name?: string
          order_id?: string
          order_item_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_discounts_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_discounts_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          created_at: string
          id: string
          modifier_group_id: string | null
          modifier_id: string | null
          name: string
          order_item_id: string
          price_adjustment: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          modifier_group_id?: string | null
          modifier_id?: string | null
          name: string
          order_item_id: string
          price_adjustment?: number
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          modifier_group_id?: string | null
          modifier_id?: string | null
          name?: string
          order_item_id?: string
          price_adjustment?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          comp_amount: number | null
          comp_reason: Database["public"]["Enums"]["comp_reason"] | null
          comped_by: string | null
          course: number | null
          created_at: string
          created_by: string | null
          discount_amount: number
          fired_at: string | null
          id: string
          is_comped: boolean
          is_fired: boolean
          is_ready: boolean
          is_sent: boolean
          is_served: boolean
          is_voided: boolean
          line_total: number
          menu_item_id: string | null
          modifier_total: number
          name: string
          notes: string | null
          order_id: string
          org_id: string
          prep_station: string | null
          quantity: number
          ready_at: string | null
          seat_number: number | null
          sent_at: string | null
          served_at: string | null
          short_name: string | null
          sort_order: number
          tax_amount: number
          unit_price: number
          updated_at: string
          void_reason: Database["public"]["Enums"]["void_reason"] | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          comp_amount?: number | null
          comp_reason?: Database["public"]["Enums"]["comp_reason"] | null
          comped_by?: string | null
          course?: number | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          fired_at?: string | null
          id?: string
          is_comped?: boolean
          is_fired?: boolean
          is_ready?: boolean
          is_sent?: boolean
          is_served?: boolean
          is_voided?: boolean
          line_total: number
          menu_item_id?: string | null
          modifier_total?: number
          name: string
          notes?: string | null
          order_id: string
          org_id: string
          prep_station?: string | null
          quantity?: number
          ready_at?: string | null
          seat_number?: number | null
          sent_at?: string | null
          served_at?: string | null
          short_name?: string | null
          sort_order?: number
          tax_amount?: number
          unit_price: number
          updated_at?: string
          void_reason?: Database["public"]["Enums"]["void_reason"] | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          comp_amount?: number | null
          comp_reason?: Database["public"]["Enums"]["comp_reason"] | null
          comped_by?: string | null
          course?: number | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          fired_at?: string | null
          id?: string
          is_comped?: boolean
          is_fired?: boolean
          is_ready?: boolean
          is_sent?: boolean
          is_served?: boolean
          is_voided?: boolean
          line_total?: number
          menu_item_id?: string | null
          modifier_total?: number
          name?: string
          notes?: string | null
          order_id?: string
          org_id?: string
          prep_station?: string | null
          quantity?: number
          ready_at?: string | null
          seat_number?: number | null
          sent_at?: string | null
          served_at?: string | null
          short_name?: string | null
          sort_order?: number
          tax_amount?: number
          unit_price?: number
          updated_at?: string
          void_reason?: Database["public"]["Enums"]["void_reason"] | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_comped_by_fkey"
            columns: ["comped_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_modifications: {
        Row: {
          approved_by: string | null
          created_at: string
          description: string
          id: string
          modification_type: string
          new_value: Json | null
          order_id: string
          order_item_id: string | null
          org_id: string
          performed_by: string
          previous_value: Json | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          description: string
          id?: string
          modification_type: string
          new_value?: Json | null
          order_id: string
          order_item_id?: string | null
          org_id: string
          performed_by: string
          previous_value?: Json | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          description?: string
          id?: string
          modification_type?: string
          new_value?: Json | null
          order_id?: string
          order_item_id?: string | null
          org_id?: string
          performed_by?: string
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_modifications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_modifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_modifications_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_modifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_modifications_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_throttle_config: {
        Row: {
          auto_accept: boolean | null
          created_at: string | null
          id: string
          is_paused: boolean | null
          location_id: string | null
          max_orders_per_15_min: number | null
          max_orders_per_hour: number | null
          operating_hours: Json | null
          org_id: string
          pause_reason: string | null
          updated_at: string | null
        }
        Insert: {
          auto_accept?: boolean | null
          created_at?: string | null
          id?: string
          is_paused?: boolean | null
          location_id?: string | null
          max_orders_per_15_min?: number | null
          max_orders_per_hour?: number | null
          operating_hours?: Json | null
          org_id: string
          pause_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_accept?: boolean | null
          created_at?: string | null
          id?: string
          is_paused?: boolean | null
          location_id?: string | null
          max_orders_per_15_min?: number | null
          max_orders_per_hour?: number | null
          operating_hours?: Json | null
          org_id?: string
          pause_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_throttle_config_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_throttle_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid: number
          balance_due: number
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_address: Json | null
          discount_total: number
          display_number: string
          fire_course_2_at: string | null
          guest_count: number | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          location_id: string
          metadata: Json
          notes: string | null
          opened_at: string
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          org_id: string
          scheduled_for: string | null
          sent_at: string | null
          server_id: string | null
          source: string | null
          split_from_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          tax_total: number
          terminal_id: string | null
          tip_total: number
          total: number
          updated_at: string
          updated_by: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          discount_total?: number
          display_number: string
          fire_course_2_at?: string | null
          guest_count?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          location_id: string
          metadata?: Json
          notes?: string | null
          opened_at?: string
          order_number: number
          order_type?: Database["public"]["Enums"]["order_type"]
          org_id: string
          scheduled_for?: string | null
          sent_at?: string | null
          server_id?: string | null
          source?: string | null
          split_from_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax_total?: number
          terminal_id?: string | null
          tip_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_address?: Json | null
          discount_total?: number
          display_number?: string
          fire_course_2_at?: string | null
          guest_count?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          location_id?: string
          metadata?: Json
          notes?: string | null
          opened_at?: string
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          org_id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          server_id?: string | null
          source?: string | null
          split_from_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax_total?: number
          terminal_id?: string | null
          tip_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_split_from_order_id_fkey"
            columns: ["split_from_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_modules: {
        Row: {
          config: Json
          created_at: string
          disabled_at: string | null
          enabled_at: string
          id: string
          is_enabled: boolean
          location_ids: string[] | null
          module_id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string
          id?: string
          is_enabled?: boolean
          location_ids?: string[] | null
          module_id: string
          org_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string
          id?: string
          is_enabled?: boolean
          location_ids?: string[] | null
          module_id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_modules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_processor_bindings: {
        Row: {
          bound_at: string
          bound_by_user_id: string | null
          org_id: string
          processor: string
        }
        Insert: {
          bound_at?: string
          bound_by_user_id?: string | null
          org_id: string
          processor: string
        }
        Update: {
          bound_at?: string
          bound_by_user_id?: string | null
          org_id?: string
          processor?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_processor_bindings_bound_by_user_id_fkey"
            columns: ["bound_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_processor_bindings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          plan: string
          primary_color: string | null
          settings: Json
          slug: string
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          plan?: string
          primary_color?: string | null
          settings?: Json
          slug: string
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          plan?: string
          primary_color?: string | null
          settings?: Json
          slug?: string
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_devices: {
        Row: {
          connection_type: string
          created_at: string
          device_label: string | null
          device_model: string
          device_serial: string
          firmware_version: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_seen_at: string | null
          location_id: string
          org_id: string
          port: number | null
        }
        Insert: {
          connection_type: string
          created_at?: string
          device_label?: string | null
          device_model: string
          device_serial: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen_at?: string | null
          location_id: string
          org_id: string
          port?: number | null
        }
        Update: {
          connection_type?: string
          created_at?: string
          device_label?: string | null
          device_model?: string
          device_serial?: string
          firmware_version?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen_at?: string | null
          location_id?: string
          org_id?: string
          port?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          auth_code: string | null
          card_brand: string | null
          card_last_four: string | null
          cash_tendered: number | null
          change_due: number | null
          created_at: string
          gift_card_id: string | null
          id: string
          location_id: string | null
          order_id: string
          org_id: string
          original_payment_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          processed_at: string
          processed_by: string
          processor_response: Json | null
          processor_transaction_id: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          split_index: number | null
          status: Database["public"]["Enums"]["payment_status"]
          tip_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          auth_code?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          cash_tendered?: number | null
          change_due?: number | null
          created_at?: string
          gift_card_id?: string | null
          id?: string
          location_id?: string | null
          order_id: string
          org_id: string
          original_payment_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          processed_at?: string
          processed_by: string
          processor_response?: Json | null
          processor_transaction_id?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          split_index?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          tip_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          auth_code?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          cash_tendered?: number | null
          change_due?: number | null
          created_at?: string
          gift_card_id?: string | null
          id?: string
          location_id?: string | null
          order_id?: string
          org_id?: string
          original_payment_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string
          processed_by?: string
          processor_response?: Json | null
          processor_transaction_id?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          split_index?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          tip_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          code: string
          description: string | null
          id: string
          module_id: string
        }
        Insert: {
          category?: string | null
          code: string
          description?: string | null
          id?: string
          module_id: string
        }
        Update: {
          category?: string | null
          code?: string
          description?: string | null
          id?: string
          module_id?: string
        }
        Relationships: []
      }
      price_level_prices: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          org_id: string
          price: number
          price_level_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          org_id: string
          price: number
          price_level_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          org_id?: string
          price?: number
          price_level_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_level_prices_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_level_prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_level_prices_price_level_id_fkey"
            columns: ["price_level_id"]
            isOneToOne: false
            referencedRelation: "price_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      price_level_schedules: {
        Row: {
          created_at: string
          days_of_week: number[]
          end_date: string | null
          end_time: string
          id: string
          is_active: boolean
          location_id: string
          name: string
          org_id: string
          price_level_id: string
          priority: number
          start_date: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week: number[]
          end_date?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          org_id: string
          price_level_id: string
          priority?: number
          start_date?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          org_id?: string
          price_level_id?: string
          priority?: number
          start_date?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_level_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_level_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_level_schedules_price_level_id_fkey"
            columns: ["price_level_id"]
            isOneToOne: false
            referencedRelation: "price_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      price_levels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level_number: number
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level_number: number
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level_number?: number
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_levels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      print_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number | null
          org_id: string
          payload: Json
          printer_id: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          org_id: string
          payload?: Json
          printer_id?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          org_id?: string
          payload?: Json
          printer_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_queue_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      print_routing: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          job_type: string | null
          location_id: string | null
          org_id: string
          printer_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          job_type?: string | null
          location_id?: string | null
          org_id: string
          printer_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          job_type?: string | null
          location_id?: string | null
          org_id?: string
          printer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_routing_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_routing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_routing_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          cash_drawer_enabled: boolean | null
          cash_drawer_pin: number | null
          connection_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          is_online: boolean | null
          last_heartbeat_at: string | null
          location_id: string
          model: string
          name: string
          org_id: string
          port: number | null
          pulse_duration: number | null
          role: string
          station_name: string | null
          updated_at: string | null
        }
        Insert: {
          cash_drawer_enabled?: boolean | null
          cash_drawer_pin?: number | null
          connection_type: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_heartbeat_at?: string | null
          location_id: string
          model: string
          name: string
          org_id: string
          port?: number | null
          pulse_duration?: number | null
          role: string
          station_name?: string | null
          updated_at?: string | null
        }
        Update: {
          cash_drawer_enabled?: boolean | null
          cash_drawer_pin?: number | null
          connection_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_online?: boolean | null
          last_heartbeat_at?: string | null
          location_id?: string
          model?: string
          name?: string
          org_id?: string
          port?: number | null
          pulse_duration?: number | null
          role?: string
          station_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          line_total: number
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          line_total: number
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number | null
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          line_total?: number
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string
          expected_at: string | null
          id: string
          location_id: string
          notes: string | null
          ordered_at: string | null
          org_id: string
          po_number: string
          received_at: string | null
          status: string
          total_amount: number | null
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expected_at?: string | null
          id?: string
          location_id: string
          notes?: string | null
          ordered_at?: string | null
          org_id: string
          po_number: string
          received_at?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expected_at?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          ordered_at?: string | null
          org_id?: string
          po_number?: string
          received_at?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_menus: {
        Row: {
          allow_ordering: boolean
          created_at: string
          id: string
          is_active: boolean
          location_id: string
          menu_categories: string[] | null
          name: string
          org_id: string
          qr_code_url: string | null
          require_table_number: boolean
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          allow_ordering?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          location_id: string
          menu_categories?: string[] | null
          name: string
          org_id: string
          qr_code_url?: string | null
          require_table_number?: boolean
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          allow_ordering?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string
          menu_categories?: string[] | null
          name?: string
          org_id?: string
          qr_code_url?: string | null
          require_table_number?: boolean
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_menus_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_menus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_orders: {
        Row: {
          created_at: string
          device_type: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          location_id: string
          order_id: string
          org_id: string
          qr_menu_id: string
          session_id: string
          table_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          location_id: string
          order_id: string
          org_id: string
          qr_menu_id: string
          session_id: string
          table_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          location_id?: string
          order_id?: string
          org_id?: string
          qr_menu_id?: string
          session_id?: string
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_orders_qr_menu_id_fkey"
            columns: ["qr_menu_id"]
            isOneToOne: false
            referencedRelation: "qr_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_config: {
        Row: {
          created_at: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          location_id: string | null
          org_id: string
          paper_width: number | null
          show_logo: boolean | null
          show_tax_breakdown: boolean | null
          show_tip_suggestions: boolean | null
          tip_percentages: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          location_id?: string | null
          org_id: string
          paper_width?: number | null
          show_logo?: boolean | null
          show_tax_breakdown?: boolean | null
          show_tip_suggestions?: boolean | null
          tip_percentages?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          location_id?: string | null
          org_id?: string
          paper_width?: number | null
          show_logo?: boolean | null
          show_tax_breakdown?: boolean | null
          show_tip_suggestions?: boolean | null
          tip_percentages?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_config_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string | null
          id: string
          inventory_item_id: string
          menu_item_id: string
          org_id: string
          quantity_used: number
          unit_of_measure: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inventory_item_id: string
          menu_item_id: string
          org_id: string
          quantity_used: number
          unit_of_measure: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inventory_item_id?: string
          menu_item_id?: string
          org_id?: string
          quantity_used?: number
          unit_of_measure?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          confirmation_sent_at: string | null
          created_at: string | null
          customer_id: string | null
          duration_minutes: number | null
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          location_id: string
          notes: string | null
          org_id: string
          party_size: number
          reminder_sent_at: string | null
          reservation_date: string
          reservation_time: string
          special_requests: string | null
          status: string
          table_id: string | null
          updated_at: string | null
        }
        Insert: {
          confirmation_sent_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          duration_minutes?: number | null
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          location_id: string
          notes?: string | null
          org_id: string
          party_size: number
          reminder_sent_at?: string | null
          reservation_date: string
          reservation_time: string
          special_requests?: string | null
          status?: string
          table_id?: string | null
          updated_at?: string | null
        }
        Update: {
          confirmation_sent_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          duration_minutes?: number | null
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          org_id?: string
          party_size?: number
          reminder_sent_at?: string | null
          reservation_date?: string
          reservation_time?: string
          special_requests?: string | null
          status?: string
          table_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          permission_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          permission_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          location_id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_templates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_shifts: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          location_id: string
          notes: string | null
          org_id: string
          published_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          shift_date: string
          start_time: string
          status: string
          template_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          location_id: string
          notes?: string | null
          org_id: string
          published_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          shift_date: string
          start_time: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          location_id?: string
          notes?: string | null
          org_id?: string
          published_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shift_date?: string
          start_time?: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_shifts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "schedule_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_batches: {
        Row: {
          actual_deposit_amount: number | null
          actual_deposit_date: string | null
          batch_closed_at: string
          batch_opened_at: string | null
          created_at: string
          expected_deposit_date: string | null
          gross_amount: number
          id: string
          is_reconciled: boolean | null
          location_id: string
          net_amount: number
          org_id: string
          processor_batch_id: string | null
          reconciled_at: string | null
          refund_amount: number | null
          transaction_count: number
          variance_amount: number | null
        }
        Insert: {
          actual_deposit_amount?: number | null
          actual_deposit_date?: string | null
          batch_closed_at: string
          batch_opened_at?: string | null
          created_at?: string
          expected_deposit_date?: string | null
          gross_amount: number
          id?: string
          is_reconciled?: boolean | null
          location_id: string
          net_amount: number
          org_id: string
          processor_batch_id?: string | null
          reconciled_at?: string | null
          refund_amount?: number | null
          transaction_count: number
          variance_amount?: number | null
        }
        Update: {
          actual_deposit_amount?: number | null
          actual_deposit_date?: string | null
          batch_closed_at?: string
          batch_opened_at?: string | null
          created_at?: string
          expected_deposit_date?: string | null
          gross_amount?: number
          id?: string
          is_reconciled?: boolean | null
          location_id?: string
          net_amount?: number
          org_id?: string
          processor_batch_id?: string | null
          reconciled_at?: string | null
          refund_amount?: number | null
          transaction_count?: number
          variance_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_progress: {
        Row: {
          completed_steps: Json
          created_at: string
          current_step: number
          data: Json
          id: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: Json
          created_at?: string
          current_step?: number
          data?: Json
          id?: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_steps?: Json
          created_at?: string
          current_step?: number
          data?: Json
          id?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_marketplace: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          org_id: string
          posted_at: string | null
          posted_by: string
          reason: string | null
          shift_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          org_id: string
          posted_at?: string | null
          posted_by: string
          reason?: string | null
          shift_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          posted_at?: string | null
          posted_by?: string
          reason?: string | null
          shift_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_marketplace_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_marketplace_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_marketplace_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_marketplace_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          approved_by: string | null
          created_at: string | null
          id: string
          org_id: string
          requested_by: string
          scheduled_shift_id: string
          status: string
          swap_with_user_id: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          requested_by: string
          scheduled_shift_id: string
          status?: string
          swap_with_user_id?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          requested_by?: string
          scheduled_shift_id?: string
          status?: string
          swap_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_scheduled_shift_id_fkey"
            columns: ["scheduled_shift_id"]
            isOneToOne: false
            referencedRelation: "scheduled_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_swap_with_user_id_fkey"
            columns: ["swap_with_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_time: string | null
          id: string
          is_closed: boolean
          location_id: string
          manager_id: string | null
          name: string | null
          notes: string | null
          org_id: string
          shift_date: string
          start_time: string
          total_comps: number | null
          total_labor_cost: number | null
          total_sales: number | null
          total_voids: number | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_closed?: boolean
          location_id: string
          manager_id?: string | null
          name?: string | null
          notes?: string | null
          org_id: string
          shift_date: string
          start_time: string
          total_comps?: number | null
          total_labor_cost?: number | null
          total_sales?: number | null
          total_voids?: number | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_closed?: boolean
          location_id?: string
          manager_id?: string | null
          name?: string | null
          notes?: string | null
          org_id?: string
          shift_date?: string
          start_time?: string
          total_comps?: number | null
          total_labor_cost?: number | null
          total_sales?: number | null
          total_voids?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          effective_date: string | null
          end_time: string | null
          expiration_date: string | null
          id: string
          is_available: boolean
          org_id: string
          start_time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          effective_date?: string | null
          end_time?: string | null
          expiration_date?: string | null
          id?: string
          is_available?: boolean
          org_id: string
          start_time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          effective_date?: string | null
          end_time?: string | null
          expiration_date?: string | null
          id?: string
          is_available?: boolean
          org_id?: string
          start_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      surcharge_config: {
        Row: {
          card_network_registered: boolean | null
          cash_discount_rate: number | null
          created_at: string
          id: string
          is_active: boolean | null
          location_id: string
          merchant_discount_rate: number | null
          org_id: string
          program_type: string
          registration_date: string | null
          signage_confirmed: boolean | null
          state: string
          surcharge_rate: number | null
          updated_at: string
        }
        Insert: {
          card_network_registered?: boolean | null
          cash_discount_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id: string
          merchant_discount_rate?: number | null
          org_id: string
          program_type?: string
          registration_date?: string | null
          signage_confirmed?: boolean | null
          state: string
          surcharge_rate?: number | null
          updated_at?: string
        }
        Update: {
          card_network_registered?: boolean | null
          cash_discount_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_id?: string
          merchant_discount_rate?: number | null
          org_id?: string
          program_type?: string
          registration_date?: string | null
          signage_confirmed?: boolean | null
          state?: string
          surcharge_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surcharge_config_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surcharge_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          created_at: string
          current_order_id: string | null
          current_server_id: string | null
          floor_plan_id: string
          guest_count: number
          height: number
          id: string
          is_active: boolean
          location_id: string
          name: string
          org_id: string
          pos_x: number
          pos_y: number
          rotation: number
          seated_at: string | null
          section: string | null
          shape: string
          sort_order: number
          status: string
          updated_at: string
          width: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          current_order_id?: string | null
          current_server_id?: string | null
          floor_plan_id: string
          guest_count?: number
          height?: number
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          org_id: string
          pos_x?: number
          pos_y?: number
          rotation?: number
          seated_at?: string | null
          section?: string | null
          shape?: string
          sort_order?: number
          status?: string
          updated_at?: string
          width?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          current_order_id?: string | null
          current_server_id?: string | null
          floor_plan_id?: string
          guest_count?: number
          height?: number
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          org_id?: string
          pos_x?: number
          pos_y?: number
          rotation?: number
          seated_at?: string | null
          section?: string | null
          shape?: string
          sort_order?: number
          status?: string
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_current_server_id_fkey"
            columns: ["current_server_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          applies_to: string[] | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          is_inclusive: boolean
          location_id: string | null
          name: string
          org_id: string
          rate: number
          updated_at: string
        }
        Insert: {
          applies_to?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_inclusive?: boolean
          location_id?: string | null
          name: string
          org_id: string
          rate: number
          updated_at?: string
        }
        Update: {
          applies_to?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_inclusive?: boolean
          location_id?: string | null
          name?: string
          org_id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      terminals: {
        Row: {
          assigned_printer_id: string | null
          created_at: string
          current_user_id: string | null
          default_view: string | null
          device_fingerprint: Json | null
          device_id: string | null
          id: string
          is_active: boolean
          is_online: boolean
          last_heartbeat_at: string | null
          location_id: string
          name: string
          org_id: string
          registration_code: string | null
          registration_code_expires_at: string | null
          settings: Json
          terminal_type: Database["public"]["Enums"]["terminal_type"]
          updated_at: string
        }
        Insert: {
          assigned_printer_id?: string | null
          created_at?: string
          current_user_id?: string | null
          default_view?: string | null
          device_fingerprint?: Json | null
          device_id?: string | null
          id?: string
          is_active?: boolean
          is_online?: boolean
          last_heartbeat_at?: string | null
          location_id: string
          name: string
          org_id: string
          registration_code?: string | null
          registration_code_expires_at?: string | null
          settings?: Json
          terminal_type: Database["public"]["Enums"]["terminal_type"]
          updated_at?: string
        }
        Update: {
          assigned_printer_id?: string | null
          created_at?: string
          current_user_id?: string | null
          default_view?: string | null
          device_fingerprint?: Json | null
          device_id?: string | null
          id?: string
          is_active?: boolean
          is_online?: boolean
          last_heartbeat_at?: string | null
          location_id?: string
          name?: string
          org_id?: string
          registration_code?: string | null
          registration_code_expires_at?: string | null
          settings?: Json
          terminal_type?: Database["public"]["Enums"]["terminal_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminals_current_user_id_fkey"
            columns: ["current_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_by: string | null
          cash_tips: number
          clock_in: string
          clock_out: string | null
          created_at: string
          credit_tips: number
          hourly_rate: number | null
          id: string
          is_approved: boolean
          location_id: string
          notes: string | null
          org_id: string
          overtime_hours: number | null
          regular_hours: number | null
          role_during_shift: Database["public"]["Enums"]["user_role"] | null
          shift_id: string | null
          tip_out_given: number
          tip_out_received: number
          total_pay: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          cash_tips?: number
          clock_in: string
          clock_out?: string | null
          created_at?: string
          credit_tips?: number
          hourly_rate?: number | null
          id?: string
          is_approved?: boolean
          location_id: string
          notes?: string | null
          org_id: string
          overtime_hours?: number | null
          regular_hours?: number | null
          role_during_shift?: Database["public"]["Enums"]["user_role"] | null
          shift_id?: string | null
          tip_out_given?: number
          tip_out_received?: number
          total_pay?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          cash_tips?: number
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          credit_tips?: number
          hourly_rate?: number | null
          id?: string
          is_approved?: boolean
          location_id?: string
          notes?: string | null
          org_id?: string
          overtime_hours?: number | null
          regular_hours?: number | null
          role_during_shift?: Database["public"]["Enums"]["user_role"] | null
          shift_id?: string | null
          tip_out_given?: number
          tip_out_received?: number
          total_pay?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_adjustments: {
        Row: {
          adjusted_by: string
          adjusted_tip: number
          created_at: string
          id: string
          order_id: string
          org_id: string
          original_tip: number
          payment_id: string
          reason: string | null
          server_id: string
        }
        Insert: {
          adjusted_by: string
          adjusted_tip: number
          created_at?: string
          id?: string
          order_id: string
          org_id: string
          original_tip: number
          payment_id: string
          reason?: string | null
          server_id: string
        }
        Update: {
          adjusted_by?: string
          adjusted_tip?: number
          created_at?: string
          id?: string
          order_id?: string
          org_id?: string
          original_tip?: number
          payment_id?: string
          reason?: string | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_adjustments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_adjustments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_adjustments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_adjustments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_config: {
        Row: {
          auto_grat_enabled: boolean | null
          auto_grat_party_size: number | null
          auto_grat_percentage: number | null
          calculate_on: string | null
          created_at: string
          default_percentage: number | null
          distribution_model: string | null
          id: string
          location_id: string
          org_id: string
          pool_method: string | null
          pool_point_values: Json | null
          suggested_percentages: number[] | null
          tipout_rules: Json | null
          updated_at: string
        }
        Insert: {
          auto_grat_enabled?: boolean | null
          auto_grat_party_size?: number | null
          auto_grat_percentage?: number | null
          calculate_on?: string | null
          created_at?: string
          default_percentage?: number | null
          distribution_model?: string | null
          id?: string
          location_id: string
          org_id: string
          pool_method?: string | null
          pool_point_values?: Json | null
          suggested_percentages?: number[] | null
          tipout_rules?: Json | null
          updated_at?: string
        }
        Update: {
          auto_grat_enabled?: boolean | null
          auto_grat_party_size?: number | null
          auto_grat_percentage?: number | null
          calculate_on?: string | null
          created_at?: string
          default_percentage?: number | null
          distribution_model?: string | null
          id?: string
          location_id?: string
          org_id?: string
          pool_method?: string | null
          pool_point_values?: Json | null
          suggested_percentages?: number[] | null
          tipout_rules?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_config_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_distributions: {
        Row: {
          amount: number
          created_at: string
          distribution_method: string
          id: string
          order_id: string | null
          org_id: string
          payment_id: string | null
          shift_date: string
          tip_amount: number
          tip_type: string
          tipout_from_user_id: string | null
          tipout_percentage: number | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          distribution_method: string
          id?: string
          order_id?: string | null
          org_id: string
          payment_id?: string | null
          shift_date: string
          tip_amount: number
          tip_type: string
          tipout_from_user_id?: string | null
          tipout_percentage?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          distribution_method?: string
          id?: string
          order_id?: string | null
          org_id?: string
          payment_id?: string | null
          shift_date?: string
          tip_amount?: number
          tip_type?: string
          tipout_from_user_id?: string | null
          tipout_percentage?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_distributions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_distributions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_distributions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_distributions_tipout_from_user_id_fkey"
            columns: ["tipout_from_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_distributions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          granted: boolean
          permission_id: string
          user_id: string
        }
        Insert: {
          granted: boolean
          permission_id: string
          user_id: string
        }
        Update: {
          granted?: boolean
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          last_name: string
          location_ids: string[]
          org_id: string
          phone: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["user_role"]
          settings: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id: string
          is_active?: boolean
          last_name: string
          location_ids?: string[]
          org_id: string
          phone?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          last_name?: string
          location_ids?: string[]
          org_id?: string
          phone?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          account_number: string | null
          address: Json | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          org_id: string
          payment_terms: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          address?: Json | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          org_id: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          address?: Json | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          org_id?: string
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          created_at: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          location_id: string
          notes: string | null
          notified_at: string | null
          org_id: string
          party_size: number
          position: number
          quoted_wait_minutes: number | null
          seated_at: string | null
          status: string
          table_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          location_id: string
          notes?: string | null
          notified_at?: string | null
          org_id: string
          party_size: number
          position: number
          quoted_wait_minutes?: number | null
          seated_at?: string | null
          status?: string
          table_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          notified_at?: string | null
          org_id?: string
          party_size?: number
          position?: number
          quoted_wait_minutes?: number | null
          seated_at?: string | null
          status?: string
          table_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      next_order_number: { Args: { p_location_id: string }; Returns: number }
    }
    Enums: {
      cash_drawer_event_type:
        | "open_shift"
        | "close_shift"
        | "cash_sale"
        | "cash_refund"
        | "paid_in"
        | "paid_out"
        | "tip_payout"
        | "no_sale"
        | "count"
      comp_reason:
        | "manager_comp"
        | "quality_issue"
        | "service_issue"
        | "birthday"
        | "vip"
        | "employee_meal"
        | "promotional"
        | "other"
      discount_type: "percentage" | "fixed_amount" | "bogo" | "free_item"
      order_status:
        | "draft"
        | "open"
        | "fired"
        | "ready"
        | "served"
        | "closed"
        | "voided"
        | "refunded"
      order_type:
        | "dine_in"
        | "takeout"
        | "delivery"
        | "bar"
        | "catering"
        | "online"
        | "kiosk"
        | "drive_thru"
      payment_method:
        | "cash"
        | "credit_card"
        | "debit_card"
        | "gift_card"
        | "house_account"
        | "apple_pay"
        | "google_pay"
        | "external"
      payment_status:
        | "pending"
        | "authorized"
        | "captured"
        | "settled"
        | "declined"
        | "voided"
        | "refunded"
        | "failed"
      terminal_type:
        | "server_station"
        | "bar"
        | "host"
        | "cashier"
        | "kds"
        | "kiosk"
        | "customer_display"
        | "drive_thru"
      user_role:
        | "platform_admin"
        | "owner"
        | "admin"
        | "manager"
        | "server"
        | "bartender"
        | "host"
        | "kitchen"
        | "cashier"
        | "driver"
        | "kiosk"
        | "readonly"
      void_reason:
        | "customer_request"
        | "kitchen_error"
        | "server_error"
        | "wrong_item"
        | "quality_issue"
        | "86d"
        | "duplicate"
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
      cash_drawer_event_type: [
        "open_shift",
        "close_shift",
        "cash_sale",
        "cash_refund",
        "paid_in",
        "paid_out",
        "tip_payout",
        "no_sale",
        "count",
      ],
      comp_reason: [
        "manager_comp",
        "quality_issue",
        "service_issue",
        "birthday",
        "vip",
        "employee_meal",
        "promotional",
        "other",
      ],
      discount_type: ["percentage", "fixed_amount", "bogo", "free_item"],
      order_status: [
        "draft",
        "open",
        "fired",
        "ready",
        "served",
        "closed",
        "voided",
        "refunded",
      ],
      order_type: [
        "dine_in",
        "takeout",
        "delivery",
        "bar",
        "catering",
        "online",
        "kiosk",
        "drive_thru",
      ],
      payment_method: [
        "cash",
        "credit_card",
        "debit_card",
        "gift_card",
        "house_account",
        "apple_pay",
        "google_pay",
        "external",
      ],
      payment_status: [
        "pending",
        "authorized",
        "captured",
        "settled",
        "declined",
        "voided",
        "refunded",
        "failed",
      ],
      terminal_type: [
        "server_station",
        "bar",
        "host",
        "cashier",
        "kds",
        "kiosk",
        "customer_display",
        "drive_thru",
      ],
      user_role: [
        "platform_admin",
        "owner",
        "admin",
        "manager",
        "server",
        "bartender",
        "host",
        "kitchen",
        "cashier",
        "driver",
        "kiosk",
        "readonly",
      ],
      void_reason: [
        "customer_request",
        "kitchen_error",
        "server_error",
        "wrong_item",
        "quality_issue",
        "86d",
        "duplicate",
        "other",
      ],
    },
  },
} as const


// ---------------------------------------------------------------------------
// Legacy named exports (type aliases over the generated Database type).
// ---------------------------------------------------------------------------

export type Organization = Tables<"organizations">
export type Location = Tables<"locations">
export type User = Tables<"users">
export type Terminal = Tables<"terminals">
export type MenuCategory = Tables<"menu_categories">
export type MenuItem = Tables<"menu_items">
export type ModifierGroup = Tables<"modifier_groups">
export type Modifier = Tables<"modifiers">
export type PriceLevel = Tables<"price_levels">
export type PriceLevelPrice = Tables<"price_level_prices">
export type Order = Tables<"orders">
export type OrderItem = Tables<"order_items">
export type OrderItemModifier = Tables<"order_item_modifiers">
export type Payment = Tables<"payments">
export type TipAdjustment = Tables<"tip_adjustments">
export type FloorPlan = Tables<"floor_plans">
export type Table = Tables<"tables">
export type Shift = Tables<"shifts">
export type TimeEntry = Tables<"time_entries">
export type BreakEntry = Tables<"break_entries">
export type Customer = Tables<"customers">
export type KdsStation = Tables<"kds_stations">
export type KdsTicketEvent = Tables<"kds_ticket_events">
export type GiftCard = Tables<"gift_cards">
export type TaxRate = Tables<"tax_rates">
export type OrgModule = Tables<"org_modules">
export type Permission = Tables<"permissions">
export type RolePermission = Tables<"role_permissions">
export type AuditLog = Tables<"audit_log">
