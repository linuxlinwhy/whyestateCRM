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
      boards: {
        Row: {
          color: string
          created_at: string
          id: string
          location: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          location?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          board_id: string | null
          created_at: string
          id: string
          key: string
          label: string
          options: Json
          position: number
          type: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          id?: string
          key: string
          label: string
          options?: Json
          position?: number
          type?: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          position?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_values: {
        Row: {
          field_id: string
          prospect_id: string
          updated_at: string
          value: string
        }
        Insert: {
          field_id: string
          prospect_id: string
          updated_at?: string
          value?: string
        }
        Update: {
          field_id?: string
          prospect_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_values_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_batch_items: {
        Row: {
          active_version: number
          analysis: Json | null
          batch_id: string
          created_at: string
          error: string | null
          fal_original_url: string | null
          filename: string
          id: string
          idx: number
          original_h: number | null
          original_w: number | null
          status: string
          status_label: string | null
          updated_at: string
          versions: Json
        }
        Insert: {
          active_version?: number
          analysis?: Json | null
          batch_id: string
          created_at?: string
          error?: string | null
          fal_original_url?: string | null
          filename: string
          id?: string
          idx: number
          original_h?: number | null
          original_w?: number | null
          status?: string
          status_label?: string | null
          updated_at?: string
          versions?: Json
        }
        Update: {
          active_version?: number
          analysis?: Json | null
          batch_id?: string
          created_at?: string
          error?: string | null
          fal_original_url?: string | null
          filename?: string
          id?: string
          idx?: number
          original_h?: number | null
          original_w?: number | null
          status?: string
          status_label?: string | null
          updated_at?: string
          versions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "photo_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "photo_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_batches: {
        Row: {
          created_at: string
          id: string
          name: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_email?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          asking_price: string
          asking_rent: string
          availability: string
          board_id: string | null
          calling_status: string
          created_at: string
          furnishing: string
          id: string
          listing_type: string
          name: string
          phone: string
          position: number
          remark: string
          size: string
          type: string
          unit_no: string
          updated_at: string
        }
        Insert: {
          asking_price?: string
          asking_rent?: string
          availability?: string
          board_id?: string | null
          calling_status?: string
          created_at?: string
          furnishing?: string
          id?: string
          listing_type?: string
          name?: string
          phone?: string
          position?: number
          remark?: string
          size?: string
          type?: string
          unit_no?: string
          updated_at?: string
        }
        Update: {
          asking_price?: string
          asking_rent?: string
          availability?: string
          board_id?: string | null
          calling_status?: string
          created_at?: string
          furnishing?: string
          id?: string
          listing_type?: string
          name?: string
          phone?: string
          position?: number
          remark?: string
          size?: string
          type?: string
          unit_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
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
