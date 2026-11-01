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
  public: {
    Tables: {
      brands: {
        Row: {
          description: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_types: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          certificate_type_id: string
          created_at: string
          document_url: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          verification_url: string | null
        }
        Insert: {
          certificate_number: string
          certificate_type_id: string
          created_at?: string
          document_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          verification_url?: string | null
        }
        Update: {
          certificate_number?: string
          certificate_type_id?: string
          created_at?: string
          document_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
        ]
      }
      craftsman_job_labour: {
        Row: {
          amount: number
          created_at: string
          hours: number | null
          id: string
          job_id: string
          labour_type: string
          notes: string | null
          rate: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          hours?: number | null
          id?: string
          job_id: string
          labour_type: string
          notes?: string | null
          rate?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          hours?: number | null
          id?: string
          job_id?: string
          labour_type?: string
          notes?: string | null
          rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_job_labour_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_labour_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
        ]
      }
      craftsman_job_metal_issues: {
        Row: {
          fine_weight_g: number
          gross_weight_g: number
          id: string
          issued_at: string
          issued_by: string | null
          job_id: string
          metal_lot_id: string
          notes: string | null
          purity_percent: number
        }
        Insert: {
          fine_weight_g: number
          gross_weight_g: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          job_id: string
          metal_lot_id: string
          notes?: string | null
          purity_percent: number
        }
        Update: {
          fine_weight_g?: number
          gross_weight_g?: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          job_id?: string
          metal_lot_id?: string
          notes?: string | null
          purity_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_job_metal_issues_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_issues_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "metal_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_issues_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "v_metal_availability"
            referencedColumns: ["metal_lot_id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_issues_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "v_metal_lot_balances"
            referencedColumns: ["metal_lot_id"]
          },
        ]
      }
      craftsman_job_metal_returns: {
        Row: {
          fine_weight_g: number
          gross_weight_g: number
          id: string
          job_id: string
          metal_lot_id: string
          notes: string | null
          purity_percent: number
          received_at: string
          received_by: string | null
          return_kind: string
        }
        Insert: {
          fine_weight_g: number
          gross_weight_g: number
          id?: string
          job_id: string
          metal_lot_id: string
          notes?: string | null
          purity_percent: number
          received_at?: string
          received_by?: string | null
          return_kind?: string
        }
        Update: {
          fine_weight_g?: number
          gross_weight_g?: number
          id?: string
          job_id?: string
          metal_lot_id?: string
          notes?: string | null
          purity_percent?: number
          received_at?: string
          received_by?: string | null
          return_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_job_metal_returns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_returns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_returns_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "metal_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_returns_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "v_metal_availability"
            referencedColumns: ["metal_lot_id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_returns_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "v_metal_lot_balances"
            referencedColumns: ["metal_lot_id"]
          },
          {
            foreignKeyName: "craftsman_job_metal_returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      craftsman_job_payments: {
        Row: {
          amount: number
          craftsman_id: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          payment_date: string
          payment_method: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          craftsman_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          craftsman_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_job_payments_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsmen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
        ]
      }
      craftsman_job_stone_issues: {
        Row: {
          id: string
          issued_at: string
          issued_by: string | null
          job_id: string
          notes: string | null
          stone_item_id: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          job_id: string
          notes?: string | null
          stone_item_id: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by?: string | null
          job_id?: string
          notes?: string | null
          stone_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_job_stone_issues_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_issues_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "stone_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_issues_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "v_stone_sellable"
            referencedColumns: ["id"]
          },
        ]
      }
      craftsman_job_stone_returns: {
        Row: {
          carat_returned: number | null
          id: string
          job_id: string
          notes: string | null
          received_at: string
          received_by: string | null
          return_condition: string
          stone_item_id: string
        }
        Insert: {
          carat_returned?: number | null
          id?: string
          job_id: string
          notes?: string | null
          received_at?: string
          received_by?: string | null
          return_condition: string
          stone_item_id: string
        }
        Update: {
          carat_returned?: number | null
          id?: string
          job_id?: string
          notes?: string | null
          received_at?: string
          received_by?: string | null
          return_condition?: string
          stone_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_job_stone_returns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_returns_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_returns_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "stone_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_job_stone_returns_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "v_stone_sellable"
            referencedColumns: ["id"]
          },
        ]
      }
      craftsman_jobs: {
        Row: {
          completed_at: string | null
          craftsman_id: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          design_id: string | null
          due_date: string | null
          expected_finished_weight_g: number | null
          finished_fine_g: number
          id: string
          inventory_item_id: string | null
          issued_fine_g: number
          job_number: string
          job_type: string
          notes: string | null
          planned_finished_purity_id: string | null
          returned_fine_g: number
          start_date: string | null
          status: string
          updated_at: string
          variant_id: string | null
          wastage_fine_g: number
        }
        Insert: {
          completed_at?: string | null
          craftsman_id: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          design_id?: string | null
          due_date?: string | null
          expected_finished_weight_g?: number | null
          finished_fine_g?: number
          id?: string
          inventory_item_id?: string | null
          issued_fine_g?: number
          job_number: string
          job_type?: string
          notes?: string | null
          planned_finished_purity_id?: string | null
          returned_fine_g?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
          wastage_fine_g?: number
        }
        Update: {
          completed_at?: string | null
          craftsman_id?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          design_id?: string | null
          due_date?: string | null
          expected_finished_weight_g?: number | null
          finished_fine_g?: number
          id?: string
          inventory_item_id?: string | null
          issued_fine_g?: number
          job_number?: string
          job_type?: string
          notes?: string | null
          planned_finished_purity_id?: string | null
          returned_fine_g?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
          wastage_fine_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_jobs_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsmen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "product_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["design_id"]
          },
          {
            foreignKeyName: "craftsman_jobs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_sellable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_planned_finished_purity_id_fkey"
            columns: ["planned_finished_purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "craftsman_jobs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      craftsmen: {
        Row: {
          code: string
          id: string
          is_active: boolean
          is_inhouse: boolean
          kyc: Json | null
          name: string
          phone: string | null
          skill_type: string | null
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          is_inhouse?: boolean
          kyc?: Json | null
          name: string
          phone?: string | null
          skill_type?: string | null
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          is_inhouse?: boolean
          kyc?: Json | null
          name?: string
          phone?: string | null
          skill_type?: string | null
        }
        Relationships: []
      }
      hallmarks: {
        Row: {
          assay_center: string | null
          document_url: string | null
          hallmark_date: string | null
          huid: string | null
          id: string
          inventory_item_id: string
          purity: string | null
          status: string | null
        }
        Insert: {
          assay_center?: string | null
          document_url?: string | null
          hallmark_date?: string | null
          huid?: string | null
          id?: string
          inventory_item_id: string
          purity?: string | null
          status?: string | null
        }
        Update: {
          assay_center?: string | null
          document_url?: string | null
          hallmark_date?: string | null
          huid?: string | null
          id?: string
          inventory_item_id?: string
          purity?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hallmarks_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hallmarks_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_sellable"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_identifiers: {
        Row: {
          id: string
          identifier_type: string
          inventory_item_id: string
          is_primary: boolean
          value: string
        }
        Insert: {
          id?: string
          identifier_type: string
          inventory_item_id: string
          is_primary?: boolean
          value: string
        }
        Update: {
          id?: string
          identifier_type?: string
          inventory_item_id?: string
          is_primary?: boolean
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_identifiers_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_identifiers_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_sellable"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item_stones: {
        Row: {
          carat: number
          id: string
          inventory_item_id: string
          pcs: number
          setting_type: string | null
          stone_item_id: string | null
          stone_lot_id: string | null
          valuation: number
        }
        Insert: {
          carat?: number
          id?: string
          inventory_item_id: string
          pcs?: number
          setting_type?: string | null
          stone_item_id?: string | null
          stone_lot_id?: string | null
          valuation?: number
        }
        Update: {
          carat?: number
          id?: string
          inventory_item_id?: string
          pcs?: number
          setting_type?: string | null
          stone_item_id?: string | null
          stone_lot_id?: string | null
          valuation?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_stones_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_stones_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_sellable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_stones_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "stone_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_stones_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "v_stone_sellable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_stones_stone_lot_id_fkey"
            columns: ["stone_lot_id"]
            isOneToOne: false
            referencedRelation: "stone_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          component_snapshot: Json | null
          cost_price: number
          craftsman_job_id: string | null
          created_at: string
          floor_price: number | null
          gross_weight_g: number
          id: string
          inventory_tag: string
          location_id: string | null
          metal_purity_id: string | null
          net_fine_weight_g: number
          net_metal_weight_g: number
          pricing_snapshot: Json | null
          sold_at: string | null
          source_reference: string | null
          source_type: string | null
          status: string
          stone_carat_total: number
          stone_pcs_total: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          component_snapshot?: Json | null
          cost_price?: number
          craftsman_job_id?: string | null
          created_at?: string
          floor_price?: number | null
          gross_weight_g?: number
          id?: string
          inventory_tag: string
          location_id?: string | null
          metal_purity_id?: string | null
          net_fine_weight_g?: number
          net_metal_weight_g?: number
          pricing_snapshot?: Json | null
          sold_at?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string
          stone_carat_total?: number
          stone_pcs_total?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          component_snapshot?: Json | null
          cost_price?: number
          craftsman_job_id?: string | null
          created_at?: string
          floor_price?: number | null
          gross_weight_g?: number
          id?: string
          inventory_tag?: string
          location_id?: string | null
          metal_purity_id?: string | null
          net_fine_weight_g?: number
          net_metal_weight_g?: number
          pricing_snapshot?: Json | null
          sold_at?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string
          stone_carat_total?: number
          stone_pcs_total?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_craftsman_job_fk"
            columns: ["craftsman_job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_craftsman_job_fk"
            columns: ["craftsman_job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_metal_purity_id_fkey"
            columns: ["metal_purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          from_location_id: string | null
          id: string
          inventory_item_id: string
          notes: string | null
          performed_by: string | null
          reference_id: string | null
          reference_type: string | null
          status_from: string | null
          status_to: string | null
          to_location_id: string | null
          txn_type: string
        }
        Insert: {
          created_at?: string
          from_location_id?: string | null
          id?: string
          inventory_item_id: string
          notes?: string | null
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status_from?: string | null
          status_to?: string | null
          to_location_id?: string | null
          txn_type: string
        }
        Update: {
          created_at?: string
          from_location_id?: string | null
          id?: string
          inventory_item_id?: string
          notes?: string | null
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status_from?: string | null
          status_to?: string | null
          to_location_id?: string | null
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_sellable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      manufacturing_variance: {
        Row: {
          component_id: string | null
          component_type: string
          consumed_quantity: number | null
          created_at: string
          expected_quantity: number | null
          id: string
          issued_quantity: number | null
          job_id: string
          returned_quantity: number | null
          variance_quantity: number | null
          variance_reason: string | null
        }
        Insert: {
          component_id?: string | null
          component_type: string
          consumed_quantity?: number | null
          created_at?: string
          expected_quantity?: number | null
          id?: string
          issued_quantity?: number | null
          job_id: string
          returned_quantity?: number | null
          variance_quantity?: number | null
          variance_reason?: string | null
        }
        Update: {
          component_id?: string | null
          component_type?: string
          consumed_quantity?: number | null
          created_at?: string
          expected_quantity?: number | null
          id?: string
          issued_quantity?: number | null
          job_id?: string
          returned_quantity?: number | null
          variance_quantity?: number | null
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_variance_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_variance_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
        ]
      }
      metal_lots: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          lot_number: string
          notes: string | null
          opening_fine_weight_g: number
          purity_id: string
          rate_per_gram: number
          received_date: string
          source: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          lot_number: string
          notes?: string | null
          opening_fine_weight_g?: number
          purity_id: string
          rate_per_gram?: number
          received_date?: string
          source: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          lot_number?: string
          notes?: string | null
          opening_fine_weight_g?: number
          purity_id?: string
          rate_per_gram?: number
          received_date?: string
          source?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metal_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_lots_purity_id_fkey"
            columns: ["purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_lots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_purities: {
        Row: {
          code: string
          id: string
          is_active: boolean
          metal_type_id: string
          purity_percent: number
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          metal_type_id: string
          purity_percent: number
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          metal_type_id?: string
          purity_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "metal_purities_metal_type_id_fkey"
            columns: ["metal_type_id"]
            isOneToOne: false
            referencedRelation: "metal_types"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_rates: {
        Row: {
          created_by: string | null
          effective_from: string
          id: string
          purity_id: string
          rate_per_gram: number
          source: string | null
        }
        Insert: {
          created_by?: string | null
          effective_from?: string
          id?: string
          purity_id: string
          rate_per_gram: number
          source?: string | null
        }
        Update: {
          created_by?: string | null
          effective_from?: string
          id?: string
          purity_id?: string
          rate_per_gram?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metal_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_rates_purity_id_fkey"
            columns: ["purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_transactions: {
        Row: {
          created_at: string
          fine_weight_change_g: number
          id: string
          location_id: string | null
          metal_lot_id: string
          notes: string | null
          performed_by: string | null
          reference_id: string | null
          reference_type: string | null
          txn_type: string
        }
        Insert: {
          created_at?: string
          fine_weight_change_g: number
          id?: string
          location_id?: string | null
          metal_lot_id: string
          notes?: string | null
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          txn_type: string
        }
        Update: {
          created_at?: string
          fine_weight_change_g?: number
          id?: string
          location_id?: string | null
          metal_lot_id?: string
          notes?: string | null
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "metal_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_transactions_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "metal_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metal_transactions_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "v_metal_availability"
            referencedColumns: ["metal_lot_id"]
          },
          {
            foreignKeyName: "metal_transactions_metal_lot_id_fkey"
            columns: ["metal_lot_id"]
            isOneToOne: false
            referencedRelation: "v_metal_lot_balances"
            referencedColumns: ["metal_lot_id"]
          },
          {
            foreignKeyName: "metal_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metal_types: {
        Row: {
          code: string
          id: string
          name: string
          symbol: string
        }
        Insert: {
          code: string
          id?: string
          name: string
          symbol: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      product_assets: {
        Row: {
          alt_text: string | null
          asset_type: string
          created_at: string
          design_id: string
          id: string
          is_primary: boolean
          sort_order: number
          url: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          asset_type: string
          created_at?: string
          design_id: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          url: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          asset_type?: string
          created_at?: string
          design_id?: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "product_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_assets_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["design_id"]
          },
          {
            foreignKeyName: "product_assets_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_assets_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      product_design_stones: {
        Row: {
          carat_each: number
          clarity: string | null
          color: string | null
          design_id: string
          id: string
          pcs: number
          shape: string | null
          sort_order: number
          stone_master_id: string
        }
        Insert: {
          carat_each?: number
          clarity?: string | null
          color?: string | null
          design_id: string
          id?: string
          pcs?: number
          shape?: string | null
          sort_order?: number
          stone_master_id: string
        }
        Update: {
          carat_each?: number
          clarity?: string | null
          color?: string | null
          design_id?: string
          id?: string
          pcs?: number
          shape?: string | null
          sort_order?: number
          stone_master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_design_stones_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "product_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_design_stones_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["design_id"]
          },
          {
            foreignKeyName: "product_design_stones_stone_master_id_fkey"
            columns: ["stone_master_id"]
            isOneToOne: false
            referencedRelation: "stone_master"
            referencedColumns: ["id"]
          },
        ]
      }
      product_designs: {
        Row: {
          brand_id: string | null
          category_id: string | null
          created_at: string
          default_purity_id: string | null
          description: string | null
          design_code: string
          fulfillment_type: string
          id: string
          is_published: boolean
          making_charge_type: string
          making_charge_value: number
          meta_description: string | null
          meta_title: string | null
          name: string
          pos_enabled: boolean
          product_type: string
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          default_purity_id?: string | null
          description?: string | null
          design_code: string
          fulfillment_type?: string
          id?: string
          is_published?: boolean
          making_charge_type?: string
          making_charge_value?: number
          meta_description?: string | null
          meta_title?: string | null
          name: string
          pos_enabled?: boolean
          product_type?: string
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          default_purity_id?: string | null
          description?: string | null
          design_code?: string
          fulfillment_type?: string
          id?: string
          is_published?: boolean
          making_charge_type?: string
          making_charge_value?: number
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          pos_enabled?: boolean
          product_type?: string
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_designs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_designs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_designs_default_purity_id_fkey"
            columns: ["default_purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          approx_metal_weight_g: number | null
          approx_stone_carat: number | null
          approx_stone_pcs: number | null
          created_at: string
          default_price: number | null
          design_id: string
          id: string
          is_default: boolean
          metal_purity_id: string | null
          pos_enabled: boolean
          size_code: string | null
          sku: string
          updated_at: string
          website_enabled: boolean
        }
        Insert: {
          approx_metal_weight_g?: number | null
          approx_stone_carat?: number | null
          approx_stone_pcs?: number | null
          created_at?: string
          default_price?: number | null
          design_id: string
          id?: string
          is_default?: boolean
          metal_purity_id?: string | null
          pos_enabled?: boolean
          size_code?: string | null
          sku: string
          updated_at?: string
          website_enabled?: boolean
        }
        Update: {
          approx_metal_weight_g?: number | null
          approx_stone_carat?: number | null
          approx_stone_pcs?: number | null
          created_at?: string
          default_price?: number | null
          design_id?: string
          id?: string
          is_default?: boolean
          metal_purity_id?: string | null
          pos_enabled?: boolean
          size_code?: string | null
          sku?: string
          updated_at?: string
          website_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "product_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["design_id"]
          },
          {
            foreignKeyName: "product_variants_metal_purity_id_fkey"
            columns: ["metal_purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      quality_checks: {
        Row: {
          checked_at: string
          checked_by: string | null
          id: string
          inventory_item_id: string | null
          job_id: string
          notes: string | null
          result: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          id?: string
          inventory_item_id?: string | null
          job_id: string
          notes?: string | null
          result: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          id?: string
          inventory_item_id?: string | null
          job_id?: string
          notes?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_sellable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "craftsman_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_craftsman_job_balances"
            referencedColumns: ["job_id"]
          },
        ]
      }
      stone_items: {
        Row: {
          carat: number
          certificate_id: string | null
          clarity: string | null
          color: string | null
          cost_price: number | null
          created_at: string
          cut: string | null
          id: string
          inventory_tag: string
          location_id: string | null
          selling_price: number | null
          shape: string | null
          status: string
          stone_lot_id: string | null
          stone_master_id: string
          updated_at: string
        }
        Insert: {
          carat: number
          certificate_id?: string | null
          clarity?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string
          cut?: string | null
          id?: string
          inventory_tag: string
          location_id?: string | null
          selling_price?: number | null
          shape?: string | null
          status?: string
          stone_lot_id?: string | null
          stone_master_id: string
          updated_at?: string
        }
        Update: {
          carat?: number
          certificate_id?: string | null
          clarity?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string
          cut?: string | null
          id?: string
          inventory_tag?: string
          location_id?: string | null
          selling_price?: number | null
          shape?: string | null
          status?: string
          stone_lot_id?: string | null
          stone_master_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stone_items_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_items_stone_lot_id_fkey"
            columns: ["stone_lot_id"]
            isOneToOne: false
            referencedRelation: "stone_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_items_stone_master_id_fkey"
            columns: ["stone_master_id"]
            isOneToOne: false
            referencedRelation: "stone_master"
            referencedColumns: ["id"]
          },
        ]
      }
      stone_lots: {
        Row: {
          cost: number
          created_at: string
          currency: string
          id: string
          invoice_date: string | null
          invoice_no: string | null
          lot_number: string
          notes: string | null
          rate_per_carat: number
          received_date: string
          stone_master_id: string
          total_carat: number
          total_pcs: number
          vendor_id: string | null
        }
        Insert: {
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_date?: string | null
          invoice_no?: string | null
          lot_number: string
          notes?: string | null
          rate_per_carat?: number
          received_date?: string
          stone_master_id: string
          total_carat?: number
          total_pcs?: number
          vendor_id?: string | null
        }
        Update: {
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_date?: string | null
          invoice_no?: string | null
          lot_number?: string
          notes?: string | null
          rate_per_carat?: number
          received_date?: string
          stone_master_id?: string
          total_carat?: number
          total_pcs?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stone_lots_stone_master_id_fkey"
            columns: ["stone_master_id"]
            isOneToOne: false
            referencedRelation: "stone_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_lots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      stone_master: {
        Row: {
          category: string
          clarity: string | null
          color: string | null
          cut: string | null
          fluorescence: string | null
          id: string
          is_active: boolean
          name: string | null
          origin: string | null
          shape: string | null
        }
        Insert: {
          category: string
          clarity?: string | null
          color?: string | null
          cut?: string | null
          fluorescence?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          origin?: string | null
          shape?: string | null
        }
        Update: {
          category?: string
          clarity?: string | null
          color?: string | null
          cut?: string | null
          fluorescence?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          origin?: string | null
          shape?: string | null
        }
        Relationships: []
      }
      stone_transactions: {
        Row: {
          carat_change: number | null
          created_at: string
          id: string
          notes: string | null
          performed_by: string | null
          reference_id: string | null
          reference_type: string | null
          status_from: string | null
          status_to: string | null
          stone_item_id: string
          txn_type: string
        }
        Insert: {
          carat_change?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status_from?: string | null
          status_to?: string | null
          stone_item_id: string
          txn_type: string
        }
        Update: {
          carat_change?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status_from?: string | null
          status_to?: string | null
          stone_item_id?: string
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stone_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_transactions_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "stone_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_transactions_stone_item_id_fkey"
            columns: ["stone_item_id"]
            isOneToOne: false
            referencedRelation: "v_stone_sellable"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          contact: Json | null
          gstin: string | null
          id: string
          is_active: boolean
          name: string
          vendor_type: string
        }
        Insert: {
          contact?: Json | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name: string
          vendor_type: string
        }
        Update: {
          contact?: Json | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          name?: string
          vendor_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_catalog_published: {
        Row: {
          approx_metal_weight_g: number | null
          approx_stone_carat: number | null
          approx_stone_pcs: number | null
          brand_id: string | null
          category_id: string | null
          default_price: number | null
          description: string | null
          design_code: string | null
          design_id: string | null
          fulfillment_type: string | null
          is_default: boolean | null
          making_charge_type: string | null
          making_charge_value: number | null
          metal_purity_id: string | null
          name: string | null
          pos_enabled: boolean | null
          product_type: string | null
          short_description: string | null
          size_code: string | null
          sku: string | null
          slug: string | null
          variant_id: string | null
          website_enabled: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "product_designs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_designs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_metal_purity_id_fkey"
            columns: ["metal_purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_craftsman_job_balances: {
        Row: {
          craftsman_id: string | null
          craftsman_name: string | null
          finished_fine_g: number | null
          in_hand_fine_g: number | null
          issued_fine_g: number | null
          job_id: string | null
          job_number: string | null
          returned_fine_g: number | null
          status: string | null
          wastage_fine_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "craftsman_jobs_craftsman_id_fkey"
            columns: ["craftsman_id"]
            isOneToOne: false
            referencedRelation: "craftsmen"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inventory_availability: {
        Row: {
          available_count: number | null
          reserved_count: number | null
          sold_count: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      v_inventory_sellable: {
        Row: {
          component_snapshot: Json | null
          created_at: string | null
          gross_weight_g: number | null
          id: string | null
          inventory_tag: string | null
          location_id: string | null
          metal_purity_id: string | null
          net_fine_weight_g: number | null
          net_metal_weight_g: number | null
          sold_at: string | null
          source_reference: string | null
          source_type: string | null
          status: string | null
          stone_carat_total: number | null
          stone_pcs_total: number | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          component_snapshot?: Json | null
          created_at?: string | null
          gross_weight_g?: number | null
          id?: string | null
          inventory_tag?: string | null
          location_id?: string | null
          metal_purity_id?: string | null
          net_fine_weight_g?: number | null
          net_metal_weight_g?: number | null
          sold_at?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string | null
          stone_carat_total?: number | null
          stone_pcs_total?: number | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          component_snapshot?: Json | null
          created_at?: string | null
          gross_weight_g?: number | null
          id?: string | null
          inventory_tag?: string | null
          location_id?: string | null
          metal_purity_id?: string | null
          net_fine_weight_g?: number | null
          net_metal_weight_g?: number | null
          sold_at?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: string | null
          stone_carat_total?: number | null
          stone_pcs_total?: number | null
          updated_at?: string | null
          variant_id?: string | null
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
            foreignKeyName: "inventory_items_metal_purity_id_fkey"
            columns: ["metal_purity_id"]
            isOneToOne: false
            referencedRelation: "metal_purities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "v_catalog_published"
            referencedColumns: ["variant_id"]
          },
        ]
      }
      v_metal_availability: {
        Row: {
          balance_fine_g: number | null
          location_id: string | null
          lot_number: string | null
          metal_lot_id: string | null
          purity_code: string | null
          purity_percent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metal_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_metal_lot_balances: {
        Row: {
          balance_fine_g: number | null
          location_id: string | null
          lot_number: string | null
          metal_lot_id: string | null
          opening_fine_weight_g: number | null
          purity_code: string | null
          purity_percent: number | null
          rate_per_gram: number | null
          txn_fine_g: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metal_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stone_sellable: {
        Row: {
          carat: number | null
          certificate_id: string | null
          clarity: string | null
          color: string | null
          created_at: string | null
          cut: string | null
          id: string | null
          inventory_tag: string | null
          location_id: string | null
          selling_price: number | null
          shape: string | null
          status: string | null
          stone_lot_id: string | null
          stone_master_id: string | null
          updated_at: string | null
        }
        Insert: {
          carat?: number | null
          certificate_id?: string | null
          clarity?: string | null
          color?: string | null
          created_at?: string | null
          cut?: string | null
          id?: string | null
          inventory_tag?: string | null
          location_id?: string | null
          selling_price?: number | null
          shape?: string | null
          status?: string | null
          stone_lot_id?: string | null
          stone_master_id?: string | null
          updated_at?: string | null
        }
        Update: {
          carat?: number | null
          certificate_id?: string | null
          clarity?: string | null
          color?: string | null
          created_at?: string | null
          cut?: string | null
          id?: string | null
          inventory_tag?: string | null
          location_id?: string | null
          selling_price?: number | null
          shape?: string | null
          status?: string | null
          stone_lot_id?: string | null
          stone_master_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stone_items_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_items_stone_lot_id_fkey"
            columns: ["stone_lot_id"]
            isOneToOne: false
            referencedRelation: "stone_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stone_items_stone_master_id_fkey"
            columns: ["stone_master_id"]
            isOneToOne: false
            referencedRelation: "stone_master"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_see_costs: { Args: never; Returns: boolean }
      current_user_role: { Args: never; Returns: string }
      fn_complete_job: {
        Args: {
          p_gross_weight_g: number
          p_inventory_tag: string
          p_job_id: string
          p_net_metal_weight_g: number
          p_notes?: string
          p_performed_by?: string
          p_stone_item_ids?: string[]
        }
        Returns: string
      }
      fn_issue_metal_to_job: {
        Args: {
          p_gross_weight_g: number
          p_job_id: string
          p_metal_lot_id: string
          p_notes?: string
          p_performed_by?: string
          p_purity_percent: number
        }
        Returns: string
      }
      fn_issue_stone_to_job: {
        Args: {
          p_job_id: string
          p_notes?: string
          p_performed_by?: string
          p_stone_item_id: string
        }
        Returns: string
      }
      fn_return_metal_from_job: {
        Args: {
          p_gross_weight_g: number
          p_job_id: string
          p_metal_lot_id: string
          p_notes?: string
          p_performed_by?: string
          p_purity_percent: number
          p_return_kind?: string
        }
        Returns: string
      }
      fn_return_stone_from_job: {
        Args: {
          p_carat_returned?: number
          p_condition: string
          p_job_id: string
          p_notes?: string
          p_performed_by?: string
          p_stone_item_id: string
        }
        Returns: string
      }
      is_accountant: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_sales: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
