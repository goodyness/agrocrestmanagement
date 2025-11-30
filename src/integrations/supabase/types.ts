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
      daily_production: {
        Row: {
          comment: string | null
          crates: number
          created_at: string | null
          date: string
          id: string
          pieces: number
          recorded_by: string
        }
        Insert: {
          comment?: string | null
          crates?: number
          created_at?: string | null
          date?: string
          id?: string
          pieces?: number
          recorded_by: string
        }
        Update: {
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
          feed_type_id: string
          id: string
          quantity_in_stock: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          feed_type_id: string
          id?: string
          quantity_in_stock?: number
          unit: string
          updated_at?: string | null
        }
        Update: {
          feed_type_id?: string
          id?: string
          quantity_in_stock?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_inventory_feed_type_id_fkey"
            columns: ["feed_type_id"]
            isOneToOne: false
            referencedRelation: "feed_types"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_types: {
        Row: {
          created_at: string | null
          feed_name: string
          id: string
          price_per_unit: number
          unit_type: string
        }
        Insert: {
          created_at?: string | null
          feed_name: string
          id?: string
          price_per_unit?: number
          unit_type: string
        }
        Update: {
          created_at?: string | null
          feed_name?: string
          id?: string
          price_per_unit?: number
          unit_type?: string
        }
        Relationships: []
      }
      livestock_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      livestock_census: {
        Row: {
          created_at: string | null
          id: string
          livestock_category_id: string
          total_count: number
          updated_at: string | null
          updated_count: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          livestock_category_id: string
          total_count?: number
          updated_at?: string | null
          updated_count?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          livestock_category_id?: string
          total_count?: number
          updated_at?: string | null
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "livestock_census_livestock_category_id_fkey"
            columns: ["livestock_category_id"]
            isOneToOne: false
            referencedRelation: "livestock_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      miscellaneous_expenses: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          date: string
          description: string | null
          expense_type: string
          id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          date?: string
          description?: string | null
          expense_type: string
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          date?: string
          description?: string | null
          expense_type?: string
          id?: string
        }
        Relationships: [
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
          created_at: string | null
          date: string
          id: string
          livestock_category_id: string
          quantity_dead: number
          reason: string | null
          recorded_by: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          livestock_category_id: string
          quantity_dead: number
          reason?: string | null
          recorded_by: string
        }
        Update: {
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
          created_at: string | null
          id: string
          name: string
          phone: string | null
          profile_photo: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sales_records: {
        Row: {
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
            foreignKeyName: "sales_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
