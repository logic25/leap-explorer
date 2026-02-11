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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
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
      positions: {
        Row: {
          allocation: number | null
          avg_cost: number | null
          closed_at: string | null
          created_at: string
          current_price: number | null
          delta: number | null
          dte: number | null
          exit_price: number | null
          exit_reason: string | null
          expiry: string | null
          highest_pnl_pct: number | null
          id: string
          name: string | null
          option_type: string
          pnl: number | null
          pnl_pct: number | null
          profit_target_pct: number | null
          qty: number
          status: string
          stop_loss_pct: number | null
          strike: number
          suggestion: string | null
          suggestion_type: string | null
          ticker: string
          trailing_active: boolean
          trailing_stop_pct: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allocation?: number | null
          avg_cost?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          delta?: number | null
          dte?: number | null
          exit_price?: number | null
          exit_reason?: string | null
          expiry?: string | null
          highest_pnl_pct?: number | null
          id?: string
          name?: string | null
          option_type?: string
          pnl?: number | null
          pnl_pct?: number | null
          profit_target_pct?: number | null
          qty?: number
          status?: string
          stop_loss_pct?: number | null
          strike: number
          suggestion?: string | null
          suggestion_type?: string | null
          ticker: string
          trailing_active?: boolean
          trailing_stop_pct?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allocation?: number | null
          avg_cost?: number | null
          closed_at?: string | null
          created_at?: string
          current_price?: number | null
          delta?: number | null
          dte?: number | null
          exit_price?: number | null
          exit_reason?: string | null
          expiry?: string | null
          highest_pnl_pct?: number | null
          id?: string
          name?: string | null
          option_type?: string
          pnl?: number | null
          pnl_pct?: number | null
          profit_target_pct?: number | null
          qty?: number
          status?: string
          stop_loss_pct?: number | null
          strike?: number
          suggestion?: string | null
          suggestion_type?: string | null
          ticker?: string
          trailing_active?: boolean
          trailing_stop_pct?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          stock_watchlist: Json
          telegram_chat_id: string | null
          trading_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          stock_watchlist?: Json
          telegram_chat_id?: string | null
          trading_mode?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          stock_watchlist?: Json
          telegram_chat_id?: string | null
          trading_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      scanner_alerts: {
        Row: {
          all_passed: boolean
          ask_price: number | null
          avg_volume: number | null
          bid_ask_spread: number | null
          change_pct: number | null
          checklist: Json
          confluence_score: string | null
          created_at: string
          delta: number | null
          dte: number | null
          historical_low: number | null
          id: string
          iv_hv_ratio: number | null
          iv_percentile: number | null
          iv_rank: number | null
          name: string | null
          open_interest: number | null
          price: number | null
          rsi: number | null
          scan_date: string
          scanner_type: string
          suggested_expiry: string | null
          suggested_strike: number | null
          ticker: string
          user_id: string
          volume: number | null
        }
        Insert: {
          all_passed?: boolean
          ask_price?: number | null
          avg_volume?: number | null
          bid_ask_spread?: number | null
          change_pct?: number | null
          checklist?: Json
          confluence_score?: string | null
          created_at?: string
          delta?: number | null
          dte?: number | null
          historical_low?: number | null
          id?: string
          iv_hv_ratio?: number | null
          iv_percentile?: number | null
          iv_rank?: number | null
          name?: string | null
          open_interest?: number | null
          price?: number | null
          rsi?: number | null
          scan_date?: string
          scanner_type: string
          suggested_expiry?: string | null
          suggested_strike?: number | null
          ticker: string
          user_id: string
          volume?: number | null
        }
        Update: {
          all_passed?: boolean
          ask_price?: number | null
          avg_volume?: number | null
          bid_ask_spread?: number | null
          change_pct?: number | null
          checklist?: Json
          confluence_score?: string | null
          created_at?: string
          delta?: number | null
          dte?: number | null
          historical_low?: number | null
          id?: string
          iv_hv_ratio?: number | null
          iv_percentile?: number | null
          iv_rank?: number | null
          name?: string | null
          open_interest?: number | null
          price?: number | null
          rsi?: number | null
          scan_date?: string
          scanner_type?: string
          suggested_expiry?: string | null
          suggested_strike?: number | null
          ticker?: string
          user_id?: string
          volume?: number | null
        }
        Relationships: []
      }
      strategies: {
        Row: {
          conditions: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          name: string
          scanner_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          name: string
          scanner_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          scanner_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
