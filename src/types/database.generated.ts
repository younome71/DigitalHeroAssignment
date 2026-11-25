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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      designs: {
        Row: {
          artwork_source: string
          canvas_json: Json
          config_snapshot: Json
          created_at: string
          customer_id: string
          id: string
          name: string
          product_id: string
          template_id: string | null
          thumbnail_url: string | null
          updated_at: string
          uploaded_artwork_url: string | null
        }
        Insert: {
          artwork_source?: string
          canvas_json?: Json
          config_snapshot?: Json
          created_at?: string
          customer_id: string
          id?: string
          name?: string
          product_id: string
          template_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_artwork_url?: string | null
        }
        Update: {
          artwork_source?: string
          canvas_json?: Json
          config_snapshot?: Json
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          product_id?: string
          template_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_artwork_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          accent_color: string
          active: boolean
          created_at: string
          description: string
          hero_image_url: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          active?: boolean
          created_at?: string
          description?: string
          hero_image_url?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          active?: boolean
          created_at?: string
          description?: string
          hero_image_url?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          active: boolean
          created_at: string
          customer_name: string | null
          description: string
          division_id: string
          featured: boolean
          id: string
          image_url: string
          sort_order: number
          tags: Json
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_name?: string | null
          description?: string
          division_id: string
          featured?: boolean
          id?: string
          image_url: string
          sort_order?: number
          tags?: Json
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_name?: string | null
          description?: string
          division_id?: string
          featured?: boolean
          id?: string
          image_url?: string
          sort_order?: number
          tags?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          artwork_file_url: string | null
          created_at: string
          csv_merge_file_url: string | null
          design_id: string | null
          height_mm: number
          id: string
          line_total_cents: number
          material: string | null
          order_id: string
          orientation: string | null
          product_id: string
          production_status: Database["public"]["Enums"]["order_status"]
          quantity: number
          spec_snapshot: Json
          unit_price_cents: number
          updated_at: string
          width_mm: number
        }
        Insert: {
          artwork_file_url?: string | null
          created_at?: string
          csv_merge_file_url?: string | null
          design_id?: string | null
          height_mm: number
          id?: string
          line_total_cents: number
          material?: string | null
          order_id: string
          orientation?: string | null
          product_id: string
          production_status?: Database["public"]["Enums"]["order_status"]
          quantity: number
          spec_snapshot?: Json
          unit_price_cents: number
          updated_at?: string
          width_mm: number
        }
        Update: {
          artwork_file_url?: string | null
          created_at?: string
          csv_merge_file_url?: string | null
          design_id?: string | null
          height_mm?: number
          id?: string
          line_total_cents?: number
          material?: string | null
          order_id?: string
          orientation?: string | null
          product_id?: string
          production_status?: Database["public"]["Enums"]["order_status"]
          quantity?: number
          spec_snapshot?: Json
          unit_price_cents?: number
          updated_at?: string
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          customer_id: string
          discount_cents: number
          id: string
          notes: string | null
          order_number: string
          paid_at: string | null
          shipping_address: Json | null
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          total_cents: number
          updated_at: string
          vat_cents: number
          xero_exported_at: string | null
          xero_invoice_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id: string
          discount_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          vat_cents?: number
          xero_exported_at?: string | null
          xero_invoice_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string
          discount_cents?: number
          id?: string
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          vat_cents?: number
          xero_exported_at?: string | null
          xero_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          created_at: string
          file_type: Database["public"]["Enums"]["print_job_file_type"]
          file_url: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          metadata: Json
          order_item_id: string
          proof_id: string
          status: Database["public"]["Enums"]["print_job_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_type: Database["public"]["Enums"]["print_job_file_type"]
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json
          order_item_id: string
          proof_id: string
          status?: Database["public"]["Enums"]["print_job_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_type?: Database["public"]["Enums"]["print_job_file_type"]
          file_url?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json
          order_item_id?: string
          proof_id?: string
          status?: Database["public"]["Enums"]["print_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "proofs"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          allowed_materials: Json
          allowed_orientations: Json
          base_price_cents: number
          bleed_mm: number
          created_at: string
          description: string
          division_id: string
          id: string
          max_height_mm: number
          max_width_mm: number
          min_height_mm: number
          min_width_mm: number
          name: string
          safe_margin_mm: number
          slug: string
          target_dpi: number
          template_fit_rules: Json
          turnaround_days: number
          updated_at: string
          vat_percent: number
          volume_discount_tiers: Json
          xero_account_code: string
        }
        Insert: {
          active?: boolean
          allowed_materials?: Json
          allowed_orientations?: Json
          base_price_cents: number
          bleed_mm?: number
          created_at?: string
          description?: string
          division_id: string
          id?: string
          max_height_mm: number
          max_width_mm: number
          min_height_mm: number
          min_width_mm: number
          name: string
          safe_margin_mm?: number
          slug: string
          target_dpi?: number
          template_fit_rules?: Json
          turnaround_days?: number
          updated_at?: string
          vat_percent?: number
          volume_discount_tiers?: Json
          xero_account_code?: string
        }
        Update: {
          active?: boolean
          allowed_materials?: Json
          allowed_orientations?: Json
          base_price_cents?: number
          bleed_mm?: number
          created_at?: string
          description?: string
          division_id?: string
          id?: string
          max_height_mm?: number
          max_width_mm?: number
          min_height_mm?: number
          min_width_mm?: number
          name?: string
          safe_margin_mm?: number
          slug?: string
          target_dpi?: number
          template_fit_rules?: Json
          turnaround_days?: number
          updated_at?: string
          vat_percent?: number
          volume_discount_tiers?: Json
          xero_account_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          xero_contact_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          xero_contact_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          xero_contact_id?: string | null
        }
        Relationships: []
      }
      proof_logs: {
        Row: {
          action: Database["public"]["Enums"]["proof_action"]
          created_at: string
          id: string
          notes: string | null
          proof_id: string
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["proof_action"]
          created_at?: string
          id?: string
          notes?: string | null
          proof_id: string
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["proof_action"]
          created_at?: string
          id?: string
          notes?: string | null
          proof_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proof_logs_proof_id_fkey"
            columns: ["proof_id"]
            isOneToOne: false
            referencedRelation: "proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proofs: {
        Row: {
          approved_at: string | null
          created_at: string
          file_url: string
          id: string
          order_item_id: string
          status: Database["public"]["Enums"]["proof_status"]
          thumbnail_url: string | null
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          file_url: string
          id?: string
          order_item_id: string
          status?: Database["public"]["Enums"]["proof_status"]
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          file_url?: string
          id?: string
          order_item_id?: string
          status?: Database["public"]["Enums"]["proof_status"]
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proofs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          active: boolean
          background_url: string | null
          canvas_height_px: number
          canvas_width_px: number
          created_at: string
          id: string
          name: string
          placeholder_definitions: Json
          preview_url: string | null
          print_area: Json
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          background_url?: string | null
          canvas_height_px: number
          canvas_width_px: number
          created_at?: string
          id?: string
          name: string
          placeholder_definitions?: Json
          preview_url?: string | null
          print_area: Json
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          background_url?: string | null
          canvas_height_px?: number
          canvas_width_px?: number
          created_at?: string
          id?: string
          name?: string
          placeholder_definitions?: Json
          preview_url?: string | null
          print_area?: Json
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      order_status:
        | "quote"
        | "order"
        | "artwork"
        | "proof"
        | "production"
        | "completed"
        | "cancelled"
      print_job_file_type: "pdf" | "png" | "zip"
      print_job_status: "pending" | "processing" | "ready" | "failed"
      proof_action: "uploaded" | "approved" | "rejected" | "change_requested"
      proof_status: "pending" | "approved" | "rejected" | "superseded"
      user_role: "customer" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      order_status: [
        "quote",
        "order",
        "artwork",
        "proof",
        "production",
        "completed",
        "cancelled",
      ],
      print_job_file_type: ["pdf", "png", "zip"],
      print_job_status: ["pending", "processing", "ready", "failed"],
      proof_action: ["uploaded", "approved", "rejected", "change_requested"],
      proof_status: ["pending", "approved", "rejected", "superseded"],
      user_role: ["customer", "admin"],
    },
  },
} as const
