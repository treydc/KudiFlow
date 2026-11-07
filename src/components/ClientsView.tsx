import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Users, Mail, MapPin, CheckCircle2, Edit2, Trash2, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSupabase } from '../lib/supabase';
import { ClientRow } from '../types/database';

interface ClientItem {
  id: string;
  name: string;
  email: string;
  address: string | null;
  created_at?: string;
}

const INITIAL_DEMO_CLIENTS: ClientItem[] = [
  {
    id: 'cli-001',
    name: 'Dangote Logistics Hub',
    email: 'accounts@dangotelogistics.ng',
    address: 'Plot 1, Commercial Ave, Victoria Island, Lagos, Nigeria',
  },
  {
    id: 'cli-002',
    name: 'Flutterwave Enterprise',
    email: 'billing@flutterwave.com',
    address: '8 Providence St, Lekki Phase 1, Lagos, Nigeria',
  },
  {
    id: 'cli-003',
    name: 'Vanguard Systems UK',
    email: 'finance@vanguardsystems.co.uk',
    address: '25 Bank Street, Canary Wharf, London, UK',
  },
  {
    id: 'cli-004',
    name: 'Horizon FinTech Ltd',
    email: 'billing@horizonfintech.ng',
    address: 'Central Business District, Abuja, Nigeria',
  },
];

export const ClientsView: React.FC = () => {
  const { user, isConfigured } = useAuth();
  const [clients, setClients] = useState<ClientItem[]>(INITIAL_DEMO_CLIENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Client Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit Client Modal states
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Confirmation Modal states
  const [deletingClient, setDeletingClient] = useState<ClientItem | null>(null);
  const [savingDelete, setSavingDelete] = useState(false);

  // Load clients from Supabase
  const loadClientsFromSupabase = useCallback(async () => {
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

      const { data, error } = await (supabase.from('clients') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Clients fetch error:', error);
        setErrorMessage("Couldn't load your clients. Please try again.");
      } else if (data) {
        setClients(
          data.map((c: ClientRow) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            address: c.address,
            created_at: c.created_at,
          }))
        );
      }
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setErrorMessage("Couldn't load your clients. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isConfigured, user]);

  useEffect(() => {
    loadClientsFromSupabase();
  }, [loadClientsFromSupabase]);

  // ADD CLIENT (Always includes user.id)
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSavingAdd(true);
    setErrorMessage(null);

    const newClientObj: ClientItem = {
      id: 'cli-' + Date.now(),
      name: name.trim(),
      email: email.trim(),
      address: address.trim() || null,
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

        const { data, error } = await (supabase.from('clients') as any)
          .insert({
            user_id: currentUser.id, // Explicitly set to verified current user's id
            name: newClientObj.name,
            email: newClientObj.email,
            address: newClientObj.address,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          newClientObj.id = (data as ClientRow).id;
        }
      } catch (err: any) {
        console.error('Error inserting client:', err);
        setErrorMessage("Couldn't save the client. Please try again.");
        setSavingAdd(false);
        return;
      }
    }

    setClients((prev) => [newClientObj, ...prev]);
    setName('');
    setEmail('');
    setAddress('');
    setSavingAdd(false);
    setShowAddModal(false);
  };

  // OPEN EDIT MODAL
  const openEditModal = (client: ClientItem) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditEmail(client.email);
    setEditAddress(client.address || '');
    setErrorMessage(null);
  };

  // EDIT CLIENT
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editName.trim() || !editEmail.trim()) return;

    setSavingEdit(true);
    setErrorMessage(null);

    const updatedData = {
      name: editName.trim(),
      email: editEmail.trim(),
      address: editAddress.trim() || null,
    };

    const supabase = getSupabase();
    if (supabase && isConfigured) {
      try {
        const { data: userData, error: userAuthError } = await supabase.auth.getUser();
        if (userAuthError || !userData?.user) {
          throw new Error(userAuthError?.message || 'Could not verify active authentication session. Please sign in again.');
        }

        const { error } = await (supabase.from('clients') as any)
          .update(updatedData)
          .eq('id', editingClient.id);

        if (error) {
          throw error;
        }
      } catch (err: any) {
        console.error('Error updating client in Supabase:', err);
        setErrorMessage("Couldn't update the client. Please try again.");
        setSavingEdit(false);
        return;
      }
    }

    setClients((prev) =>
      prev.map((c) =>
        c.id === editingClient.id
          ? {
              ...c,
              ...updatedData,
            }
          : c
      )
    );

    setSavingEdit(false);
    setEditingClient(null);
  };

  // DELETE CLIENT
  const handleConfirmDelete = async () => {
    if (!deletingClient) return;

    setSavingDelete(true);
    setErrorMessage(null);

    const supabase = getSupabase();
    if (supabase && isConfigured) {
      try {
        const { data: userData, error: userAuthError } = await supabase.auth.getUser();
        if (userAuthError || !userData?.user) {
          throw new Error('Please sign in to continue.');
        }

        const { error } = await (supabase.from('clients') as any)
          .delete()
          .eq('id', deletingClient.id);

        if (error) {
          throw error;
        }
      } catch (err: any) {
        console.error('Error deleting client from Supabase:', err);
        setErrorMessage("Couldn't delete the client. Please try again.");
        setSavingDelete(false);
        return;
      }
    }

    setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
    setSavingDelete(false);
    setDeletingClient(null);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Clients</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>{clients.length} {clients.length === 1 ? 'client' : 'clients'}</span>
            <span aria-hidden="true">·</span>
            <span>Manage contact and billing details</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setShowAddModal(true);
          }}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium px-3.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Client</span>
        </button>
      </div>

      {/* Global error alert if any */}
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

      {/* Filter and Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, email, or address..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {loading ? (
          <div className="col-span-full py-14 text-center text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-md">
            <div className="w-5 h-5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs">Loading clients...</span>
          </div>
        ) : filteredClients.length > 0 ? (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-neutral-900 border border-neutral-800 rounded-md p-4 hover:border-neutral-700 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-white truncate">{client.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                      <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(client)}
                      title="Edit Client"
                      className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingClient(client)}
                      title="Delete Client"
                      className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 text-xs text-neutral-400">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3 h-3 text-neutral-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 text-[11px]">
                      {client.address || 'No billing address provided'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
                <span>Client ID</span>
                <span className="text-neutral-400 tabular-nums">{client.id}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-14 text-center text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-md">
            <Users className="w-7 h-7 mx-auto mb-2 opacity-40 text-neutral-400" />
            <p className="text-xs font-medium text-neutral-300">
              {searchQuery ? 'No clients found' : 'No clients yet'}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              {searchQuery
                ? `Couldn't find any clients matching "${searchQuery}". Try another search.`
                : 'Add your first client to start creating invoices.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Client</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ADD CLIENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 max-w-md w-full shadow-md relative">
            <h3 className="text-sm font-semibold text-white mb-0.5">Add Client</h3>
            <p className="text-xs text-neutral-400 mb-3.5">
              Enter your client's contact and billing details.
            </p>

            <form onSubmit={handleAddClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Client Name <span className="text-neutral-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dangote Logistics Hub"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Email Address <span className="text-neutral-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@dangotelogistics.ng"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Billing Address (Optional)
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot 1, Commercial Ave, Victoria Island, Lagos, Nigeria"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={savingAdd}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingAdd && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{savingAdd ? 'Saving...' : 'Save Client'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CLIENT MODAL */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 max-w-md w-full shadow-md relative">
            <h3 className="text-sm font-semibold text-white mb-0.5">Edit Client</h3>
            <p className="text-xs text-neutral-400 mb-3.5">
              Update contact and billing details for <span className="text-neutral-200 font-medium">{editingClient.name}</span>.
            </p>

            <form onSubmit={handleUpdateClient} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Client Name <span className="text-neutral-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Email Address <span className="text-neutral-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-xs text-neutral-100 focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  disabled={savingEdit}
                  className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingEdit && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 max-w-sm w-full shadow-md relative">
            <h3 className="text-sm font-semibold text-white mb-1">Delete Client?</h3>
            <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
              Are you sure you want to delete <span className="text-neutral-200 font-medium">{deletingClient.name}</span>?
              This will remove them from your client list.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                disabled={savingDelete}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={savingDelete}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium text-xs rounded-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingDelete && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{savingDelete ? 'Deleting...' : 'Delete Client'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
