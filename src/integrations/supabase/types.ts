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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notes: {
        Row: {
          branch_id: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          image_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      cleaning_records: {
        Row: {
          branch_id: string | null
          cleaning_date: string
          completed_at: string
          completed_by: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          branch_id?: string | null
          cleaning_date: string
          completed_at?: string
          completed_by: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          branch_id?: string | null
          cleaning_date?: string
          completed_at?: string
          completed_by?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_schedules: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          interval_days: number
          is_active: boolean
          start_date: string
          tasks: string[] | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          interval_days?: number
          is_active?: boolean
          start_date?: string
          tasks?: string[] | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          interval_days?: number
          is_active?: boolean
          start_date?: string
          tasks?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_production: {
        Row: {
          branch_id: string | null
          comment: string | null
          crates: number
          created_at: string | null
          date: string
          id: string
          pieces: number
          recorded_by: string
        }
        Insert: {
          branch_id?: string | null
          comment?: string | null
          crates?: number
          created_at?: string | null
          date?: string
          id?: string
          pieces?: number
          recorded_by: string
        }
        Update: {
          branch_id?: string | null
          comment?: string | null
          crates?: number
          created_at?: string | null
          date?: string
          id?: string
          pieces?: number
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_production_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_production_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_consumption: {
        Row: {
          branch_id: string | null
          created_at: string | null
          date: string
          feed_type_id: string
          id: string
          livestock_category_id: string
          quantity_used: number
          recorded_by: string
          unit: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          date?: string
          feed_type_id: string
          id?: string
          livestock_category_id: string
          quantity_used: number
          recorded_by: string
          unit: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          date?: string
          feed_type_id?: string
          id?: string
          livestock_category_id?: string
          quantity_used?: number
          recorded_by?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_consumption_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_consumption_feed_type_id_fkey"
            columns: ["feed_type_id"]
            isOneToOne: false
            referencedRelation: "feed_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_consumption_livestock_category_id_fkey"
            columns: ["livestock_category_id"]
            isOneToOne: false
            referencedRelation: "livestock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_consumption_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_inventory: {
        Row: {
          branch_id: string | null
          feed_type_id: string
          id: string
          quantity_in_stock: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          feed_type_id: string
          id?: string
          quantity_in_stock?: number
          unit: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          feed_type_id?: string
          id?: string
          quantity_in_stock?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_inventory_feed_type_id_fkey"
            columns: ["feed_type_id"]
            isOneToOne: false
            referencedRelation: "feed_types"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_purchases: {
        Row: {
          branch_id: string | null
          created_at: string
          date: string
          feed_type_id: string
          id: string
          notes: string | null
          price_per_unit: number
          purchased_by: string
          quantity: number
          total_cost: number
          unit: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          date?: string
          feed_type_id: string
          id?: string
          notes?: string | null
          price_per_unit: number
          purchased_by: string
          quantity: number
          total_cost: number
          unit: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          date?: string
          feed_type_id?: string
          id?: string
          notes?: string | null
          price_per_unit?: number
          purchased_by?: string
          quantity?: number
          total_cost?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_purchases_feed_type_id_fkey"
            columns: ["feed_type_id"]
            isOneToOne: false
            referencedRelation: "feed_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_purchases_purchased_by_fkey"
            columns: ["purchased_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_types: {
        Row: {
          branch_id: string | null
          created_at: string | null
          feed_name: string
          id: string
          price_per_unit: number
          unit_type: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          feed_name: string
          id?: string
          price_per_unit?: number
          unit_type: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          feed_name?: string
          id?: string
          price_per_unit?: number
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_types_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      livestock_categories: {
        Row: {
          branch_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestock_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      livestock_census: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          livestock_category_id: string
          total_count: number
          updated_at: string | null
          updated_count: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          livestock_category_id: string
          total_count?: number
          updated_at?: string | null
          updated_count?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          livestock_category_id?: string
          total_count?: number
          updated_at?: string | null
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "livestock_census_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_census_livestock_category_id_fkey"
            columns: ["livestock_category_id"]
            isOneToOne: false
            referencedRelation: "livestock_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_alerts: {
        Row: {
          branch_id: string | null
          created_at: string
          feed_type_id: string
          id: string
          is_active: boolean
          last_alert_sent: string | null
          threshold_quantity: number
          threshold_unit: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          feed_type_id: string
          id?: string
          is_active?: boolean
          last_alert_sent?: string | null
          threshold_quantity?: number
          threshold_unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          feed_type_id?: string
          id?: string
          is_active?: boolean
          last_alert_sent?: string | null
          threshold_quantity?: number
          threshold_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "low_stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "low_stock_alerts_feed_type_id_fkey"
            columns: ["feed_type_id"]
            isOneToOne: false
            referencedRelation: "feed_types"
            referencedColumns: ["id"]
          },
        ]
      }
      miscellaneous_expenses: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string
          date: string
          description: string | null
          expense_type: string
          id: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by: string
          date?: string
          description?: string | null
          expense_type: string
          id?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string
          date?: string
          description?: string | null
          expense_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miscellaneous_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miscellaneous_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mortality_records: {
        Row: {
          branch_id: string | null
          created_at: string | null
          date: string
          id: string
          livestock_category_id: string
          quantity_dead: number
          reason: string | null
          recorded_by: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          livestock_category_id: string
          quantity_dead: number
          reason?: string | null
          recorded_by: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          livestock_category_id?: string
          quantity_dead?: number
          reason?: string | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "mortality_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortality_records_livestock_category_id_fkey"
            columns: ["livestock_category_id"]
            isOneToOne: false
            referencedRelation: "livestock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mortality_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          profile_photo: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id: string
          name: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_records: {
        Row: {
          branch_id: string | null
          buyer_name: string | null
          created_at: string | null
          date: string
          id: string
          price_per_unit: number
          product_name: string
          product_type: string
          quantity: number
          recorded_by: string
          total_amount: number
          unit: string
        }
        Insert: {
          branch_id?: string | null
          buyer_name?: string | null
          created_at?: string | null
          date?: string
          id?: string
          price_per_unit: number
          product_name: string
          product_type: string
          quantity: number
          recorded_by: string
          total_amount: number
          unit: string
        }
        Update: {
          branch_id?: string | null
          buyer_name?: string | null
          created_at?: string | null
          date?: string
          id?: string
          price_per_unit?: number
          product_name?: string
          product_type?: string
          quantity?: number
          recorded_by?: string
          total_amount?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_type: string
          branch_id: string | null
          crates: number
          created_at: string
          description: string | null
          id: string
          pieces: number
          reconciliation_id: string
          recorded_by: string
        }
        Insert: {
          adjustment_type: string
          branch_id?: string | null
          crates?: number
          created_at?: string
          description?: string | null
          id?: string
          pieces?: number
          reconciliation_id: string
          recorded_by: string
        }
        Update: {
          adjustment_type?: string
          branch_id?: string | null
          crates?: number
          created_at?: string
          description?: string | null
          id?: string
          pieces?: number
          reconciliation_id?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "stock_reconciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliations: {
        Row: {
          adjustment_crates: number
          adjustment_pieces: number
          balanced_at: string | null
          balanced_by: string | null
          branch_id: string | null
          closing_stock_crates: number
          closing_stock_pieces: number
          created_at: string
          expected_closing_crates: number
          expected_closing_pieces: number
          id: string
          is_balanced: boolean
          notes: string | null
          opening_stock_crates: number
          opening_stock_pieces: number
          period_end: string
          period_start: string
          period_type: string
          status: string
          total_production_crates: number
          total_production_pieces: number
          total_sales_crates: number
          total_sales_pieces: number
          updated_at: string
        }
        Insert: {
          adjustment_crates?: number
          adjustment_pieces?: number
          balanced_at?: string | null
          balanced_by?: string | null
          branch_id?: string | null
          closing_stock_crates?: number
          closing_stock_pieces?: number
          created_at?: string
          expected_closing_crates?: number
          expected_closing_pieces?: number
          id?: string
          is_balanced?: boolean
          notes?: string | null
          opening_stock_crates?: number
          opening_stock_pieces?: number
          period_end: string
          period_start: string
          period_type: string
          status?: string
          total_production_crates?: number
          total_production_pieces?: number
          total_sales_crates?: number
          total_sales_pieces?: number
          updated_at?: string
        }
        Update: {
          adjustment_crates?: number
          adjustment_pieces?: number
          balanced_at?: string | null
          balanced_by?: string | null
          branch_id?: string | null
          closing_stock_crates?: number
          closing_stock_pieces?: number
          created_at?: string
          expected_closing_crates?: number
          expected_closing_pieces?: number
          id?: string
          is_balanced?: boolean
          notes?: string | null
          opening_stock_crates?: number
          opening_stock_pieces?: number
          period_end?: string
          period_start?: string
          period_type?: string
          status?: string
          total_production_crates?: number
          total_production_pieces?: number
          total_sales_crates?: number
          total_sales_pieces?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliations_balanced_by_fkey"
            columns: ["balanced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_records: {
        Row: {
          administered_by: string
          administered_date: string
          branch_id: string | null
          created_at: string | null
          id: string
          livestock_category_id: string
          next_due_date: string
          notes: string | null
          vaccination_type_id: string
        }
        Insert: {
          administered_by: string
          administered_date?: string
          branch_id?: string | null
          created_at?: string | null
          id?: string
          livestock_category_id: string
          next_due_date: string
          notes?: string | null
          vaccination_type_id: string
        }
        Update: {
          administered_by?: string
          administered_date?: string
          branch_id?: string | null
          created_at?: string | null
          id?: string
          livestock_category_id?: string
          next_due_date?: string
          notes?: string | null
          vaccination_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_records_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_livestock_category_id_fkey"
            columns: ["livestock_category_id"]
            isOneToOne: false
            referencedRelation: "livestock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_vaccination_type_id_fkey"
            columns: ["vaccination_type_id"]
            isOneToOne: false
            referencedRelation: "vaccination_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_schedules: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          is_active: boolean
          last_reminder_sent: string | null
          livestock_category_id: string
          start_date: string
          updated_at: string | null
          vaccination_type_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_reminder_sent?: string | null
          livestock_category_id: string
          start_date?: string
          updated_at?: string | null
          vaccination_type_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_reminder_sent?: string | null
          livestock_category_id?: string
          start_date?: string
          updated_at?: string | null
          vaccination_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_schedules_livestock_category_id_fkey"
            columns: ["livestock_category_id"]
            isOneToOne: false
            referencedRelation: "livestock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_schedules_vaccination_type_id_fkey"
            columns: ["vaccination_type_id"]
            isOneToOne: false
            referencedRelation: "vaccination_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_types: {
        Row: {
          branch_id: string | null
          created_at: string | null
          description: string | null
          id: string
          interval_weeks: number
          name: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          interval_weeks?: number
          name: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          interval_weeks?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_types_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "worker"
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
      app_role: ["admin", "worker"],
    },
  },
} as const
