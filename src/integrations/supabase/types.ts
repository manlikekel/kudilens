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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          is_emergency_fund: boolean
          kind: string
          name: string
          user_id: string
          yield_rate: number
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_emergency_fund?: boolean
          kind?: string
          name: string
          user_id: string
          yield_rate?: number
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_emergency_fund?: boolean
          kind?: string
          name?: string
          user_id?: string
          yield_rate?: number
        }
        Relationships: []
      }
      advisor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          action: string | null
          batch_at: string
          created_at: string
          finding: string
          id: string
          impact: string | null
          kind: string
          metric: string | null
          severity: string
          snoozed_until: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          action?: string | null
          batch_at?: string
          created_at?: string
          finding: string
          id?: string
          impact?: string | null
          kind: string
          metric?: string | null
          severity?: string
          snoozed_until?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          action?: string | null
          batch_at?: string
          created_at?: string
          finding?: string
          id?: string
          impact?: string | null
          kind?: string
          metric?: string | null
          severity?: string
          snoozed_until?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          appreciation: number
          created_at: string
          currency: string
          current_value: number
          id: string
          kind: string
          liquid: boolean
          name: string
          user_id: string
        }
        Insert: {
          appreciation?: number
          created_at?: string
          currency?: string
          current_value?: number
          id?: string
          kind?: string
          liquid?: boolean
          name: string
          user_id: string
        }
        Update: {
          appreciation?: number
          created_at?: string
          currency?: string
          current_value?: number
          id?: string
          kind?: string
          liquid?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          currency: string
          id: string
          monthly_limit: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          id?: string
          monthly_limit?: number
          user_id?: string
        }
        Relationships: []
      }
      cash_flows: {
        Row: {
          category: string
          created_at: string
          currency: string
          flow_type: string
          growth_rate: number
          id: string
          label: string
          monthly_amount: number
          notes: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          flow_type?: string
          growth_rate?: number
          id?: string
          label: string
          monthly_amount?: number
          notes?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          flow_type?: string
          growth_rate?: number
          id?: string
          label?: string
          monthly_amount?: number
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      category_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          pattern: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          pattern: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          pattern?: string
          user_id?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          balance: number
          created_at: string
          currency: string
          due_date: string | null
          id: string
          interest_rate: number
          kind: string
          minimum_payment: number
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          interest_rate?: number
          kind?: string
          minimum_payment?: number
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          interest_rate?: number
          kind?: string
          minimum_payment?: number
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          age: number
          created_at: string
          currency: string
          dependent: boolean
          id: string
          monthly_cost: number
          name: string
          notes: string | null
          relationship: string
          user_id: string
        }
        Insert: {
          age?: number
          created_at?: string
          currency?: string
          dependent?: boolean
          id?: string
          monthly_cost?: number
          name: string
          notes?: string | null
          relationship?: string
          user_id: string
        }
        Update: {
          age?: number
          created_at?: string
          currency?: string
          dependent?: boolean
          id?: string
          monthly_cost?: number
          name?: string
          notes?: string | null
          relationship?: string
          user_id?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          as_of: string
          currency: string
          per_usd: number
          source: string
        }
        Insert: {
          as_of?: string
          currency: string
          per_usd: number
          source?: string
        }
        Update: {
          as_of?: string
          currency?: string
          per_usd?: number
          source?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          currency: string
          current_saved: number
          goal_inflation: number | null
          id: string
          linked_account_id: string | null
          monthly_contribution: number
          name: string
          priority: number
          saved_in: string
          target_amount: number
          target_month: number
          target_year: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_saved?: number
          goal_inflation?: number | null
          id?: string
          linked_account_id?: string | null
          monthly_contribution?: number
          name: string
          priority?: number
          saved_in?: string
          target_amount?: number
          target_month?: number
          target_year: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_saved?: number
          goal_inflation?: number | null
          id?: string
          linked_account_id?: string | null
          monthly_contribution?: number
          name?: string
          priority?: number
          saved_in?: string
          target_amount?: number
          target_month?: number
          target_year?: number
          user_id?: string
        }
        Relationships: []
      }
      investment_ideas: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          review: Json | null
          reviewed_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          review?: Json | null
          reviewed_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          review?: Json | null
          reviewed_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          asset_class: string
          created_at: string
          currency: string
          current_value: number
          expected_return: number
          id: string
          monthly_contribution: number
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          asset_class?: string
          created_at?: string
          currency?: string
          current_value?: number
          expected_return?: number
          id?: string
          monthly_contribution?: number
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          asset_class?: string
          created_at?: string
          currency?: string
          current_value?: number
          expected_return?: number
          id?: string
          monthly_contribution?: number
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lump_costs: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          label: string
          months: number[]
          saved: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          label: string
          months?: number[]
          saved?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          label?: string
          months?: number[]
          saved?: number
          user_id?: string
        }
        Relationships: []
      }
      monthly_reviews: {
        Row: {
          created_at: string
          id: string
          net_worth: number | null
          period: string
          report: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          net_worth?: number | null
          period: string
          report: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          net_worth?: number | null
          period?: string
          report?: Json
          user_id?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          assets: number
          cash: number
          created_at: string
          currency: string
          debt: number
          id: string
          investments: number
          month: string
          net_worth: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assets?: number
          cash?: number
          created_at?: string
          currency?: string
          debt?: number
          id?: string
          investments?: number
          month: string
          net_worth: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assets?: number
          cash?: number
          created_at?: string
          currency?: string
          debt?: number
          id?: string
          investments?: number
          month?: string
          net_worth?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          base_currency: string
          cash_yield_ratio: number
          created_at: string
          education_inflation: number
          emergency_fund: number
          foreign_inflation: number
          full_name: string | null
          fx_depreciation: number
          fx_overrides: Json
          goals: string | null
          grow_contributions: boolean
          health_cover: number
          id: string
          income_stability: string
          inflation_fx_correlation: number
          inflation_rate: number
          life_cover: number
          retirement_age: number | null
          risk_tolerance: string
          salary_growth: number
          updated_at: string
          usd_ngn_rate: number
        }
        Insert: {
          age?: number | null
          base_currency?: string
          cash_yield_ratio?: number
          created_at?: string
          education_inflation?: number
          emergency_fund?: number
          foreign_inflation?: number
          full_name?: string | null
          fx_depreciation?: number
          fx_overrides?: Json
          goals?: string | null
          grow_contributions?: boolean
          health_cover?: number
          id: string
          income_stability?: string
          inflation_fx_correlation?: number
          inflation_rate?: number
          life_cover?: number
          retirement_age?: number | null
          risk_tolerance?: string
          salary_growth?: number
          updated_at?: string
          usd_ngn_rate?: number
        }
        Update: {
          age?: number | null
          base_currency?: string
          cash_yield_ratio?: number
          created_at?: string
          education_inflation?: number
          emergency_fund?: number
          foreign_inflation?: number
          full_name?: string | null
          fx_depreciation?: number
          fx_overrides?: Json
          goals?: string | null
          grow_contributions?: boolean
          health_cover?: number
          id?: string
          income_stability?: string
          inflation_fx_correlation?: number
          inflation_rate?: number
          life_cover?: number
          retirement_age?: number | null
          risk_tolerance?: string
          salary_growth?: number
          updated_at?: string
          usd_ngn_rate?: number
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          changes: Json
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount_minor: number
          category: string
          created_at: string
          currency: string
          dedupe_key: string
          description: string | null
          id: string
          is_recurring: boolean
          merchant: string
          notes: string | null
          source: string
          txn_date: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_minor: number
          category?: string
          created_at?: string
          currency?: string
          dedupe_key: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          merchant?: string
          notes?: string | null
          source?: string
          txn_date: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount_minor?: number
          category?: string
          created_at?: string
          currency?: string
          dedupe_key?: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          merchant?: string
          notes?: string | null
          source?: string
          txn_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
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
