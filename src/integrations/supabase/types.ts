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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      client_access_tokens: {
        Row: {
          active: boolean | null
          client_email: string | null
          client_name: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          project_id: string
          token: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          project_id: string
          token?: string
        }
        Update: {
          active?: boolean | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          project_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_rate_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
        }
        ComputedFields: never
        Insert: {
          bucket: string
          created_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      cotizacion_eventos: {
        Row: {
          actor: string
          cotizacion_id: string
          detalle: NonNullable<Json>
          id: number
          motivo: string | null
          ocurrido_at: string
          tipo: string
        }
        ComputedFields: never
        Insert: {
          actor: string
          cotizacion_id: string
          detalle?: NonNullable<Json>
          id?: never
          motivo?: string | null
          ocurrido_at?: string
          tipo: string
        }
        Update: {
          actor?: string
          cotizacion_id?: string
          detalle?: NonNullable<Json>
          id?: never
          motivo?: string | null
          ocurrido_at?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_eventos_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          actualizado_at: string
          actualizado_por: string | null
          creado_at: string
          creado_por: string
          estado: string
          id: string
          prospecto_contacto: string | null
          prospecto_email: string | null
          prospecto_nombre: string | null
          prospecto_telefono: string | null
          referencia_interna: string
          row_version: number
        }
        ComputedFields: never
        Insert: {
          actualizado_at?: string
          actualizado_por?: string | null
          creado_at?: string
          creado_por: string
          estado?: string
          id?: string
          prospecto_contacto?: string | null
          prospecto_email?: string | null
          prospecto_nombre?: string | null
          prospecto_telefono?: string | null
          referencia_interna: string
          row_version?: number
        }
        Update: {
          actualizado_at?: string
          actualizado_por?: string | null
          creado_at?: string
          creado_por?: string
          estado?: string
          id?: string
          prospecto_contacto?: string | null
          prospecto_email?: string | null
          prospecto_nombre?: string | null
          prospecto_telefono?: string | null
          referencia_interna?: string
          row_version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          email: string | null
          id: string
          user_type: number
          welcome_email_sent: boolean
        }
        ComputedFields: never
        Insert: {
          email?: string | null
          id: string
          user_type?: number
          welcome_email_sent?: boolean
        }
        Update: {
          email?: string | null
          id?: string
          user_type?: number
          welcome_email_sent?: boolean
        }
        Relationships: []
      }
      project_maintenance: {
        Row: {
          billed: boolean | null
          billed_amount: number | null
          created_at: string | null
          id: string
          month: string
          notes: string | null
          project_id: string
          status: string
          tasks_done: string[] | null
        }
        ComputedFields: never
        Insert: {
          billed?: boolean | null
          billed_amount?: number | null
          created_at?: string | null
          id?: string
          month: string
          notes?: string | null
          project_id: string
          status?: string
          tasks_done?: string[] | null
        }
        Update: {
          billed?: boolean | null
          billed_amount?: number | null
          created_at?: string | null
          id?: string
          month?: string
          notes?: string | null
          project_id?: string
          status?: string
          tasks_done?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_maintenance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      project_services: {
        Row: {
          cost_monthly: number | null
          cost_yearly: number | null
          created_at: string | null
          currency: string | null
          id: string
          name: string
          notes: string | null
          project_id: string
          provider: string
          renewal_date: string | null
          service_type: string
          url: string | null
        }
        ComputedFields: never
        Insert: {
          cost_monthly?: number | null
          cost_yearly?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          name: string
          notes?: string | null
          project_id: string
          provider: string
          renewal_date?: string | null
          service_type: string
          url?: string | null
        }
        Update: {
          cost_monthly?: number | null
          cost_yearly?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string
          provider?: string
          renewal_date?: string | null
          service_type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          completed_at: string
          completed_by: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          project_id: string
          stage_key: string
          stage_label: string
        }
        ComputedFields: never
        Insert: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          project_id: string
          stage_key: string
          stage_label: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          project_id?: string
          stage_key?: string
          stage_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos_clientes: {
        Row: {
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          deadline: string | null
          descripcion: string | null
          estado: string
          fecha_creacion: string
          google_docs_requirements_url: string | null
          id: string
          lead_developer_id: string | null
          nombre_proyecto: string
          requirements: NonNullable<Json>
          source_ticket_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          deadline?: string | null
          descripcion?: string | null
          estado?: string
          fecha_creacion?: string
          google_docs_requirements_url?: string | null
          id?: string
          lead_developer_id?: string | null
          nombre_proyecto: string
          requirements?: NonNullable<Json>
          source_ticket_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          deadline?: string | null
          descripcion?: string | null
          estado?: string
          fecha_creacion?: string
          google_docs_requirements_url?: string | null
          id?: string
          lead_developer_id?: string | null
          nombre_proyecto?: string
          requirements?: NonNullable<Json>
          source_ticket_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_clientes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_clientes_lead_developer_id_fkey"
            columns: ["lead_developer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_clientes_source_ticket_id_fkey"
            columns: ["source_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender_name: string
          sender_type: string
          ticket_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender_name: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender_name?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: string
          project_id: string | null
          resolved_at: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          assigned_to?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_ticket_to_project: {
        Args: {
          p_deadline: string
          p_description: string
          p_google_docs_url?: string
          p_lead_developer_id: string
          p_requirements: Json
          p_ticket_id: string
          p_title: string
        }
        Returns: string
      }
      get_user_type: { Args: Record<PropertyKey, never>; Returns: number }
      portal_add_message: {
        Args: {
          p_message: string
          p_sender_name: string
          p_ticket_id: string
          p_token: string
        }
        Returns: string
      }
      portal_create_ticket: {
        Args: {
          p_client_email: string
          p_client_name: string
          p_description: string
          p_title: string
          p_token: string
          p_type: string
        }
        Returns: string
      }
      portal_get_messages: {
        Args: { p_ticket_id: string; p_token: string }
        Returns: {
          created_at: string
          id: string
          message: string
          sender_name: string
          sender_type: string
          ticket_id: string
        }[]
      }
      portal_get_project: {
        Args: { p_token: string }
        Returns: {
          client_email: string
          client_name: string
          descripcion: string
          estado: string
          id: string
          nombre_proyecto: string
        }[]
      }
      portal_get_tickets: {
        Args: { p_token: string }
        Returns: {
          client_email: string
          client_name: string
          created_at: string
          description: string
          id: string
          message_count: number
          priority: string
          project_id: string
          resolved_at: string
          status: string
          title: string
          type: string
          updated_at: string
        }[]
      }
      user_assigned_to_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      user_owns_project: { Args: { p_project_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
