-- ==============================================================================
-- KudiFlow - Supabase Database Schema & Row-Level Security (RLS) Setup
-- ==============================================================================

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

-- ==============================================================================
-- Performance Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- ==============================================================================
-- Enable Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS Policies: CLIENTS
-- Users can only read and write rows where user_id matches auth.uid()
-- ==============================================================================
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can view their own clients"
    ON public.clients
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
CREATE POLICY "Users can insert their own clients"
    ON public.clients
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients"
    ON public.clients
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients"
    ON public.clients
    FOR DELETE
    USING (auth.uid() = user_id);

-- ==============================================================================
-- RLS Policies: INVOICES
-- Users can only read and write rows where user_id matches auth.uid()
-- ==============================================================================
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices"
    ON public.invoices
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.invoices;
CREATE POLICY "Users can insert their own invoices"
    ON public.invoices
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
CREATE POLICY "Users can update their own invoices"
    ON public.invoices
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;
CREATE POLICY "Users can delete their own invoices"
    ON public.invoices
    FOR DELETE
    USING (auth.uid() = user_id);

-- ==============================================================================
-- RLS Policies: INVOICE_ITEMS
-- Enforce access through the parent invoice's user_id
-- ==============================================================================
DROP POLICY IF EXISTS "Users can view invoice items for their invoices" ON public.invoice_items;
CREATE POLICY "Users can view invoice items for their invoices"
    ON public.invoice_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert invoice items for their invoices" ON public.invoice_items;
CREATE POLICY "Users can insert invoice items for their invoices"
    ON public.invoice_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update invoice items for their invoices" ON public.invoice_items;
CREATE POLICY "Users can update invoice items for their invoices"
    ON public.invoice_items
    FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete invoice items for their invoices" ON public.invoice_items;
CREATE POLICY "Users can delete invoice items for their invoices"
    ON public.invoice_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE public.invoices.id = public.invoice_items.invoice_id
              AND public.invoices.user_id = auth.uid()
        )
    );
