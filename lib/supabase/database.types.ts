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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          acompte_pct: number
          color: string
          created_at: string
          default_quote_max: number | null
          default_quote_min: number | null
          emoji: string | null
          id: string
          is_active: boolean
          label: string
          short: string
          slug: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          acompte_pct: number
          color: string
          created_at?: string
          default_quote_max?: number | null
          default_quote_min?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          label: string
          short: string
          slug: string
          updated_at?: string
          vat_rate: number
        }
        Update: {
          acompte_pct?: number
          color?: string
          created_at?: string
          default_quote_max?: number | null
          default_quote_min?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean
          label?: string
          short?: string
          slug?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: Json | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          is_premium: boolean
          name: string
          note: string | null
          phone: string | null
          sectors: string[]
          siret: string | null
          source: Database["public"]["Enums"]["client_origin"]
          source_lead_id: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
          vat_intra: string | null
        }
        Insert: {
          address?: Json | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_premium?: boolean
          name: string
          note?: string | null
          phone?: string | null
          sectors?: string[]
          siret?: string | null
          source: Database["public"]["Enums"]["client_origin"]
          source_lead_id?: string | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          vat_intra?: string | null
        }
        Update: {
          address?: Json | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          is_premium?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          sectors?: string[]
          siret?: string | null
          source?: Database["public"]["Enums"]["client_origin"]
          source_lead_id?: string | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
          vat_intra?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_counters: {
        Row: {
          doc_type: Database["public"]["Enums"]["document_type"]
          next_value: number
          year: number
        }
        Insert: {
          doc_type: Database["public"]["Enums"]["document_type"]
          next_value?: number
          year: number
        }
        Update: {
          doc_type?: Database["public"]["Enums"]["document_type"]
          next_value?: number
          year?: number
        }
        Relationships: []
      }
      document_lines: {
        Row: {
          created_at: string
          discount_pct: number
          document_id: string
          id: string
          label: string
          order_index: number
          prestation_id: string | null
          quantity: number
          total_ht: number
          unit: string
          unit_price_ht: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          discount_pct?: number
          document_id: string
          id?: string
          label: string
          order_index?: number
          prestation_id?: string | null
          quantity: number
          total_ht: number
          unit: string
          unit_price_ht: number
          vat_rate: number
        }
        Update: {
          created_at?: string
          discount_pct?: number
          document_id?: string
          id?: string
          label?: string
          order_index?: number
          prestation_id?: string | null
          quantity?: number
          total_ht?: number
          unit?: string
          unit_price_ht?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_lines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_lines_prestation_id_fkey"
            columns: ["prestation_id"]
            isOneToOne: false
            referencedRelation: "prestations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          activity_ids: string[]
          content_html: string | null
          entity_id: string
          file_url: string | null
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          variables: Json | null
        }
        Insert: {
          activity_ids?: string[]
          content_html?: string | null
          entity_id: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          activity_ids?: string[]
          content_html?: string | null
          entity_id?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          acompte_amount: number | null
          acompte_deduit: number | null
          acompte_pct: number | null
          activity_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          due_at: string | null
          entity_id: string
          id: string
          issued_at: string
          lead_id: string | null
          notes: string | null
          num: string
          paid_at: string | null
          payment_reference: string | null
          refusal_reason: string | null
          payment_term_id: string | null
          pdf_url: string | null
          related_devis_id: string | null
          sent_to_email: string | null
          signature_request_id: string | null
          signed_at: string | null
          solde_du: number | null
          status: Database["public"]["Enums"]["document_status"]
          total_ht: number
          total_ttc: number
          total_vat: number
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          acompte_amount?: number | null
          acompte_deduit?: number | null
          acompte_pct?: number | null
          activity_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_at?: string | null
          entity_id: string
          id?: string
          issued_at?: string
          lead_id?: string | null
          notes?: string | null
          num: string
          paid_at?: string | null
          payment_reference?: string | null
          refusal_reason?: string | null
          payment_term_id?: string | null
          pdf_url?: string | null
          related_devis_id?: string | null
          sent_to_email?: string | null
          signature_request_id?: string | null
          signed_at?: string | null
          solde_du?: number | null
          status?: Database["public"]["Enums"]["document_status"]
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          acompte_amount?: number | null
          acompte_deduit?: number | null
          acompte_pct?: number | null
          activity_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          due_at?: string | null
          entity_id?: string
          id?: string
          issued_at?: string
          lead_id?: string | null
          notes?: string | null
          num?: string
          paid_at?: string | null
          payment_reference?: string | null
          refusal_reason?: string | null
          payment_term_id?: string | null
          pdf_url?: string | null
          related_devis_id?: string | null
          sent_to_email?: string | null
          signature_request_id?: string | null
          signed_at?: string | null
          solde_du?: number | null
          status?: Database["public"]["Enums"]["document_status"]
          total_ht?: number
          total_ttc?: number
          total_vat?: number
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_related_devis_id_fkey"
            columns: ["related_devis_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          address: Json | null
          cancellation_reason: string | null
          created_at: string
          duration_hours: number | null
          flags: Database["public"]["Enums"]["dossier_flag"][]
          id: string
          lead_id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          planned_at: string | null
          planner_id: string | null
          quote_document_id: string | null
          realized_at: string | null
          status: Database["public"]["Enums"]["dossier_status"]
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          address?: Json | null
          cancellation_reason?: string | null
          created_at?: string
          duration_hours?: number | null
          flags?: Database["public"]["Enums"]["dossier_flag"][]
          id?: string
          lead_id: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          planned_at?: string | null
          planner_id?: string | null
          quote_document_id?: string | null
          realized_at?: string | null
          status?: Database["public"]["Enums"]["dossier_status"]
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json | null
          cancellation_reason?: string | null
          created_at?: string
          duration_hours?: number | null
          flags?: Database["public"]["Enums"]["dossier_flag"][]
          id?: string
          lead_id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          planned_at?: string | null
          planner_id?: string | null
          quote_document_id?: string | null
          realized_at?: string | null
          status?: Database["public"]["Enums"]["dossier_status"]
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_planner_id_fkey"
            columns: ["planner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_quote_document_id_fkey"
            columns: ["quote_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossiers_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          slug: Database["public"]["Enums"]["lead_source_slug"]
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          slug: Database["public"]["Enums"]["lead_source_slug"]
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          slug?: Database["public"]["Enums"]["lead_source_slug"]
        }
        Relationships: []
      }
      leads: {
        Row: {
          activity_id: string | null
          annotation_segment: string | null
          client_address: Json | null
          client_company: string | null
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          entity_id: string | null
          estimated_amount: number | null
          external_id: string | null
          gclid: string | null
          id: string
          immob_travaux_annotation: string | null
          is_company: boolean
          is_nrp: boolean
          is_urgent: boolean
          last_action_at: string | null
          nrp_at: string | null
          last_action_label: string | null
          lost_reason: string | null
          next_followup_at: string | null
          notes: string | null
          intervention_delay: string | null
          intervention_delay_notes: string | null
          surface_m2: number | null
          owner_id: string | null
          received_at: string
          short_id: string
          source_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          sub_envoi: Database["public"]["Enums"]["sub_envoi"] | null
          sub_signature: Database["public"]["Enums"]["sub_signature"] | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          activity_id?: string | null
          annotation_segment?: string | null
          client_address?: Json | null
          client_company?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id?: string | null
          estimated_amount?: number | null
          external_id?: string | null
          gclid?: string | null
          id?: string
          immob_travaux_annotation?: string | null
          is_company?: boolean
          is_nrp?: boolean
          is_urgent?: boolean
          last_action_at?: string | null
          nrp_at?: string | null
          last_action_label?: string | null
          lost_reason?: string | null
          next_followup_at?: string | null
          notes?: string | null
          intervention_delay?: string | null
          intervention_delay_notes?: string | null
          surface_m2?: number | null
          owner_id?: string | null
          received_at?: string
          short_id: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          sub_envoi?: Database["public"]["Enums"]["sub_envoi"] | null
          sub_signature?: Database["public"]["Enums"]["sub_signature"] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          activity_id?: string | null
          annotation_segment?: string | null
          client_address?: Json | null
          client_company?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          entity_id?: string | null
          estimated_amount?: number | null
          external_id?: string | null
          gclid?: string | null
          id?: string
          immob_travaux_annotation?: string | null
          is_company?: boolean
          is_nrp?: boolean
          is_urgent?: boolean
          last_action_at?: string | null
          nrp_at?: string | null
          last_action_label?: string | null
          lost_reason?: string | null
          next_followup_at?: string | null
          notes?: string | null
          intervention_delay?: string | null
          intervention_delay_notes?: string | null
          surface_m2?: number | null
          owner_id?: string | null
          received_at?: string
          short_id?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          sub_envoi?: Database["public"]["Enums"]["sub_envoi"] | null
          sub_signature?: Database["public"]["Enums"]["sub_signature"] | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          address: Json
          ape_code: string | null
          bic: string | null
          color: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          default_vat_rate: number | null
          deleted_at: string | null
          deleted_by: string | null
          iban: string | null
          id: string
          is_vat_exempt: boolean
          legal_form: Database["public"]["Enums"]["legal_form"]
          legal_mentions: string | null
          legal_name: string
          logo_url: string | null
          siret: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address: Json
          ape_code?: string | null
          bic?: string | null
          color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_vat_rate?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          iban?: string | null
          id?: string
          is_vat_exempt?: boolean
          legal_form: Database["public"]["Enums"]["legal_form"]
          legal_mentions?: string | null
          legal_name: string
          logo_url?: string | null
          siret: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: Json
          ape_code?: string | null
          bic?: string | null
          color?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          default_vat_rate?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          iban?: string | null
          id?: string
          is_vat_exempt?: boolean
          legal_form?: Database["public"]["Enums"]["legal_form"]
          legal_mentions?: string | null
          legal_name?: string
          logo_url?: string | null
          siret?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      legal_entity_activities: {
        Row: {
          activity_id: string
          is_default: boolean
          legal_entity_id: string
        }
        Insert: {
          activity_id: string
          is_default?: boolean
          legal_entity_id: string
        }
        Update: {
          activity_id?: string
          is_default?: boolean
          legal_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entity_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_entity_activities_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          href: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          days: number
          id: string
          label: string
          slug: Database["public"]["Enums"]["payment_term_slug"]
        }
        Insert: {
          days: number
          id?: string
          label: string
          slug: Database["public"]["Enums"]["payment_term_slug"]
        }
        Update: {
          days?: number
          id?: string
          label?: string
          slug?: Database["public"]["Enums"]["payment_term_slug"]
        }
        Relationships: []
      }
      prestations: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          unit: Database["public"]["Enums"]["prestation_unit"]
          unit_price_ht: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          unit: Database["public"]["Enums"]["prestation_unit"]
          unit_price_ht: number
          updated_at?: string
          vat_rate: number
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          unit?: Database["public"]["Enums"]["prestation_unit"]
          unit_price_ht?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          label: string
          slug: Database["public"]["Enums"]["role_slug"]
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          label: string
          slug: Database["public"]["Enums"]["role_slug"]
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          label?: string
          slug?: Database["public"]["Enums"]["role_slug"]
        }
        Relationships: []
      }
      technicians: {
        Row: {
          color: string | null
          created_at: string
          id: string
          initials: string
          is_active: boolean
          name: string
          sectors: string[]
          skills: string[]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          initials: string
          is_active?: boolean
          name: string
          sectors?: string[]
          skills?: string[]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          initials?: string
          is_active?: boolean
          name?: string
          sectors?: string[]
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_id: string
          assigned_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          assigned_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          assigned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_key: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_key: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          color: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          is_active: boolean
          is_premium: boolean
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          team: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean
          is_premium?: boolean
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          team?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_premium?: boolean
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: { Args: { p_key: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_planificateur: { Args: never; Returns: boolean }
      next_doc_num: {
        Args: {
          p_type: Database["public"]["Enums"]["document_type"]
          p_year: number
        }
        Returns: string
      }
    }
    Enums: {
      client_origin: "lead" | "direct"
      client_type: "pro" | "particulier"
      document_status:
        | "brouillon"
        | "envoye"
        | "ouvert"
        | "signe"
        | "refuse"
        | "expire"
        | "paye"
        | "retard"
      document_type: "devis" | "acompte" | "finale"
      dossier_flag: "a_rappeler" | "attente_retour" | "litige" | "bloque"
      dossier_status: "a_planifier" | "planifie" | "finalise" | "solde"
      lead_source_slug:
        | "google_ads"
        | "meta_ads"
        | "site_web"
        | "telephone"
        | "recommandation"
      lead_status: "lead" | "envoye" | "ouvert" | "signe" | "encaisse" | "perdu"
      legal_form: "SAS" | "SARL" | "EURL" | "SASU" | "EI" | "SCI"
      payment_status:
        | "acompte_non_paye"
        | "acompte_paye"
        | "partiel"
        | "en_attente"
        | "solde"
        | "impaye"
      payment_term_slug: "comptant" | "jours_30" | "jours_45" | "jours_60"
      prestation_unit: "unite" | "forfait" | "h" | "m2" | "mois"
      role_slug: "admin" | "commercial" | "planification" | "assistant"
      sub_envoi: "mano" | "auto"
      sub_signature: "sans" | "avec"
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
      client_origin: ["lead", "direct"],
      client_type: ["pro", "particulier"],
      document_status: [
        "brouillon",
        "envoye",
        "ouvert",
        "signe",
        "refuse",
        "expire",
        "paye",
        "retard",
      ],
      document_type: ["devis", "acompte", "finale"],
      dossier_flag: ["a_rappeler", "attente_retour", "litige", "bloque"],
      dossier_status: ["a_planifier", "planifie", "finalise", "solde"],
      lead_source_slug: [
        "google_ads",
        "meta_ads",
        "site_web",
        "telephone",
        "recommandation",
      ],
      lead_status: ["lead", "envoye", "ouvert", "signe", "encaisse", "perdu"],
      legal_form: ["SAS", "SARL", "EURL", "SASU", "EI", "SCI"],
      payment_status: [
        "acompte_non_paye",
        "acompte_paye",
        "partiel",
        "en_attente",
        "solde",
        "impaye",
      ],
      payment_term_slug: ["comptant", "jours_30", "jours_45", "jours_60"],
      prestation_unit: ["unite", "forfait", "h", "m2", "mois"],
      role_slug: ["admin", "commercial", "planification", "assistant"],
      sub_envoi: ["mano", "auto"],
      sub_signature: ["sans", "avec"],
    },
  },
} as const
