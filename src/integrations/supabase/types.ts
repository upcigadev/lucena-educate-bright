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
      aluno_responsaveis: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          parentesco: string | null
          responsavel_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          parentesco?: string | null
          responsavel_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          parentesco?: string | null
          responsavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_responsaveis_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_responsaveis_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_turma_historico: {
        Row: {
          aluno_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          observacao: string | null
          serie_nome: string | null
          turma_id: string | null
          turma_nome: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          observacao?: string | null
          serie_nome?: string | null
          turma_id?: string | null
          turma_nome: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          observacao?: string | null
          serie_nome?: string | null
          turma_id?: string | null
          turma_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_turma_historico_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_turma_historico_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          ativo: boolean
          created_at: string
          data_nascimento: string | null
          escola_id: string
          id: string
          matricula: string
          nome_completo: string
          responsavel_id: string | null
          turma_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          escola_id: string
          id?: string
          matricula: string
          nome_completo: string
          responsavel_id?: string | null
          turma_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          escola_id?: string
          id?: string
          matricula?: string
          nome_completo?: string
          responsavel_id?: string | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      diretores: {
        Row: {
          escola_id: string
          id: string
          usuario_id: string
        }
        Insert: {
          escola_id: string
          id?: string
          usuario_id: string
        }
        Update: {
          escola_id?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diretores_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diretores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      escolas: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          inep: string | null
          nome: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          inep?: string | null
          nome: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          inep?: string | null
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      professor_escolas: {
        Row: {
          escola_id: string
          id: string
          professor_id: string
        }
        Insert: {
          escola_id: string
          id?: string
          professor_id: string
        }
        Update: {
          escola_id?: string
          id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_escolas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_escolas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
        ]
      }
      professores: {
        Row: {
          id: string
          usuario_id: string
        }
        Insert: {
          id?: string
          usuario_id: string
        }
        Update: {
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      responsaveis: {
        Row: {
          id: string
          telefone: string | null
          usuario_id: string
        }
        Insert: {
          id?: string
          telefone?: string | null
          usuario_id: string
        }
        Update: {
          id?: string
          telefone?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          escola_id: string
          horario_inicio: string | null
          id: string
          limite_max: string | null
          nome: string
          tolerancia_min: number | null
        }
        Insert: {
          created_at?: string
          escola_id: string
          horario_inicio?: string | null
          id?: string
          limite_max?: string | null
          nome: string
          tolerancia_min?: number | null
        }
        Update: {
          created_at?: string
          escola_id?: string
          horario_inicio?: string | null
          id?: string
          limite_max?: string | null
          nome?: string
          tolerancia_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "series_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
        ]
      }
      turma_professores: {
        Row: {
          id: string
          professor_id: string
          turma_id: string
        }
        Insert: {
          id?: string
          professor_id: string
          turma_id: string
        }
        Update: {
          id?: string
          professor_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_professores_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          created_at: string
          escola_id: string
          horario_inicio: string | null
          id: string
          limite_max: string | null
          nome: string
          sala: string | null
          serie_id: string
          tolerancia_min: number | null
        }
        Insert: {
          created_at?: string
          escola_id: string
          horario_inicio?: string | null
          id?: string
          limite_max?: string | null
          nome: string
          sala?: string | null
          serie_id: string
          tolerancia_min?: number | null
        }
        Update: {
          created_at?: string
          escola_id?: string
          horario_inicio?: string | null
          id?: string
          limite_max?: string | null
          nome?: string
          sala?: string | null
          serie_id?: string
          tolerancia_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_escola_id_fkey"
            columns: ["escola_id"]
            isOneToOne: false
            referencedRelation: "escolas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          auth_id: string | null
          cpf: string
          created_at: string
          email: string | null
          id: string
          nome: string
          papel: string
        }
        Insert: {
          ativo?: boolean
          auth_id?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          papel: string
        }
        Update: {
          ativo?: boolean
          auth_id?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          papel?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_diretor_escola_ids: { Args: { _auth_id: string }; Returns: string[] }
      get_professor_escola_ids: {
        Args: { _auth_id: string }
        Returns: string[]
      }
      get_professor_turma_ids: { Args: { _auth_id: string }; Returns: string[] }
      get_responsavel_aluno_ids: {
        Args: { _auth_id: string }
        Returns: string[]
      }
      get_user_papel: { Args: { _auth_id: string }; Returns: string }
      get_usuario_id: { Args: { _auth_id: string }; Returns: string }
      is_diretor_of_escola: {
        Args: { _auth_id: string; _escola_id: string }
        Returns: boolean
      }
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
