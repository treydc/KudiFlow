import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Trash2,
  AlertCircle,
  Eye,
  Download,
  Calendar,
  Building2,
  X,
  ChevronRight,
  Link,
  Link2,
  Copy,
  ExternalLink,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSupabase, getSupabaseCredentials } from '../lib/supabase';
import { InvoiceStatus } from '../types/database';
import { generateInvoicePdf, getStoredBusinessProfile, cleanBrandName } from '../utils/generatePdf';

interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceItemRecord {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceDisplay {
  id: string;
  invoice_number: string;
  client_id: string;
  client_name: string;
  client_email?: string;
  client_address?: string | null;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  payment_link?: string | null;
  paid_at?: string | null;
  items?: InvoiceItemRecord[];
  created_at?: string;
}

const INITIAL_DEMO_INVOICES: InvoiceDisplay[] = [
  {
    id: 'inv-001',
    invoice_number: 'INV-0001',
    client_id: 'cli-001',
    client_name: 'Dangote Logistics Hub',
    client_email: 'accounts@dangotelogistics.ng',
    client_address: 'Plot 1, Commercial Ave, Victoria Island, Lagos',
    amount: 1450000.00,
    currency: 'NGN',
    issue_date: '2026-10-15',
    due_date: '2026-11-15',
    status: 'paid',
    payment_link: null,
    paid_at: '2026-10-18T14:30:00Z',
    items: [
      { description: 'Fleet Management System Integration', quantity: 1, unit_price: 950000 },
      { description: 'Cloud Infrastructure & Maintenance', quantity: 2, unit_price: 250000 },
    ],
  },
  {
    id: 'inv-002',
    invoice_number: 'INV-0002',
    client_id: 'cli-002',
    client_name: 'Flutterwave Enterprise',
    client_email: 'billing@flutterwave.com',
    client_address: '8 Providence St, Lekki Phase 1, Lagos',
    amount: 825000.00,
    currency: 'NGN',
    issue_date: '2026-10-28',
    due_date: '2026-11-28',
    status: 'sent',
    payment_link: 'https://checkout.paystack.com/kudiflow-inv-0002',
    paid_at: null,
    items: [
      { description: 'Payment Flow UX Redesign', quantity: 1, unit_price: 825000 },
    ],
  },
  {
    id: 'inv-003',
    invoice_number: 'INV-0003',
    client_id: 'cli-003',
    client_name: 'Vanguard Systems UK',
    client_email: 'finance@vanguardsystems.co.uk',
    client_address: '25 Bank Street, London',
    amount: 3200000.00,
    currency: 'NGN',
    issue_date: '2026-11-01',
    due_date: '2026-12-01',
    status: 'draft',
    payment_link: null,
    paid_at: null,
    items: [
      { description: 'Enterprise Security Audit', quantity: 1, unit_price: 2000000 },
      { description: 'Penetration Testing & Compliance Report', quantity: 1, unit_price: 1200000 },
    ],
  },
  {
    id: 'inv-004',
    invoice_number: 'INV-0004',
    client_id: 'cli-004',
    client_name: 'Horizon FinTech Ltd',
    client_email: 'billing@horizonfintech.ng',
    client_address: 'Central Business District, Abuja',
    amount: 540000.00,
    currency: 'NGN',
    issue_date: '2026-09-20',
    due_date: '2026-10-20',
    status: 'overdue',
    payment_link: null,
    paid_at: null,
    items: [
      { description: 'Server Migration Retainer - September', quantity: 1, unit_price: 540000 },
    ],
  },
];

// Helper to auto-generate sequential invoice numbers per user
function computeNextSequentialInvoiceNumber(existingList: { invoice_number: string }[]): string {
  let highestNumber = 0;
  for (const inv of existingList) {
    if (!inv.invoice_number) continue;
    // Extract trailing numerical digits
    const match = inv.invoice_number.match(/(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > highestNumber) {
        highestNumber = parsed;
      }
    }
  }
  const nextSeq = highestNumber + 1;
  return `INV-${String(nextSeq).padStart(4, '0')}`;
}

export const InvoicesView: React.FC = () => {
  const { user, isConfigured } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDisplay[]>(INITIAL_DEMO_INVOICES);
  const [clients, setClients] = useState<{ id: string; name: string; email: string; address: string | null }[]>([]);
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail view modal
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDisplay | null>(null);

  // Payment link states
  const [creatingLinkId, setCreatingLinkId] = useState<string | null>(null);
  const [paymentLinkError, setPaymentLinkError] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Helper to format payment date nicely
  const formatPaidAt = (paidAt?: string | null, fallbackDate?: string): string => {
    if (paidAt) {
      try {
        const d = new Date(paidAt);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
        return paidAt;
      } catch {
        return paidAt;
      }
    }
    return fallbackDate || '';
  };

  // Create Invoice Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('draft');
  const [currency, setCurrency] = useState(() => getStoredBusinessProfile().defaultCurrency || 'NGN');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { description: 'Professional Services', quantity: 1, unit_price: 150000 },
  ]);
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Load user's clients and invoices from Supabase
  const loadDataFromSupabase = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !isConfigured) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      // 1. Fetch user's clients (enforced by RLS user_id = auth.uid())
      const { data: clientsData, error: clientErr } = await (supabase.from('clients') as any)
        .select('*')
        .order('name');

      if (clientErr) {
        console.warn('Supabase clients fetch notice:', clientErr);
      } else if (clientsData) {
        setClients(clientsData);
      }

      // 2. Fetch user's invoices with payment_link, paid_at, invoice_items, and client data
      let invoicesData: any = null;
      const { data: invWithLinks, error: invErrWithLinks } = await (supabase.from('invoices') as any)
        .select(`
          id,
          invoice_number,
          client_id,
          status,
          issue_date,
          due_date,
          currency,
          total,
          payment_link,
          paid_at,
          created_at,
          clients (id, name, email, address),
          invoice_items (id, description, quantity, unit_price)
        `)
        .order('created_at', { ascending: false });

      if (invErrWithLinks) {
        console.warn('Invoices fetch notice, trying fallback without payment fields:', invErrWithLinks);
        const { data: fallbackData, error: fallbackErr } = await (supabase.from('invoices') as any)
          .select(`
            id,
            invoice_number,
            client_id,
            status,
            issue_date,
            due_date,
            currency,
            total,
            created_at,
            clients (id, name, email, address),
            invoice_items (id, description, quantity, unit_price)
          `)
          .order('created_at', { ascending: false });

        if (fallbackErr) {
          console.warn('Invoices fallback fetch error:', fallbackErr);
          setErrorMessage("Couldn't load your invoices. Please try again.");
        } else {
          invoicesData = fallbackData;
        }
      } else {
        invoicesData = invWithLinks;
      }

      if (invoicesData) {
        const mapped: InvoiceDisplay[] = invoicesData.map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          client_id: inv.client_id,
          client_name: inv.clients?.name || 'Unnamed Client',
          client_email: inv.clients?.email,
          client_address: inv.clients?.address,
          amount: Number(inv.total) || 0,
          currency: inv.currency || 'NGN',
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          status: inv.status as InvoiceStatus,
          payment_link: inv.payment_link || null,
          paid_at: inv.paid_at || null,
          items: Array.isArray(inv.invoice_items) ? inv.invoice_items : [],
          created_at: inv.created_at,
        }));
        setInvoices(mapped);

        // Keep open viewingInvoice in sync with latest status/payment info
        setViewingInvoice((current) => {
          if (!current) return null;
          const updated = mapped.find((item) => item.id === current.id);
          return updated || current;
        });
      }
    } catch (err: any) {
      console.error('Error loading invoices data:', err);
      setErrorMessage("Couldn't load your invoices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, user]);

  useEffect(() => {
    loadDataFromSupabase();
  }, [loadDataFromSupabase]);

  // Refresh invoice status when the window or tab regains focus
  useEffect(() => {
    const handleFocus = () => {
      loadDataFromSupabase();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDataFromSupabase();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadDataFromSupabase]);

  // Create payment link via Supabase Edge Function create-payment-link
  const handleCreatePaymentLink = async (invoiceId: string) => {
    setPaymentLinkError(null);
    setCreatingLinkId(invoiceId);

    try {
      const supabase = getSupabase();
      let link: string | null = null;

      if (supabase && isConfigured) {
        const { data, error } = await supabase.functions.invoke('create-payment-link', {
          body: { invoice_id: invoiceId },
        });

        if (error) {
          throw error;
        }

        link =
          data?.payment_link ||
          data?.url ||
          data?.link ||
          data?.data?.authorization_url ||
          data?.data?.payment_link ||
          (typeof data === 'string' && data.startsWith('http') ? data : null);

        if (!link) {
          throw new Error('Payment link was not returned');
        }

        // Persist to invoices table if column exists
        try {
          await (supabase.from('invoices') as any)
            .update({ payment_link: link })
            .eq('id', invoiceId);
        } catch (dbErr) {
          console.warn('Notice saving payment_link to table:', dbErr);
        }
      } else {
        // Demo fallback link
        link = `https://checkout.paystack.com/kudiflow-${invoiceId.slice(-6)}`;
      }

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, payment_link: link } : inv))
      );

      setViewingInvoice((current) => {
        if (current && current.id === invoiceId) {
          return { ...current, payment_link: link };
        }
        return current;
      });
    } catch (err: any) {
      console.error('Error creating payment link:', err);
      setPaymentLinkError("Couldn't create the payment link. Please try again.");
    } finally {
      setCreatingLinkId(null);
    }
  };

  const handleCopyLink = async (link: string, id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const el = document.createElement('textarea');
        el.value = link;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopiedLinkId(id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      setPaymentLinkError("Couldn't copy link. Please copy it manually.");
    }
  };

  // Open Create Invoice Modal & Auto-Generate Sequential Invoice Number per user
  const handleOpenCreateModal = () => {
    setErrorMessage(null);
    const nextSeqNumber = computeNextSequentialInvoiceNumber(invoices);
    setInvoiceNumber(nextSeqNumber);

    // Pick first available client by default
    if (clients.length > 0) {
      setSelectedClientId(clients[0].id);
    } else {
      setSelectedClientId('');
    }

    const today = new Date().toISOString().split('T')[0];
    const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const storedBiz = getStoredBusinessProfile();
    setCurrency(storedBiz.defaultCurrency || 'NGN');

    setIssueDate(today);
    setDueDate(defaultDueDate);
    setInvoiceStatus('draft');
    setLineItems([
      { description: 'Consulting & Implementation Services', quantity: 1, unit_price: 250000 },
    ]);
    setShowCreateModal(true);
  };

  // Line items actions
  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleUpdateLineItem = (index: number, field: keyof LineItemDraft, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  // Calculate total amount across all line items
  const calculatedTotal = useMemo(() => {
    return lineItems.reduce((acc, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unit_price) || 0;
      return acc + q * p;
    }, 0);
  }, [lineItems]);

  // CREATE INVOICE (Always includes user.id)
  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setErrorMessage('Please choose a client for this invoice.');
      return;
    }
    if (!dueDate) {
      setErrorMessage('Please pick a payment due date.');
      return;
    }

    setSavingInvoice(true);
    setErrorMessage(null);

    const clientObj = clients.find((c) => c.id === selectedClientId);
    const clientName = clientObj ? clientObj.name : 'Client';

    const newInvoiceDraft: InvoiceDisplay = {
      id: 'inv-' + Date.now(),
      invoice_number: invoiceNumber.trim() || computeNextSequentialInvoiceNumber(invoices),
      client_id: selectedClientId,
      client_name: clientName,
      client_email: clientObj?.email,
      client_address: clientObj?.address,
      amount: calculatedTotal,
      currency: currency || 'NGN',
      issue_date: issueDate,
      due_date: dueDate,
      status: invoiceStatus,
      items: lineItems.map((item) => ({
        description: item.description.trim() || 'Service line item',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
      })),
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase && isConfigured) {
      try {
        // Explicitly get the current authenticated user from Supabase auth session
        const { data: userData, error: userAuthError } = await supabase.auth.getUser();
        if (userAuthError || !userData?.user) {
          throw new Error('Please sign in to continue.');
        }

        const currentUser = userData.user;

        // Step 1: Insert into invoices (set user_id to verified currentUser.id)
        const { data: createdInvoice, error: invErr } = await (supabase.from('invoices') as any)
          .insert({
            user_id: currentUser.id, // Explicitly set to verified current user's id
            client_id: selectedClientId,
            invoice_number: newInvoiceDraft.invoice_number,
            status: newInvoiceDraft.status,
            issue_date: newInvoiceDraft.issue_date,
            due_date: newInvoiceDraft.due_date,
            currency: currency || 'NGN',
            total: calculatedTotal,
          })
          .select()
          .single();

        if (invErr) {
          throw invErr;
        }

        if (createdInvoice) {
          newInvoiceDraft.id = createdInvoice.id;

          // Step 2: Insert multiple line items into invoice_items
          if (lineItems.length > 0) {
            const itemsToInsert = lineItems.map((item) => ({
              invoice_id: createdInvoice.id,
              description: item.description.trim() || 'Service line item',
              quantity: Number(item.quantity) || 1,
              unit_price: Number(item.unit_price) || 0,
            }));

            const { error: itemsErr } = await (supabase.from('invoice_items') as any)
              .insert(itemsToInsert);

            if (itemsErr) {
              console.warn('Notice inserting invoice items:', itemsErr);
            }
          }
        }
      } catch (err: any) {
        console.error('Error creating invoice:', err);
        setErrorMessage("Couldn't save the invoice. Please try again.");
        setSavingInvoice(false);
        return;
      }
    }

    setInvoices((prev) => [newInvoiceDraft, ...prev]);
    setSavingInvoice(false);
    setShowCreateModal(false);
  };

  // UPDATE INVOICE STATUS (Manual changes restricted to draft, sent, and overdue; paid is handled exclusively by payment system)
  const handleUpdateStatus = async (invoiceId: string, newStatus: 'draft' | 'sent' | 'overdue') => {
    setErrorMessage(null);
    const supabase = getSupabase();
    if (supabase && isConfigured) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { error } = await (supabase.from('invoices') as any)
            .update({ status: newStatus })
            .eq('id', invoiceId);
          if (error) {
            setErrorMessage("Couldn't update invoice status. Please try again.");
            return;
          }
        }
      } catch {
        setErrorMessage("Couldn't update invoice status. Please try again.");
        return;
      }
    }

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    );
    if (viewingInvoice && viewingInvoice.id === invoiceId) {
      setViewingInvoice({ ...viewingInvoice, status: newStatus });
    }
  };

  // DELETE INVOICE
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;

    const supabase = getSupabase();
    if (supabase && isConfigured) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          await (supabase.from('invoices') as any).delete().eq('id', invoiceId);
        }
      } catch (err) {
        console.warn('Error deleting invoice from Supabase:', err);
        setErrorMessage("Couldn't delete the invoice. Please try again.");
      }
    }

    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
    if (viewingInvoice?.id === invoiceId) {
      setViewingInvoice(null);
    }
  };

  // Filtering
  const filteredInvoices = invoices.filter((inv) => {
    const matchesFilter = filter === 'all' || inv.status === filter;
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.client_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // KPI Calculations
  const totalReceivables = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((acc, inv) => acc + inv.amount, 0);
  const totalPending = invoices.filter((i) => i.status === 'sent' || i.status === 'draft').reduce((acc, inv) => acc + inv.amount, 0);
  const totalOverdue = invoices.filter((i) => i.status === 'overdue').reduce((acc, inv) => acc + inv.amount, 0);

  const formatCurrency = (val: number) => {
    return `₦${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Invoices</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>{invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}</span>
            <span aria-hidden="true">·</span>
            <span>Create and track your client billing</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium px-3.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Invoice</span>
        </button>
      </div>

      {/* Global Notice Alert if any */}
      {errorMessage && (
        <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded-md text-xs text-red-300 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stat Cards: Total Invoiced, Paid, Outstanding, Overdue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3.5">
          <div className="text-xs text-neutral-400 font-medium mb-1">Total Invoiced</div>
          <div className="text-lg font-semibold tabular-nums text-white">
            {formatCurrency(totalReceivables)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">All created invoices</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3.5">
          <div className="text-xs text-neutral-400 font-medium mb-1">Paid</div>
          <div className="text-lg font-semibold tabular-nums text-emerald-500">
            {formatCurrency(totalPaid)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Collected payments</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3.5">
          <div className="text-xs text-neutral-400 font-medium mb-1">Outstanding</div>
          <div className="text-lg font-semibold tabular-nums text-neutral-200">
            {formatCurrency(totalPending)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Awaiting payment</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3.5">
          <div className="text-xs text-neutral-400 font-medium mb-1">Overdue</div>
          <div className="text-lg font-semibold tabular-nums text-red-400">
            {formatCurrency(totalOverdue)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Past due date</div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Filter buttons by status: all, draft, sent, paid, overdue */}
        <div className="flex flex-wrap items-center gap-0.5 p-0.5 bg-neutral-900 border border-neutral-800 rounded-md text-xs self-start">
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((tab) => {
            const count =
              tab === 'all'
                ? invoices.length
                : invoices.filter((i) => i.status === tab).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer capitalize flex items-center gap-1.5 ${
                  filter === tab
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>{tab}</span>
                <span className="text-[11px] opacity-75 tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice or client..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 font-medium text-[11px]">
              <tr>
                <th className="py-2.5 px-3.5">Invoice #</th>
                <th className="py-2.5 px-3.5">Client</th>
                <th className="py-2.5 px-3.5">Issue Date</th>
                <th className="py-2.5 px-3.5">Due Date</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5 text-right">Amount</th>
                <th className="py-2.5 px-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-neutral-500">
                    <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-xs">Loading invoices...</span>
                  </td>
                </tr>
              ) : filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                    onClick={() => setViewingInvoice(inv)}
                  >
                    <td className="py-2.5 px-3.5 font-medium tabular-nums text-white">
                      {inv.invoice_number}
                    </td>
                    <td className="py-2.5 px-3.5 text-neutral-200">
                      <div className="font-medium text-xs">{inv.client_name}</div>
                      {inv.items && inv.items.length > 0 && (
                        <div className="text-[11px] text-neutral-500">
                          {inv.items.length} {inv.items.length === 1 ? 'item' : 'items'}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-neutral-400 tabular-nums">
                      {inv.issue_date}
                    </td>
                    <td className="py-2.5 px-3.5 text-neutral-400 tabular-nums">
                      {inv.due_date}
                    </td>
                    <td className="py-2.5 px-3.5">
                      {/* Status Badges */}
                      {inv.status === 'draft' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                          <FileText className="w-3 h-3 text-neutral-400" />
                          <span>Draft</span>
                        </span>
                      )}
                      {inv.status === 'sent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-950/40 text-blue-300 border border-blue-900/50">
                          <Send className="w-3 h-3 text-blue-400" />
                          <span>Sent</span>
                        </span>
                      )}
                      {inv.status === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-900/50">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Paid</span>
                        </span>
                      )}
                      {inv.status === 'overdue' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-950/40 text-red-300 border border-red-900/50">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          <span>Overdue</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-medium tabular-nums text-neutral-100">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td
                      className="py-2.5 px-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {/* Unpaid: Show Create payment link or Copy/Open if link already exists */}
                        {inv.status !== 'paid' && (
                          inv.payment_link ? (
                            <div className="flex items-center gap-1 mr-1">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(inv.payment_link!, inv.id)}
                                title={copiedLinkId === inv.id ? 'Copied link!' : 'Copy payment link'}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                {copiedLinkId === inv.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy link</span>
                                  </>
                                )}
                              </button>
                              <a
                                href={inv.payment_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open payment link"
                                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer inline-flex items-center"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCreatePaymentLink(inv.id)}
                              disabled={creatingLinkId === inv.id}
                              title="Create payment link"
                              className="mr-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/80 text-neutral-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {creatingLinkId === inv.id ? (
                                <>
                                  <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Creating...</span>
                                </>
                              ) : (
                                <>
                                  <Link className="w-3 h-3 text-emerald-400" />
                                  <span>Create payment link</span>
                                </>
                              )}
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          onClick={() => setViewingInvoice(inv)}
                          title="View Details"
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateInvoicePdf(inv);
                          }}
                          title="Download PDF"
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv.id)}
                          title="Delete Invoice"
                          className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-neutral-500">
                    <FileText className="w-7 h-7 mx-auto mb-2 opacity-40 text-neutral-400" />
                    <p className="text-xs font-medium text-neutral-300">
                      {searchQuery
                        ? 'No invoices found'
                        : filter !== 'all'
                        ? `No ${filter} invoices`
                        : 'No invoices yet'}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {searchQuery
                        ? `No invoices match "${searchQuery}". Try a different search.`
                        : filter !== 'all'
                        ? `You don't have any invoices currently marked as ${filter}.`
                        : 'Create your first invoice to start billing your clients.'}
                    </p>
                    {!searchQuery && filter === 'all' && (
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Invoice</span>
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL (Form with client picker, sequential invoice number, line items, due date) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 sm:p-6 max-w-2xl w-full shadow-md relative my-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Create Invoice</h3>
                <p className="text-xs text-neutral-400">
                  Choose a client, add line items, and set a due date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-3.5">
              {/* Row 1: Client Picker & Invoice Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Client <span className="text-neutral-500">*</span>
                  </label>
                  {clients.length > 0 ? (
                    <select
                      required
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                    >
                      <option value="" disabled>
                        -- Select client --
                      </option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-md text-xs text-amber-400 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>No clients yet. Please add a client first.</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 tabular-nums focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              {/* Row 2: Issue Date, Due Date, Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Issue Date <span className="text-neutral-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 tabular-nums focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Due Date <span className="text-neutral-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 tabular-nums focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Status
                  </label>
                  <select
                    value={invoiceStatus}
                    onChange={(e) => setInvoiceStatus(e.target.value as 'draft' | 'sent' | 'overdue')}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Multiple Line Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-neutral-300">
                    Line Items
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs text-neutral-300 hover:text-white font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-neutral-950 p-2.5 rounded-md border border-neutral-800 text-xs"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          required
                          placeholder="Item description (e.g. Web design, Consulting)"
                          value={item.description}
                          onChange={(e) => handleUpdateLineItem(idx, 'description', e.target.value)}
                          className="w-full bg-transparent border-none text-neutral-200 placeholder:text-neutral-600 focus:outline-none text-xs"
                        />
                      </div>

                      <div className="w-16">
                        <input
                          type="number"
                          required
                          min="1"
                          step="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 tabular-nums text-center focus:outline-none text-xs"
                          title="Quantity"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleUpdateLineItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-neutral-200 tabular-nums text-right focus:outline-none text-xs"
                          title="Unit Price"
                        />
                      </div>

                      <div className="w-24 text-right font-medium text-neutral-300 tabular-nums">
                        ₦{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}
                      </div>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                          title="Remove Line Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Subtotal summary bar */}
                <div className="mt-3 p-3 bg-neutral-950 rounded-md border border-neutral-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <span>{lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">Total:</span>
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {formatCurrency(calculatedTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={savingInvoice}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInvoice || clients.length === 0}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingInvoice && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{savingInvoice ? 'Creating Invoice...' : 'Create Invoice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW INVOICE DETAILS MODAL */}
      {viewingInvoice && (() => {
        const bizProfile = getStoredBusinessProfile();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-2xl w-full shadow-md relative my-6 overflow-hidden">
              {/* Modal Top Action Bar */}
              <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Invoice</span>
                  <span className="text-neutral-600">/</span>
                  <span className="text-xs font-medium text-white tabular-nums">{viewingInvoice.invoice_number}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => generateInvoicePdf(viewingInvoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs rounded-md transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingInvoice(null)}
                    className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Document Body */}
              <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto bg-neutral-900">
                {errorMessage && (
                  <div className="mb-4 px-3 py-2 bg-red-950/40 border border-red-900/50 rounded-md text-xs text-red-300 flex items-center justify-between">
                    <span>{errorMessage}</span>
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="text-red-400 hover:text-red-200 ml-2 cursor-pointer text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Online Payment Link Card (Only shown for unpaid invoices; hidden when paid) */}
                {viewingInvoice.status !== 'paid' && (
                  <div className="mb-4 p-3.5 bg-neutral-950 border border-neutral-800 rounded-md">
                    {paymentLinkError && (
                      <div className="mb-3 px-3 py-2 bg-red-950/40 border border-red-900/50 rounded text-xs text-red-300 flex items-center justify-between">
                        <span>{paymentLinkError}</span>
                        <button
                          type="button"
                          onClick={() => setPaymentLinkError(null)}
                          className="text-red-400 hover:text-red-200 ml-2 cursor-pointer text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {viewingInvoice.payment_link ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-medium text-white flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Online Payment Link</span>
                          </div>
                          <span className="text-[11px] text-emerald-400 font-medium">Ready for payment</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-300 font-mono truncate select-all">
                            {viewingInvoice.payment_link}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(viewingInvoice.payment_link!, viewingInvoice.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              {copiedLinkId === viewingInvoice.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy link</span>
                                </>
                              )}
                            </button>
                            <a
                              href={viewingInvoice.payment_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium text-white flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Online Payment Link</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            Create a secure checkout link so your client can pay this invoice online.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCreatePaymentLink(viewingInvoice.id)}
                          disabled={creatingLinkId === viewingInvoice.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-medium rounded transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {creatingLinkId === viewingInvoice.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Creating link...</span>
                            </>
                          ) : (
                            <>
                              <Link className="w-3.5 h-3.5" />
                              <span>Create payment link</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Print-friendly white document preview matching PDF 1:1 */}
                <div className="bg-white text-slate-900 rounded-md p-6 sm:p-8 border border-slate-200 font-sans space-y-5">
                  {/* Header: Logo and KudiFlow name on the left, Status badge on the right */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                        {bizProfile.logoUrl ? (
                          <img src={bizProfile.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white font-semibold text-xs">
                            K
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 tracking-tight">KudiFlow</span>
                    </div>

                    {/* Status Badge: Draft gray, Sent blue, Paid green, Overdue red */}
                    <div>
                      {viewingInvoice.status === 'paid' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]">
                          <span>PAID</span>
                        </span>
                      )}
                      {viewingInvoice.status === 'sent' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                          <span>SENT</span>
                        </span>
                      )}
                      {viewingInvoice.status === 'draft' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]">
                          <span>DRAFT</span>
                        </span>
                      )}
                      {viewingInvoice.status === 'overdue' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]">
                          <span>OVERDUE</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Below Header: Two Columns */}
                  {/* Left: Invoice number, issue date and due date + From section */}
                  {/* Right: Bill To (client name, email, address) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                    {/* Left Column: Details + From */}
                    <div className="space-y-3.5">
                      {/* Section 1: Invoice Details */}
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                          INVOICE DETAILS
                        </div>
                        <div className="font-semibold text-slate-900 tabular-nums text-xs">
                          {viewingInvoice.invoice_number}
                        </div>
                        <div className="mt-1 space-y-0.5 text-slate-600 text-[11px]">
                          <div className="flex gap-2">
                            <span className="text-slate-400">Issue Date:</span>
                            <span className="font-medium text-slate-800 tabular-nums">{viewingInvoice.issue_date}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-400">Due Date:</span>
                            <span className="font-medium text-[#047857] tabular-nums">{viewingInvoice.due_date}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: From section from Settings */}
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                          FROM
                        </div>
                        <div className="font-semibold text-slate-900 text-xs">
                          {cleanBrandName(bizProfile.name)}
                        </div>
                        <div className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                          {bizProfile.address || 'Victoria Island, Lagos, Nigeria'}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {bizProfile.email || 'billing@kudiflow.app'}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Bill To */}
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                        BILL TO
                      </div>
                      <div className="font-semibold text-slate-900 text-xs">
                        {viewingInvoice.client_name}
                      </div>
                      {viewingInvoice.client_email && (
                        <div className="text-slate-600 text-[11px] mt-0.5">
                          {viewingInvoice.client_email}
                        </div>
                      )}
                      {viewingInvoice.client_address && (
                        <div className="text-slate-500 text-[11px] mt-1 leading-relaxed">
                          {viewingInvoice.client_address}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="rounded-md border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                        <tr>
                          <th className="py-2 px-3 text-center w-10">#</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3 text-right w-16">Qty</th>
                          <th className="py-2 px-3 text-right w-28">Unit Price</th>
                          <th className="py-2 px-3 text-right w-28">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingInvoice.items && viewingInvoice.items.length > 0 ? (
                          viewingInvoice.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-center text-slate-400 text-[11px] tabular-nums">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="py-2 px-3 text-slate-900 font-normal">
                                {item.description}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                                ₦{Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                                ₦{(Number(item.quantity) * Number(item.unit_price)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-400">
                              General Service Package
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Section: Payment / Paid Banner on Left, Totals Box on Right */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-1">
                    {/* Left: Unpaid Payment Instructions OR Paid Green Banner */}
                    <div>
                      {viewingInvoice.status === 'paid' ? (
                        <div className="p-3 bg-[#ecfdf5] rounded-md border border-[#a7f3d0] border-l-2 border-l-[#047857] text-xs space-y-1">
                          <div className="font-semibold text-[#047857] text-xs">
                            Payment received on {formatPaidAt(viewingInvoice.paid_at, viewingInvoice.due_date || viewingInvoice.issue_date)}
                          </div>
                          <div className="text-[11px] text-emerald-800 tabular-nums">
                            Payment Reference: {viewingInvoice.invoice_number}
                          </div>
                          <div className="text-[10px] text-slate-600">
                            This invoice has been settled in full. Thank you for your payment.
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-md border border-slate-200 border-l-2 border-l-[#047857] text-xs space-y-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 block">
                            PAYMENT INSTRUCTIONS
                          </span>
                          <p className="text-[11px] text-slate-500">
                            Please transfer to the following account:
                          </p>
                          <div className="space-y-0.5 text-[11px] text-slate-700">
                            <div>
                              <span className="text-slate-500">Bank Name: </span>
                              <span className="font-medium text-slate-900">{bizProfile.bankName || 'Zenith Bank PLC'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Account Name: </span>
                              <span className="font-medium text-slate-800">{cleanBrandName(bizProfile.accountName || 'KudiFlow')}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Account Number: </span>
                              <span className="font-medium text-slate-900 tabular-nums">{bizProfile.accountNumber || '1018892341'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Reference: </span>
                              <span className="font-medium text-[#047857] tabular-nums">{viewingInvoice.invoice_number}</span>
                            </div>
                          </div>
                          {viewingInvoice.payment_link && (
                            <div className="pt-2 border-t border-slate-200 mt-2 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">Pay online:</span>
                              <a
                                href={viewingInvoice.payment_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-[#047857] hover:underline inline-flex items-center gap-1"
                              >
                                <span>Pay online now</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Totals Box with Subtotal and Larger Total in Bold */}
                    <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-800 tabular-nums">
                          {formatCurrency(viewingInvoice.amount)}
                        </span>
                      </div>
                      <div className="border-b border-slate-200 my-1" />
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-semibold text-slate-900 uppercase text-[10px] tracking-wide">
                          Total
                        </span>
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          <span className="text-[#047857] font-semibold mr-0.5">₦</span>
                          {viewingInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer with business name, email and invoice number */}
                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      {cleanBrandName(bizProfile.name)}  ·  {bizProfile.email || 'billing@kudiflow.app'}
                    </div>
                    <div className="font-medium text-slate-600 tabular-nums">
                      Invoice #{viewingInvoice.invoice_number}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Change Footer Controls (Only Draft, Sent, Overdue can be set manually. Paid is handled by the payment system) */}
              <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <span className="text-[11px]">Status:</span>
                  {viewingInvoice.status === 'paid' && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-900/50">
                      Paid
                    </span>
                  )}
                  {(['draft', 'sent', 'overdue'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateStatus(viewingInvoice.id, st)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                        viewingInvoice.status === st
                          ? 'bg-neutral-800 text-white border border-neutral-700'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteInvoice(viewingInvoice.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors py-1 px-2 hover:bg-neutral-900 rounded cursor-pointer"
                >
                  Delete Invoice
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
