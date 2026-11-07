export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface ClientRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  address: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ClientInsert {
  id?: string;
  user_id: string;
  name: string;
  email: string;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientUpdate {
  id?: string;
  user_id?: string;
  name?: string;
  email?: string;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceRow {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  total: number;
  created_at: string;
  updated_at?: string;
}

export interface InvoiceInsert {
  id?: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status?: InvoiceStatus;
  issue_date?: string;
  due_date: string;
  currency?: string;
  total?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceUpdate {
  id?: string;
  user_id?: string;
  client_id?: string;
  invoice_number?: string;
  status?: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  currency?: string;
  total?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface InvoiceItemInsert {
  id?: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  created_at?: string;
}

export interface InvoiceItemUpdate {
  id?: string;
  invoice_id?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  created_at?: string;
}

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: ClientInsert;
        Update: ClientUpdate;
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      invoices: {
        Row: InvoiceRow;
        Insert: InvoiceInsert;
        Update: InvoiceUpdate;
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      invoice_items: {
        Row: InvoiceItemRow;
        Insert: InvoiceItemInsert;
        Update: InvoiceItemUpdate;
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      invoice_status: InvoiceStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
