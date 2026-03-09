// TypeScript types generated for Supabase database schema
// These types ensure type-safety when interacting with the database

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      directory_links: {
        Row: {
          id: string
          name: string
          url: string
          description: string | null
          category: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          description?: string | null
          category?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          description?: string | null
          category?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          id: string
          name: string
          label: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          label: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          label?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports_daily: {
        Row: {
          id: string
          branch_id: string
          report_date: string
          date_range_start: string
          date_range_end: string
          transactions_file_name: string | null
          mapping_file_name: string | null
          summary_json: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          report_date: string
          date_range_start: string
          date_range_end: string
          transactions_file_name?: string | null
          mapping_file_name?: string | null
          summary_json: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          report_date?: string
          date_range_start?: string
          date_range_end?: string
          transactions_file_name?: string | null
          mapping_file_name?: string | null
          summary_json?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_daily_branch_id_fkey"
            columns: ["branch_id"]
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }
      reports_monthly: {
        Row: {
          id: string
          branch_id: string | null
          month_key: string
          date_range_start: string
          date_range_end: string
          summary_json: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id?: string | null
          month_key: string
          date_range_start: string
          date_range_end: string
          summary_json: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string | null
          month_key?: string
          date_range_start?: string
          date_range_end?: string
          summary_json?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_monthly_branch_id_fkey"
            columns: ["branch_id"]
            referencedRelation: "branches"
            referencedColumns: ["id"]
          }
        ]
      }
    }
      manual_mappings: {
        Row: {
          id: string
          source_category: string
          source_item: string
          source_option: string
          mapped_category: string
          mapped_item_name: string
          priority: number
          is_active: boolean
          notes: string | null
          source_cat_norm: string
          source_item_norm: string
          source_opt_norm: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_category?: string
          source_item: string
          source_option?: string
          mapped_category: string
          mapped_item_name: string
          priority?: number
          is_active?: boolean
          notes?: string | null
          source_cat_norm?: string
          source_item_norm: string
          source_opt_norm?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_category?: string
          source_item?: string
          source_option?: string
          mapped_category?: string
          mapped_item_name?: string
          priority?: number
          is_active?: boolean
          notes?: string | null
          source_cat_norm?: string
          source_item_norm?: string
          source_opt_norm?: string
          created_at?: string
          updated_at?: string
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
