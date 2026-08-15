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
      appointments: {
        Row: {
          cancellation_requested: boolean
          clinic_id: string
          created_at: string
          ends_at: string
          id: string
          patient_id: string
          reason: string | null
          reminders_sent: number[]
          source: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          token_number: number | null
        }
        Insert: {
          cancellation_requested?: boolean
          clinic_id: string
          created_at?: string
          ends_at: string
          id?: string
          patient_id: string
          reason?: string | null
          reminders_sent?: number[]
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token_number?: number | null
        }
        Update: {
          cancellation_requested?: boolean
          clinic_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          patient_id?: string
          reason?: string | null
          reminders_sent?: number[]
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          clinic_id: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          clinic_id: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          clinic_id?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_overrides: {
        Row: {
          clinic_id: string
          closed: boolean
          date: string
          end_time: string | null
          id: string
          start_time: string | null
        }
        Insert: {
          clinic_id: string
          closed?: boolean
          date: string
          end_time?: string | null
          id?: string
          start_time?: string | null
        }
        Update: {
          clinic_id?: string
          closed?: boolean
          date?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_otps: {
        Row: {
          attempts: number
          clinic_id: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified_at: string | null
          verify_hash: string | null
        }
        Insert: {
          attempts?: number
          clinic_id: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          verified_at?: string | null
          verify_hash?: string | null
        }
        Update: {
          attempts?: number
          clinic_id?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified_at?: string | null
          verify_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_otps_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_events: {
        Row: {
          amount: number | null
          claim_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          status: string
        }
        Insert: {
          amount?: number | null
          claim_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          status: string
        }
        Update: {
          amount?: number | null
          claim_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          approved_amount: number | null
          claim_no: string | null
          claimed_amount: number
          clinic_id: string
          created_at: string
          id: string
          invoice_id: string | null
          note: string | null
          patient_id: string
          patient_payable: number | null
          payer_id: string
          policy_id: string | null
          preauth_no: string | null
          settled_amount: number | null
          settled_at: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          approved_amount?: number | null
          claim_no?: string | null
          claimed_amount?: number
          clinic_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          patient_id: string
          patient_payable?: number | null
          payer_id: string
          policy_id?: string | null
          preauth_no?: string | null
          settled_amount?: number | null
          settled_at?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          approved_amount?: number | null
          claim_no?: string | null
          claimed_amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          patient_id?: string
          patient_payable?: number | null
          payer_id?: string
          policy_id?: string | null
          preauth_no?: string | null
          settled_amount?: number | null
          settled_at?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "patient_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          doctor_name: string
          email: string | null
          id: string
          logo_path: string | null
          name: string
          phone: string | null
          qualifications: string | null
          registration_no: string | null
          settings: Json
          slug: string
          specialty: string | null
          suspended_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          doctor_name: string
          email?: string | null
          id?: string
          logo_path?: string | null
          name: string
          phone?: string | null
          qualifications?: string | null
          registration_no?: string | null
          settings?: Json
          slug: string
          specialty?: string | null
          suspended_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          doctor_name?: string
          email?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          phone?: string | null
          qualifications?: string | null
          registration_no?: string | null
          settings?: Json
          slug?: string
          specialty?: string | null
          suspended_at?: string | null
        }
        Relationships: []
      }
      consent_artefacts: {
        Row: {
          artefact_id: string | null
          clinic_id: string
          created_at: string
          date_from: string | null
          date_to: string | null
          expires_at: string | null
          granted_at: string | null
          hi_types: string[]
          id: string
          patient_id: string
          purpose_code: string
          raw: Json | null
          request_id: string | null
          revoked_at: string | null
          status: string
        }
        Insert: {
          artefact_id?: string | null
          clinic_id: string
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          expires_at?: string | null
          granted_at?: string | null
          hi_types?: string[]
          id?: string
          patient_id: string
          purpose_code?: string
          raw?: Json | null
          request_id?: string | null
          revoked_at?: string | null
          status?: string
        }
        Update: {
          artefact_id?: string | null
          clinic_id?: string
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          expires_at?: string | null
          granted_at?: string | null
          hi_types?: string[]
          id?: string
          patient_id?: string
          purpose_code?: string
          raw?: Json | null
          request_id?: string | null
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_artefacts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_artefacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_interactions: {
        Row: {
          clinic_id: string | null
          created_at: string
          description: string
          id: string
          ingredient_a: string
          ingredient_b: string
          severity: string
          source: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          description: string
          id?: string
          ingredient_a: string
          ingredient_b: string
          severity: string
          source?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          description?: string
          id?: string
          ingredient_a?: string
          ingredient_b?: string
          severity?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_interactions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      icd10_codes: {
        Row: {
          chapter: string | null
          code: string
          title: string
        }
        Insert: {
          chapter?: string | null
          code: string
          title: string
        }
        Update: {
          chapter?: string | null
          code?: string
          title?: string
        }
        Relationships: []
      }
      intake_requests: {
        Row: {
          appointment_id: string
          clinic_id: string
          created_at: string
          expires_at: string
          id: string
          patient_id: string
          payload: Json
          status: string
          submitted_at: string | null
          token_hash: string
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          created_at?: string
          expires_at: string
          id?: string
          patient_id: string
          payload?: Json
          status?: string
          submitted_at?: string | null
          token_hash: string
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          patient_id?: string
          payload?: Json
          status?: string
          submitted_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          clinic_id: string
          created_at: string
          form: string | null
          gst_rate: number
          hsn_code: string | null
          id: string
          is_active: boolean
          medicine_id: string | null
          name: string
          reorder_level: number
          strength: string | null
          unit: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          form?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          medicine_id?: string | null
          name: string
          reorder_level?: number
          strength?: string | null
          unit?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          form?: string | null
          gst_rate?: number
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          medicine_id?: string | null
          name?: string
          reorder_level?: number
          strength?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          clinic_id: string
          last_no: number
          year: number
        }
        Insert: {
          clinic_id: string
          last_no?: number
          year: number
        }
        Update: {
          clinic_id?: string
          last_no?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          qty?: number
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          claimed_at: string | null
          claimed_utr: string | null
          clinic_id: string
          created_at: string
          id: string
          invoice_no: string
          patient_id: string
          pay_token: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          visit_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_utr?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          invoice_no: string
          patient_id: string
          pay_token?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          visit_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_utr?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          invoice_no?: string
          patient_id?: string
          pay_token?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_order_items: {
        Row: {
          flag: string | null
          id: string
          lab_test_id: string | null
          loinc_code: string | null
          note: string | null
          order_id: string
          position: number
          reference_high: number | null
          reference_low: number | null
          reference_text: string | null
          test_name: string
          unit: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          flag?: string | null
          id?: string
          lab_test_id?: string | null
          loinc_code?: string | null
          note?: string | null
          order_id: string
          position?: number
          reference_high?: number | null
          reference_low?: number | null
          reference_text?: string | null
          test_name: string
          unit?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          flag?: string | null
          id?: string
          lab_test_id?: string | null
          loinc_code?: string | null
          note?: string | null
          order_id?: string
          position?: number
          reference_high?: number | null
          reference_low?: number | null
          reference_text?: string | null
          test_name?: string
          unit?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_order_items_lab_test_id_fkey"
            columns: ["lab_test_id"]
            isOneToOne: false
            referencedRelation: "lab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          lab_name: string | null
          note: string | null
          ordered_at: string
          patient_id: string
          resulted_at: string | null
          status: string
          visit_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          lab_name?: string | null
          note?: string | null
          ordered_at?: string
          patient_id: string
          resulted_at?: string | null
          status?: string
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          lab_name?: string | null
          note?: string | null
          ordered_at?: string
          patient_id?: string
          resulted_at?: string | null
          status?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_tests: {
        Row: {
          category: string | null
          clinic_id: string | null
          id: string
          is_panel: boolean
          loinc_code: string | null
          name: string
          short_name: string | null
          specimen: string | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          clinic_id?: string | null
          id?: string
          is_panel?: boolean
          loinc_code?: string | null
          name: string
          short_name?: string | null
          specimen?: string | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          clinic_id?: string | null
          id?: string
          is_panel?: boolean
          loinc_code?: string | null
          name?: string
          short_name?: string | null
          specimen?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_tests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          clinic_id: string | null
          composition: string | null
          form: string | null
          id: string
          is_active: boolean
          name: string
          strength: string | null
        }
        Insert: {
          clinic_id?: string | null
          composition?: string | null
          form?: string | null
          id?: string
          is_active?: boolean
          name: string
          strength?: string | null
        }
        Update: {
          clinic_id?: string | null
          composition?: string | null
          form?: string | null
          id?: string
          is_active?: boolean
          name?: string
          strength?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_policies: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          member_id: string | null
          note: string | null
          patient_id: string
          payer_id: string
          policy_no: string
          sum_insured: number | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          member_id?: string | null
          note?: string | null
          patient_id: string
          payer_id: string
          policy_no: string
          sum_insured?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          member_id?: string | null
          note?: string | null
          patient_id?: string
          payer_id?: string
          policy_no?: string
          sum_insured?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_policies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_policies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_policies_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          abha_address: string | null
          abha_number: string | null
          address: string | null
          age_years: number | null
          allergies: string | null
          blood_group: string | null
          chronic_conditions: string | null
          clinic_id: string
          consent_at: string | null
          created_at: string
          deleted_at: string | null
          dob: string | null
          full_name: string
          gender: string | null
          id: string
          notes: string | null
          phone: string
          tags: string[]
          whatsapp_opt_in: boolean
        }
        Insert: {
          abha_address?: string | null
          abha_number?: string | null
          address?: string | null
          age_years?: number | null
          allergies?: string | null
          blood_group?: string | null
          chronic_conditions?: string | null
          clinic_id: string
          consent_at?: string | null
          created_at?: string
          deleted_at?: string | null
          dob?: string | null
          full_name: string
          gender?: string | null
          id?: string
          notes?: string | null
          phone: string
          tags?: string[]
          whatsapp_opt_in?: boolean
        }
        Update: {
          abha_address?: string | null
          abha_number?: string | null
          address?: string | null
          age_years?: number | null
          allergies?: string | null
          blood_group?: string | null
          chronic_conditions?: string | null
          clinic_id?: string
          consent_at?: string | null
          created_at?: string
          deleted_at?: string | null
          dob?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          notes?: string | null
          phone?: string
          tags?: string[]
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          clinic_id: string
          code: string | null
          contact: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
        }
        Insert: {
          clinic_id: string
          code?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
        }
        Update: {
          clinic_id?: string
          code?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "payers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string
          id: string
          invoice_id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          paid_at: string
          receipt_pdf_path: string | null
          utr_reference: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          id?: string
          invoice_id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          paid_at?: string
          receipt_pdf_path?: string | null
          utr_reference?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          id?: string
          invoice_id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          paid_at?: string
          receipt_pdf_path?: string | null
          utr_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          dosage: string | null
          duration_days: number | null
          id: string
          instructions: string | null
          medicine_name: string
          position: number
          prescription_id: string
        }
        Insert: {
          dosage?: string | null
          duration_days?: number | null
          id?: string
          instructions?: string | null
          medicine_name: string
          position?: number
          prescription_id: string
        }
        Update: {
          dosage?: string | null
          duration_days?: number | null
          id?: string
          instructions?: string | null
          medicine_name?: string
          position?: number
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinic_id: string
          created_at: string
          finalized_at: string | null
          id: string
          patient_id: string
          pdf_path: string | null
          visit_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          finalized_at?: string | null
          id?: string
          patient_id: string
          pdf_path?: string | null
          visit_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          finalized_at?: string | null
          id?: string
          patient_id?: string
          pdf_path?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_blocks: {
        Row: {
          clinic_id: string
          created_at: string
          date: string
          end_time: string
          id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          date: string
          end_time: string
          id?: string
          reason?: string | null
          start_time: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_blocks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          batch_no: string
          clinic_id: string
          cost_price: number | null
          expiry_date: string | null
          id: string
          item_id: string
          mrp: number | null
          qty_available: number
          qty_received: number
          received_at: string
        }
        Insert: {
          batch_no: string
          clinic_id: string
          cost_price?: number | null
          expiry_date?: string | null
          id?: string
          item_id: string
          mrp?: number | null
          qty_available: number
          qty_received: number
          received_at?: string
        }
        Update: {
          batch_no?: string
          clinic_id?: string
          cost_price?: number | null
          expiry_date?: string | null
          id?: string
          item_id?: string
          mrp?: number | null
          qty_available?: number
          qty_received?: number
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          invoice_item_id: string | null
          item_id: string
          kind: string
          note: string | null
          qty: number
        }
        Insert: {
          batch_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          invoice_item_id?: string | null
          item_id: string
          kind: string
          note?: string | null
          qty: number
        }
        Update: {
          batch_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          invoice_item_id?: string | null
          item_id?: string
          kind?: string
          note?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_attachments: {
        Row: {
          clinic_id: string
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          note: string | null
          patient_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
          visit_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          note?: string | null
          patient_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          note?: string | null
          patient_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_attachments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_attachments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_attachments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          advice: string | null
          appointment_id: string | null
          clinic_id: string
          complaints: string | null
          created_at: string
          diagnosis: string | null
          diagnosis_codes: string[]
          followup_date: string | null
          followup_notified_at: string | null
          id: string
          patient_id: string
          visit_date: string
          vitals: Json
        }
        Insert: {
          advice?: string | null
          appointment_id?: string | null
          clinic_id: string
          complaints?: string | null
          created_at?: string
          diagnosis?: string | null
          diagnosis_codes?: string[]
          followup_date?: string | null
          followup_notified_at?: string | null
          id?: string
          patient_id: string
          visit_date?: string
          vitals?: Json
        }
        Update: {
          advice?: string | null
          appointment_id?: string | null
          clinic_id?: string
          complaints?: string | null
          created_at?: string
          diagnosis?: string | null
          diagnosis_codes?: string[]
          followup_date?: string | null
          followup_notified_at?: string | null
          id?: string
          patient_id?: string
          visit_date?: string
          vitals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          attempts: number
          body: string | null
          clinic_id: string
          created_at: string
          direction: Database["public"]["Enums"]["wa_direction"]
          document_path: string | null
          error: string | null
          id: string
          params: Json
          patient_id: string | null
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["wa_status"]
          template_name: string | null
          to_phone: string
          wa_message_id: string | null
        }
        Insert: {
          attempts?: number
          body?: string | null
          clinic_id: string
          created_at?: string
          direction?: Database["public"]["Enums"]["wa_direction"]
          document_path?: string | null
          error?: string | null
          id?: string
          params?: Json
          patient_id?: string | null
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_status"]
          template_name?: string | null
          to_phone: string
          wa_message_id?: string | null
        }
        Update: {
          attempts?: number
          body?: string | null
          clinic_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["wa_direction"]
          document_path?: string | null
          error?: string | null
          id?: string
          params?: Json
          patient_id?: string | null
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["wa_status"]
          template_name?: string | null
          to_phone?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_sessions: {
        Row: {
          clinic_id: string | null
          context: Json
          expires_at: string
          phone: string
          rate_count: number
          rate_window_start: string
          state: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          context?: Json
          expires_at: string
          phone: string
          rate_count?: number
          rate_window_start?: string
          state?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          context?: Json
          expires_at?: string
          phone?: string
          rate_count?: number
          rate_window_start?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invites: { Args: never; Returns: Json }
      admin_clinic_detail: { Args: { p_clinic: string }; Returns: Json }
      admin_list_clinics: {
        Args: never
        Returns: {
          appt_count: number
          booking_mode: string
          created_at: string
          doctor_name: string
          id: string
          name: string
          patient_count: number
          revenue: number
          slug: string
          suspended_at: string
        }[]
      }
      admin_platform_stats: { Args: never; Returns: Json }
      admin_set_clinic_suspended: {
        Args: { p_clinic: string; p_suspend: boolean }
        Returns: Json
      }
      auth_clinic_ids: { Args: never; Returns: string[] }
      create_booking: {
        Args: {
          p_consent: boolean
          p_name: string
          p_phone: string | null
          p_reason: string | null
          p_slug: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_clinic: {
        Args: {
          p_address: string | null
          p_availability: Json
          p_doctor_name: string
          p_email: string | null
          p_name: string
          p_phone: string | null
          p_qualifications: string | null
          p_registration_no: string | null
          p_settings: Json
          p_slug: string
          p_specialty: string | null
        }
        Returns: string
      }
      create_verified_booking: {
        Args: {
          p_consent: boolean
          p_name: string
          p_reason: string | null
          p_slug: string
          p_starts_at: string
          p_verify_token: string
        }
        Returns: Json
      }
      create_whatsapp_booking: {
        Args: {
          p_clinic_id: string
          p_name: string
          p_phone: string
          p_reason: string | null
          p_starts_at: string
        }
        Returns: Json
      }
      dispense_stock: {
        Args: {
          p_allocations: Json
          p_invoice_id: string | null
          p_invoice_item_id: string
        }
        Returns: number
      }
      get_booking_context: { Args: { p_slug: string }; Returns: Json }
      get_display_queue: { Args: { p_slug: string }; Returns: Json }
      get_intake_context: { Args: { p_token: string }; Returns: Json }
      get_invoice_public: { Args: { p_token: string }; Returns: Json }
      is_clinic_doctor: { Args: { p_clinic: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      issue_booking_otp: {
        Args: { p_phone: string; p_slug: string }
        Returns: Json
      }
      list_clinic_members: {
        Args: { p_clinic: string }
        Returns: {
          email: string
          is_self: boolean
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }[]
      }
      next_invoice_no: { Args: { p_clinic: string }; Returns: string }
      next_token_number: {
        Args: { p_clinic: string; p_day: string }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_intake: {
        Args: { p_payload: Json; p_token: string }
        Returns: Json
      }
      submit_payment_reference: {
        Args: { p_token: string; p_utr: string }
        Returns: Json
      }
      wa_rate_allow: {
        Args: { p_limit: number; p_phone: string; p_window_seconds: number }
        Returns: boolean
      }
      verify_booking_otp: {
        Args: {
          p_code: string
          p_otp_id: string
          p_phone: string | null
          p_slug: string
        }
        Returns: Json
      }
    }
    Enums: {
      appointment_source: "walk_in" | "staff" | "online"
      appointment_status:
        | "pending"
        | "confirmed"
        | "arrived"
        | "in_progress"
        | "completed"
        | "no_show"
        | "cancelled"
      invoice_status: "unpaid" | "partial" | "paid" | "void"
      member_role: "doctor" | "staff"
      payment_mode: "cash" | "upi" | "card" | "other"
      wa_direction: "out" | "in"
      wa_status: "queued" | "sending" | "sent" | "delivered" | "read" | "failed"
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
      appointment_source: ["walk_in", "staff", "online"],
      appointment_status: [
        "pending",
        "confirmed",
        "arrived",
        "in_progress",
        "completed",
        "no_show",
        "cancelled",
      ],
      invoice_status: ["unpaid", "partial", "paid", "void"],
      member_role: ["doctor", "staff"],
      payment_mode: ["cash", "upi", "card", "other"],
      wa_direction: ["out", "in"],
      wa_status: ["queued", "sending", "sent", "delivered", "read", "failed"],
    },
  },
} as const
