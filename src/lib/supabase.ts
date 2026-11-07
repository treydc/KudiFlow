import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

export const SCHEMA_SQL = `-- KudiFlow: Supabase Database Schema & Row-Level Security (RLS) Setup

-- 1. Create CLIENTS Table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create INVOICES Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create INVOICE_ITEMS Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: CLIENTS (Direct auth.uid() check)
CREATE POLICY "Users can view their own clients"
    ON public.clients FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients"
    ON public.clients FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
    ON public.clients FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
    ON public.clients FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies: INVOICES (Direct auth.uid() check)
CREATE POLICY "Users can view their own invoices"
    ON public.invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices"
    ON public.invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices"
    ON public.invoices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices"
    ON public.invoices FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies: INVOICE_ITEMS (Enforce access through parent invoice's user_id)
CREATE POLICY "Users can view invoice items for their invoices"
    ON public.invoice_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert invoice items for their invoices"
    ON public.invoice_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update invoice items for their invoices"
    ON public.invoice_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete invoice items for their invoices"
    ON public.invoice_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );
`;

// Get credentials from environment variables or localStorage
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('kudiflow_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('kudiflow_supabase_anon_key') : null;

  const url = (localUrl || envUrl || '').trim();
  const anonKey = (localKey || envKey || '').trim();

  return { url, anonKey };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('kudiflow_supabase_url', url.trim());
    if (anonKey) localStorage.setItem('kudiflow_supabase_anon_key', anonKey.trim());
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kudiflow_supabase_url');
    localStorage.removeItem('kudiflow_supabase_anon_key');
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    !url.includes('your-project-id') &&
    anonKey !== 'your-anon-key'
  );
}

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseCredentials();
  if (isSupabaseConfigured()) {
    try {
      supabaseInstance = createClient<Database>(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

export interface DemoUser {
  id: string;
  email: string;
  created_at: string;
}
